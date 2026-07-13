import type { ServiceClient } from './types.ts'
import { isRecord } from './validation.ts'

type NotificationEventType =
    | 'deliverable_submitted'
    | 'revision_requested'
    | 'settlement_available'
    | 'settlement_requested'

type RelatedType = 'work' | 'deliverable' | 'settlement'

const notificationTemplates: Record<NotificationEventType, { readonly title: string; readonly body: string }> = {
    deliverable_submitted: { title: '결과물이 제출되었습니다', body: '작업방에서 제출물을 확인해 주세요.' },
    revision_requested: { title: '수정 요청이 등록되었습니다', body: '작업방에서 요청 내용을 확인해 주세요.' },
    settlement_available: { title: '정산 가능 금액이 생겼습니다', body: '내관리 정산 관리에서 정산을 요청할 수 있습니다.' },
    settlement_requested: { title: '정산 요청이 접수되었습니다', body: '관리자 확인 후 송금 처리됩니다.' },
}

const getDeliveryChannels = async (client: ServiceClient, targetUserId: string): Promise<readonly string[]> => {
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

export async function queueTradeNotification(
    client: ServiceClient,
    userId: string,
    type: NotificationEventType,
    relatedType: RelatedType,
    relatedId: string,
): Promise<void> {
    const template = notificationTemplates[type]
    const { error } = await client.from('notification_events').insert({
        body: template.body,
        channels: await getDeliveryChannels(client, userId),
        event_type: type,
        related_id: relatedId,
        related_type: relatedType,
        status: 'queued',
        title: template.title,
        user_id: userId,
    })
    if (!error) return
    await client.from('operation_logs').insert({
        actor_id: userId,
        detail: { eventType: type, error: error.message },
        event_type: 'notification_queue_failed',
        target_id: relatedId,
        target_type: relatedType,
    })
}
