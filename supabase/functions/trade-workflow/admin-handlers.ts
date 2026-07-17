import { executeFinancialRpc } from '../_shared/financial-contracts.ts'
import { ok, responseError } from './responses.ts'
import type { AdminActionPayload, ServiceClient } from './types.ts'
import { isRecord } from './validation.ts'
import { isPaymentPolicyActive, paymentPolicyUnavailableResponse } from '../_shared/payment-policy.ts'

const financialActions = new Set([
    'cancel_trade',
    'hold_settlement',
    'mark_refund_pending',
    'mark_settlement_pending',
    'mark_settlement_settled',
])

export async function runAdminAction(client: ServiceClient, userId: string, action: AdminActionPayload): Promise<Response> {
    const { data: admin } = await client.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle()
    if (!isRecord(admin)) return responseError('관리자 권한이 없습니다.', 403)
    const { data: profile } = await client.from('profiles').select('id').eq('id', userId).eq('account_status', 'active').is('withdrawn_at', null).maybeSingle()
    if (!isRecord(profile)) return responseError('활성 관리자 계정이 필요합니다.', 403)
    if (action.actionType === 'execute_toss_refund') {
        return responseError('토스 환불 실행은 toss-payment-cancel 함수로 처리합니다.', 409)
    }

    if (action.targetType === 'work' && financialActions.has(action.actionType)) {
        if (!isPaymentPolicyActive()) return paymentPolicyUnavailableResponse()
        const result = await executeFinancialRpc(client, 'apply_admin_financial_transition', {
            p_work_id: action.targetId,
            p_admin_id: userId,
            p_action: action.actionType,
            p_reason: action.reason,
            p_business_key: `admin-financial:${action.actionType}:${action.targetId}`,
            p_policy_authorized: true,
        })
        return ok({ workId: action.targetId, operationId: result.operationId })
    }

    const result = await client.rpc('apply_admin_moderation_action', {
        action_type_value: action.actionType,
        admin_user_id: userId,
        reason_value: action.reason,
        target_id_value: action.targetId,
        target_type_value: action.targetType,
    })
    return result.error
        ? responseError('관리자 조치 적용 또는 감사 기록에 실패했습니다.', 500)
        : ok({ targetId: action.targetId })
}
