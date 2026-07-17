import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { executeFinancialRpc, optionalString, requiredString } from '../_shared/financial-contracts.ts'
import { isPaymentPolicyActive, paymentPolicyUnavailableResponse } from '../_shared/payment-policy.ts'
import { createServiceClient, getRequiredEnv, requireUser } from '../_shared/supabase.ts'
import { confirmTossPayment, TossApiError } from '../_shared/toss.ts'

type ConfirmRequest = { readonly paymentKey: string; readonly orderId: string; readonly amount: number }
const isConfirmRequest = (value: unknown): value is ConfirmRequest => typeof value === 'object' && value !== null
    && 'paymentKey' in value && typeof value.paymentKey === 'string' && value.paymentKey.trim().length > 0 && value.paymentKey.length <= 200
    && 'orderId' in value && typeof value.orderId === 'string' && value.orderId.trim().length > 0 && value.orderId.length <= 128
    && 'amount' in value && typeof value.amount === 'number' && Number.isInteger(value.amount) && value.amount > 0

export async function handlePaymentConfirm(request: Request): Promise<Response> {
    const options = handleOptions(request)
    if (options) return options
    let client: ReturnType<typeof createServiceClient> | null = null
    let operationId: string | null = null
    try {
        const body: unknown = await request.json()
        if (!isConfirmRequest(body)) return jsonResponse({ message: 'Invalid payment confirmation request.' }, { status: 400 })
        if (!isPaymentPolicyActive()) return paymentPolicyUnavailableResponse()
        const user = await requireUser(request)
        client = createServiceClient()
        const begun = await executeFinancialRpc(client, 'begin_payment_confirmation', {
            p_order_id: body.orderId, p_client_id: user.id, p_payment_key: body.paymentKey,
            p_amount: body.amount, p_currency: 'KRW', p_business_key: `confirm:${body.orderId}:${body.paymentKey}`,
        })
        if (begun.kind === 'completed') return jsonResponse({ status: 'approved', orderId: body.orderId })
        operationId = requiredString(begun, 'operationId')
        const payment = await confirmTossPayment({
            secretKey: getRequiredEnv('TOSS_PAYMENTS_SECRET_KEY'), paymentKey: body.paymentKey,
            orderId: body.orderId, amount: body.amount,
        })
        const finalized = await executeFinancialRpc(client, 'finalize_payment_confirmation', {
            p_operation_id: operationId, p_provider_status: payment.status, p_payment_key: payment.paymentKey,
            p_order_id: payment.orderId, p_amount: payment.totalAmount, p_currency: 'KRW',
            p_approved_at: payment.approvedAt ?? null,
        })
        if (finalized.kind === 'manual_review') return jsonResponse({ message: 'Payment requires manual review.', operationId }, { status: 202 })
        return jsonResponse({ proposalId: optionalString(finalized, 'proposalId'), workId: optionalString(finalized, 'workId'), operationId })
    } catch (error) {
        if (operationId && client) {
            try {
                await executeFinancialRpc(client, 'record_financial_reconciliation', {
                    p_operation_id: operationId,
                    p_reason: 'payment_confirmation_outcome_uncertain',
                    p_failure_code: error instanceof TossApiError ? 'PROVIDER_REQUEST_FAILED' : 'DB_FINALIZE_FAILED',
                    p_failure_message: 'Payment confirmation requires reconciliation',
                })
            } catch {
                return jsonResponse({ message: 'Payment reconciliation could not be recorded.', operationId }, { status: 500 })
            }
        }
        return error instanceof TossApiError
            ? jsonResponse({ message: 'Payment confirmation is pending reconciliation.', operationId, status: 'retry_required' }, { status: 502 })
            : jsonResponse({ message: 'Payment confirmation could not be finalized.', operationId }, { status: 500 })
    }
}

if (import.meta.main) Deno.serve(handlePaymentConfirm)
