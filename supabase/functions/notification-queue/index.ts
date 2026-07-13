import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, requireUser } from '../_shared/supabase.ts'

type NotificationEventType =
    | 'payment_completed'
    | 'workroom_created'
    | 'deliverable_submitted'
    | 'revision_requested'
    | 'settlement_available'
    | 'settlement_requested'
    | 'settlement_paid'

type RelatedType = 'proposal' | 'work' | 'deliverable' | 'settlement'

type QueueNotificationPayload = {
    readonly userId: string
    readonly type: NotificationEventType
    readonly relatedType: RelatedType
    readonly relatedId?: string
}

const notificationTemplates: Record<NotificationEventType, { readonly title: string; readonly body: string }> = {
    payment_completed: { title: '결제가 완료되었습니다', body: '결제가 확인되어 작업방이 열렸습니다.' },
    workroom_created: { title: '작업방이 생성되었습니다', body: '거래 참여자와 작업 진행을 시작할 수 있습니다.' },
    deliverable_submitted: { title: '결과물이 제출되었습니다', body: '작업방에서 제출물을 확인해 주세요.' },
    revision_requested: { title: '수정 요청이 등록되었습니다', body: '작업방에서 요청 내용을 확인해 주세요.' },
    settlement_available: { title: '정산 가능 금액이 생겼습니다', body: '내관리 정산 관리에서 정산을 요청할 수 있습니다.' },
    settlement_requested: { title: '정산 요청이 접수되었습니다', body: '관리자 확인 후 송금 처리됩니다.' },
    settlement_paid: { title: '정산 송금이 완료되었습니다', body: '등록한 계좌의 입금 내역을 확인해 주세요.' },
}

const allowedTypesByRelatedType: Record<RelatedType, ReadonlySet<NotificationEventType>> = {
    proposal: new Set(['payment_completed', 'revision_requested']),
    work: new Set(['payment_completed', 'workroom_created', 'deliverable_submitted', 'revision_requested', 'settlement_available', 'settlement_requested', 'settlement_paid']),
    deliverable: new Set(['deliverable_submitted', 'revision_requested']),
    settlement: new Set(['settlement_available', 'settlement_requested', 'settlement_paid']),
}

const notificationTypes: ReadonlySet<string> = new Set(Object.keys(notificationTemplates))
const relatedTypes: ReadonlySet<string> = new Set(Object.keys(allowedTypesByRelatedType))

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isNotificationEventType = (value: unknown): value is NotificationEventType =>
    typeof value === 'string' && notificationTypes.has(value)

const isRelatedType = (value: unknown): value is RelatedType =>
    typeof value === 'string' && relatedTypes.has(value)

const isPayload = (value: unknown): value is QueueNotificationPayload => {
    if (!isRecord(value)) return false
    return typeof value.userId === 'string'
        && isNotificationEventType(value.type)
        && isRelatedType(value.relatedType)
        && (value.relatedId === undefined || typeof value.relatedId === 'string')
        && allowedTypesByRelatedType[value.relatedType].has(value.type)
}

const isUuid = (value: string): boolean =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const includesUser = (record: Record<string, unknown>, userId: string): boolean =>
    record.client_id === userId || record.expert_id === userId

const getDeliveryChannels = async (
    client: ReturnType<typeof createServiceClient>,
    targetUserId: string,
): Promise<readonly string[]> => {
    const { data } = await client
        .from('notification_preferences')
        .select('phone_number, kakao_alimtalk_enabled, sms_fallback_enabled')
        .eq('user_id', targetUserId)
        .maybeSingle()
    if (!isRecord(data) || typeof data.phone_number !== 'string' || data.phone_number.trim().length === 0) {
        return ['in_app']
    }
    const channels = ['in_app']
    if (data.kakao_alimtalk_enabled === true) channels.push('kakao_alimtalk')
    if (data.sms_fallback_enabled === true) channels.push('sms')
    return channels
}

const canQueueForRelatedRecord = async (
    client: ReturnType<typeof createServiceClient>,
    actorId: string,
    targetUserId: string,
    relatedType: RelatedType,
    relatedId: string | undefined,
): Promise<boolean> => {
    if (!relatedId || !isUuid(relatedId)) return false

    if (relatedType === 'work' || relatedType === 'settlement') {
        const { data } = await client
            .from('works')
            .select('client_id, expert_id')
            .eq('id', relatedId)
            .maybeSingle()
        return isRecord(data) && includesUser(data, actorId) && includesUser(data, targetUserId)
    }

    if (relatedType === 'deliverable') {
        const { data } = await client
            .from('deliverables')
            .select('works(client_id, expert_id)')
            .eq('id', relatedId)
            .maybeSingle()
        const works = isRecord(data) && isRecord(data.works) ? data.works : null
        return Boolean(works && includesUser(works, actorId) && includesUser(works, targetUserId))
    }

    if (relatedType === 'proposal') {
        const { data } = await client
            .from('proposals')
            .select('client_id, expert_id')
            .eq('id', relatedId)
            .maybeSingle()
        return isRecord(data) && includesUser(data, actorId) && includesUser(data, targetUserId)
    }

    return false
}

Deno.serve(async (request) => {
    const options = handleOptions(request)
    if (options) return options

    if (request.method !== 'POST') {
        return jsonResponse({ message: 'Only POST requests are supported.' }, { status: 405 })
    }

    let userId = ''
    try {
        const user = await requireUser(request)
        userId = user.id
    } catch {
        return jsonResponse({ message: 'Authenticated user is required.' }, { status: 401 })
    }

    const payload: unknown = await request.json()
    if (!isPayload(payload)) return jsonResponse({ message: 'Notification payload is invalid.' }, { status: 400 })

    const client = createServiceClient()
    const allowed = await canQueueForRelatedRecord(client, userId, payload.userId, payload.relatedType, payload.relatedId)
    if (!allowed) return jsonResponse({ message: 'Notification queue permission denied.' }, { status: 403 })

    const template = notificationTemplates[payload.type]
    const channels = await getDeliveryChannels(client, payload.userId)
    const { data, error } = await client.from('notification_events').insert({
        body: template.body,
        channels,
        event_type: payload.type,
        related_id: payload.relatedId || null,
        related_type: payload.relatedType,
        status: 'queued',
        title: template.title,
        user_id: payload.userId,
    }).select().single()

    if (error) return jsonResponse({ message: 'Failed to queue notification.' }, { status: 500 })
    return jsonResponse(data)
})
