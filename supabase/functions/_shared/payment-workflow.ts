import { executeFinancialRpc, optionalString, requiredString } from './financial-contracts.ts'
import { isPaymentPolicyActive } from './payment-policy.ts'
import type { createServiceClient } from './supabase.ts'
import type { TossPayment } from './toss.ts'

type ServiceClient = ReturnType<typeof createServiceClient>

export type PaymentWorkflowResult =
    | { readonly kind: 'ok'; readonly proposalId: string | null; readonly workId: string | null }
    | { readonly kind: 'manual_review'; readonly operationId: string }

export type ApprovedPaymentRepairInput = {
    readonly client: ServiceClient
    readonly clientId: string
    readonly payment: Pick<TossPayment, 'paymentKey' | 'orderId' | 'status' | 'totalAmount' | 'approvedAt'>
}

export async function repairApprovedPayment(input: ApprovedPaymentRepairInput): Promise<PaymentWorkflowResult> {
    if (!isPaymentPolicyActive()) throw new Error('Payment policy approval is required')
    const begun = await executeFinancialRpc(input.client, 'begin_payment_confirmation', {
        p_order_id: input.payment.orderId,
        p_client_id: input.clientId,
        p_payment_key: input.payment.paymentKey,
        p_amount: input.payment.totalAmount,
        p_currency: 'KRW',
        p_business_key: `confirm:${input.payment.orderId}:${input.payment.paymentKey}`,
    })
    if (begun.kind === 'completed') {
        return { kind: 'ok', proposalId: optionalString(begun, 'proposalId'), workId: optionalString(begun, 'workId') }
    }
    const operationId = requiredString(begun, 'operationId')
    const finalized = await executeFinancialRpc(input.client, 'finalize_payment_confirmation', {
        p_operation_id: operationId,
        p_provider_status: input.payment.status,
        p_payment_key: input.payment.paymentKey,
        p_order_id: input.payment.orderId,
        p_amount: input.payment.totalAmount,
        p_currency: 'KRW',
        p_approved_at: input.payment.approvedAt ?? null,
    })
    if (finalized.kind === 'manual_review') return { kind: 'manual_review', operationId }
    return { kind: 'ok', proposalId: optionalString(finalized, 'proposalId'), workId: optionalString(finalized, 'workId') }
}
