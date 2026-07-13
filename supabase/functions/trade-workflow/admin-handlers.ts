import { ok, responseError } from './responses.ts'
import type { AdminActionPayload, RowRecord, ServiceClient } from './types.ts'
import { isRecord } from './validation.ts'

export async function runAdminAction(client: ServiceClient, userId: string, action: AdminActionPayload): Promise<Response> {
    const { data: admin } = await client.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle()
    if (!isRecord(admin)) return responseError('관리자 권한이 없습니다.', 403)
    if (action.targetType !== 'work') return responseError('지원하지 않는 관리자 거래 작업입니다.', 400)
    const now = new Date().toISOString()
    const actionRecord = {
        admin_id: userId,
        target_type: action.targetType,
        target_id: action.targetId,
        action_type: action.actionType,
        reason: action.reason,
        created_at: now,
    }

    let update: RowRecord | null = null
    switch (action.actionType) {
        case 'cancel_trade':
            update = { status: 'cancelled', refund_status: 'fee_excluded_refund_pending', cancellation_reason: 'mutual_after_start', cancelled_at: now }
            break
        case 'mark_settlement_pending':
            update = { settlement_status: 'pending', settlement_hold_reason: null }
            break
        case 'mark_settlement_settled':
            update = { settlement_status: 'settled', refund_status: null, settlement_hold_reason: null, settlement_settled_at: now }
            break
        case 'hold_settlement':
            update = { settlement_status: 'pending', settlement_hold_reason: action.reason }
            break
        case 'mark_refund_pending':
            update = { settlement_status: 'refunded', refund_status: 'fee_excluded_refund_pending' }
            break
        case 'open_dispute':
            update = { dispute_status: 'open' }
            break
        case 'resolve_dispute':
            update = { dispute_status: 'resolved' }
            break
        case 'execute_toss_refund':
            return responseError('토스 환불 실행은 toss-payment-cancel 함수로 처리합니다.', 409)
        default:
            return responseError('지원하지 않는 관리자 거래 작업입니다.', 400)
    }

    const workResult = await client.from('works').update({ ...update, updated_at: now }).eq('id', action.targetId)
    if (workResult.error) return responseError('관리자 거래 상태 변경에 실패했습니다.', 500)
    if (action.actionType === 'mark_settlement_settled') {
        const payoutResult = await client.from('settlement_payouts').update({ status: 'paid', processed_at: now, updated_at: now }).eq('work_id', action.targetId)
        if (payoutResult.error) return responseError('정산 지급 상태 변경에 실패했습니다.', 500)
    }
    const auditResult = await client.from('admin_actions').insert(actionRecord)
    return auditResult.error ? responseError('관리자 작업 기록에 실패했습니다.', 500) : ok({ workId: action.targetId })
}
