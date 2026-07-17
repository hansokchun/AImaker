import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { executeFinancialRpc, requiredString } from '../_shared/financial-contracts.ts'
import { isPaymentPolicyActive } from '../_shared/payment-policy.ts'
import { createServiceClient, getRequiredEnv, requireUser } from '../_shared/supabase.ts'
import { cancelTossPayment, TossApiError } from '../_shared/toss.ts'

type CancelRequest = { readonly workId: string; readonly reason: string }
const isCancelRequest = (value: unknown): value is CancelRequest => typeof value === 'object' && value !== null
    && 'workId' in value && typeof value.workId === 'string' && value.workId.trim().length > 0
    && 'reason' in value && typeof value.reason === 'string' && value.reason.trim().length > 0
const isAdminRow = (value: unknown): boolean => typeof value === 'object' && value !== null
    && 'user_id' in value && typeof value.user_id === 'string'
const isActiveProfile = (value: unknown): boolean => typeof value === 'object' && value !== null
    && 'account_status' in value && value.account_status === 'active'
    && 'withdrawn_at' in value && value.withdrawn_at === null

export async function handlePaymentCancel(request: Request): Promise<Response> {
    const options = handleOptions(request)
    if (options) return options
    const client = createServiceClient()
    let operationId: string | null = null
    try {
        const user = await requireUser(request)
        const { data: admin } = await client.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
        if (!isAdminRow(admin)) return jsonResponse({ message: 'Payment cancellation requires an administrator.' }, { status: 403 })
        const { data: profile } = await client.from('profiles')
            .select('account_status, withdrawn_at').eq('id', user.id).maybeSingle()
        if (!isActiveProfile(profile)) return jsonResponse({ message: 'An active administrator account is required.' }, { status: 403 })
        const body: unknown = await request.json()
        if (!isCancelRequest(body)) return jsonResponse({ message: 'Invalid payment cancellation request.' }, { status: 400 })
        const reason = body.reason.trim().slice(0, 200)
        const begun = await executeFinancialRpc(client, 'begin_payment_refund', {
            p_work_id: body.workId, p_actor_id: user.id, p_reason: reason,
            p_policy_authorized: isPaymentPolicyActive(),
            p_business_key: `refund:${body.workId}`,
        })
        if (begun.kind === 'completed') return jsonResponse({ workId: body.workId, status: 'refunded' })
        operationId = requiredString(begun, 'operationId')
        if (begun.kind === 'manual_review') {
            return jsonResponse({ message: 'Refund is held for manual review.', operationId, status: 'manual_review' }, { status: 202 })
        }
        const payment = await cancelTossPayment({
            secretKey: getRequiredEnv('TOSS_PAYMENTS_SECRET_KEY'),
            paymentKey: requiredString(begun, 'paymentKey'), cancelReason: reason,
            idempotencyKey: `work-${body.workId}-refund`,
        })
        const finalized = await executeFinancialRpc(client, 'finalize_payment_refund', {
            p_operation_id: operationId, p_provider_status: payment.status,
            p_cancelled_at: payment.canceledAt ?? null, p_reason: reason,
        })
        return jsonResponse({ ...finalized, paymentStatus: payment.status }, { status: finalized.kind === 'manual_review' ? 202 : 200 })
    } catch (error) {
        if (operationId) {
            try {
                await executeFinancialRpc(client, 'record_financial_reconciliation', {
                    p_operation_id: operationId,
                    p_reason: 'payment_refund_outcome_uncertain',
                    p_failure_code: error instanceof TossApiError ? 'PROVIDER_REQUEST_FAILED' : 'DB_FINALIZE_FAILED',
                    p_failure_message: 'Payment refund requires reconciliation',
                })
            } catch {
                return jsonResponse({ message: 'Refund reconciliation could not be recorded.', operationId }, { status: 500 })
            }
        }
        return error instanceof TossApiError
            ? jsonResponse({ message: 'Payment refund is pending reconciliation.', operationId, status: 'retry_required' }, { status: 502 })
            : jsonResponse({ message: 'Payment refund could not be finalized.', operationId }, { status: 500 })
    }
}

if (import.meta.main) Deno.serve(handlePaymentCancel)
