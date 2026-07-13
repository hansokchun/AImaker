import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, getRequiredEnv } from '../_shared/supabase.ts'

type NotificationEventRow = {
    readonly id: string
    readonly user_id: string
    readonly title: string
    readonly body: string
    readonly channels: readonly string[]
    readonly related_type: string | null
    readonly related_id: string | null
}

type NotificationPreferenceRow = {
    readonly user_id: string
    readonly phone_number: string
    readonly kakao_alimtalk_enabled: boolean
    readonly sms_fallback_enabled: boolean
}

type DispatchResult = {
    readonly status: 'sent' | 'failed' | 'skipped'
    readonly provider: string
    readonly failureReason?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isNotificationEventRow = (value: unknown): value is NotificationEventRow => {
    if (!isRecord(value)) return false
    return typeof value.id === 'string'
        && typeof value.user_id === 'string'
        && typeof value.title === 'string'
        && typeof value.body === 'string'
        && Array.isArray(value.channels)
        && value.channels.every((channel) => typeof channel === 'string')
}

const isNotificationPreferenceRow = (value: unknown): value is NotificationPreferenceRow => {
    if (!isRecord(value)) return false
    return typeof value.user_id === 'string'
        && typeof value.phone_number === 'string'
        && typeof value.kakao_alimtalk_enabled === 'boolean'
        && typeof value.sms_fallback_enabled === 'boolean'
}

const requireAutomationSecret = (request: Request): Response | null => {
    const expectedSecret = getRequiredEnv('TRADE_AUTOMATION_SECRET')
    const actualSecret = request.headers.get('x-automation-secret')?.trim()
    return actualSecret === expectedSecret
        ? null
        : jsonResponse({ message: 'Automation secret is invalid.' }, { status: 401 })
}

const createPreferenceMap = (preferences: readonly NotificationPreferenceRow[]) =>
    new Map(preferences.map((preference) => [preference.user_id, preference]))

const postProviderWebhook = async (url: string, body: Record<string, unknown>): Promise<boolean> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8_000)
    try {
        const response = await fetch(url, {
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            signal: controller.signal,
        })
        return response.ok
    } finally {
        clearTimeout(timeoutId)
    }
}

const dispatchEvent = async (
    event: NotificationEventRow,
    preference: NotificationPreferenceRow | undefined,
): Promise<DispatchResult> => {
    const kakaoWebhookUrl = Deno.env.get('KAKAO_ALIMTALK_WEBHOOK_URL')?.trim()
    const smsWebhookUrl = Deno.env.get('SMS_FALLBACK_WEBHOOK_URL')?.trim()
    const phoneNumber = preference?.phone_number.trim()

    const body = {
        body: event.body,
        phoneNumber: phoneNumber || null,
        relatedId: event.related_id,
        relatedType: event.related_type,
        title: event.title,
        userId: event.user_id,
    }

    if (phoneNumber && event.channels.includes('kakao_alimtalk') && preference?.kakao_alimtalk_enabled) {
        if (!kakaoWebhookUrl) {
            if (!event.channels.includes('sms')) {
                return { failureReason: 'KAKAO_ALIMTALK_WEBHOOK_URL is not configured.', provider: 'kakao_alimtalk', status: 'skipped' }
            }
        } else {
            const sent = await postProviderWebhook(kakaoWebhookUrl, body)
            if (sent) return { provider: 'kakao_alimtalk', status: 'sent' }
        }
    }

    if (phoneNumber && event.channels.includes('sms') && preference?.sms_fallback_enabled) {
        if (!smsWebhookUrl) {
            return { failureReason: 'SMS_FALLBACK_WEBHOOK_URL is not configured.', provider: 'sms', status: 'skipped' }
        }
        const sent = await postProviderWebhook(smsWebhookUrl, body)
        return sent
            ? { provider: 'sms', status: 'sent' }
            : { failureReason: 'SMS provider returned a non-2xx response.', provider: 'sms', status: 'failed' }
    }

    if (event.channels.includes('in_app')) {
        return { provider: 'in_app', status: 'sent' }
    }

    if (!phoneNumber) {
        return { failureReason: '알림 수신 전화번호가 없습니다.', provider: 'none', status: 'skipped' }
    }

    return { failureReason: '외부 발송 채널이 비활성화되어 있습니다.', provider: 'in_app', status: 'skipped' }
}

Deno.serve(async (request) => {
    const options = handleOptions(request)
    if (options) return options

    if (request.method !== 'POST') {
        return jsonResponse({ message: 'Only POST requests are supported.' }, { status: 405 })
    }

    const unauthorized = requireAutomationSecret(request)
    if (unauthorized) return unauthorized

    const client = createServiceClient()
    const { data, error } = await client
        .from('notification_events')
        .select('id, user_id, title, body, channels, related_type, related_id')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(50)

    if (error) return jsonResponse({ message: 'Failed to load notification events.' }, { status: 500 })

    const events = (data || []).filter(isNotificationEventRow)
    const userIds = [...new Set(events.map((event) => event.user_id))]
    const { data: preferenceData } = await client
        .from('notification_preferences')
        .select('user_id, phone_number, kakao_alimtalk_enabled, sms_fallback_enabled')
        .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])

    const preferences = createPreferenceMap((preferenceData || []).filter(isNotificationPreferenceRow))
    let sent = 0
    let failed = 0
    let skipped = 0

    for (const event of events) {
        const result = await dispatchEvent(event, preferences.get(event.user_id))
        if (result.status === 'sent') sent += 1
        if (result.status === 'failed') failed += 1
        if (result.status === 'skipped') skipped += 1

        await client.from('notification_events').update({
            failure_reason: result.failureReason || null,
            provider: result.provider,
            sent_at: result.status === 'sent' ? new Date().toISOString() : null,
            status: result.status,
        }).eq('id', event.id)

        await client.from('operation_logs').insert({
            event_type: `notification_${result.status}`,
            target_id: event.id,
            target_type: 'notification_event',
            detail: { provider: result.provider, reason: result.failureReason || null },
        })
    }

    return jsonResponse({ failed, sent, skipped })
})
