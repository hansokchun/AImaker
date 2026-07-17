import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { executeFinancialRpc, requiredNumber, requiredString } from '../_shared/financial-contracts.ts'
import { isPaymentPolicyActive, paymentPolicyUnavailableResponse } from '../_shared/payment-policy.ts'
import { getPlatformFeeRate } from '../_shared/settlement.ts'
import { createServiceClient, requireUser } from '../_shared/supabase.ts'

type OrderRequest = { readonly proposalId: string }
const isOrderRequest = (value: unknown): value is OrderRequest => typeof value === 'object' && value !== null
    && 'proposalId' in value && typeof value.proposalId === 'string'
    && /^[0-9a-f-]{36}$/i.test(value.proposalId)

export async function handlePaymentOrder(request: Request): Promise<Response> {
    const options = handleOptions(request)
    if (options) return options
    try {
        const body: unknown = await request.json()
        if (!isOrderRequest(body)) return jsonResponse({ message: 'A valid proposalId is required.' }, { status: 400 })
        if (!isPaymentPolicyActive()) return paymentPolicyUnavailableResponse()
        const user = await requireUser(request)
        const orderId = crypto.randomUUID()
        const result = await executeFinancialRpc(createServiceClient(), 'begin_payment_order', {
            p_proposal_id: body.proposalId,
            p_client_id: user.id,
            p_order_id: orderId,
            p_order_name: `proposal-${body.proposalId} payment`,
            p_platform_fee_rate: getPlatformFeeRate(),
        })
        return jsonResponse({
            orderId: requiredString(result, 'orderId'),
            orderName: requiredString(result, 'orderName'),
            amount: requiredNumber(result, 'amount'),
            currency: requiredString(result, 'currency'),
        })
    } catch {
        return jsonResponse({ message: 'Payment order could not be created.' }, { status: 409 })
    }
}

if (import.meta.main) Deno.serve(handlePaymentOrder)
