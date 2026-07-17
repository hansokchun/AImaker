import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { executeFinancialRpc } from '../_shared/financial-contracts.ts'
import { createServiceClient, getRequiredEnv, requireUser } from '../_shared/supabase.ts'
import { getTossPaymentByOrderId, TossApiError } from '../_shared/toss.ts'

type FailRequest = { readonly orderId: string; readonly code?: string; readonly message?: string }
const isFailRequest = (value: unknown): value is FailRequest => typeof value === 'object' && value !== null
    && 'orderId' in value && typeof value.orderId === 'string'
    && /^[A-Za-z0-9_-]{1,128}$/.test(value.orderId)
    && (!('code' in value) || value.code === undefined || (typeof value.code === 'string' && value.code.length <= 100))
    && (!('message' in value) || value.message === undefined || (typeof value.message === 'string' && value.message.length <= 500))

export async function handlePaymentFail(request: Request): Promise<Response> {
    const options = handleOptions(request)
    if (options) return options
    try {
        const body: unknown = await request.json()
        if (!isFailRequest(body)) return jsonResponse({ message: 'Invalid payment failure request.' }, { status: 400 })
        const user = await requireUser(request)
        const client = createServiceClient()
        const { data: ownedOrder } = await client.from('payment_orders').select('id, status')
            .eq('order_id', body.orderId).eq('client_id', user.id).maybeSingle()
        if (!ownedOrder || ownedOrder.status !== 'ready') {
            return jsonResponse({ message: 'A ready payment order owned by the caller is required.' }, { status: 404 })
        }
        const payment = await getTossPaymentByOrderId({
            secretKey: getRequiredEnv('TOSS_PAYMENTS_SECRET_KEY'),
            orderId: body.orderId,
        })
        if (payment.status !== 'EXPIRED' && payment.status !== 'ABORTED') {
            return jsonResponse({ status: 'provider_state_requires_reconciliation' }, { status: 202 })
        }
        const result = await executeFinancialRpc(client, 'record_payment_failure', {
            p_order_id: payment.orderId,
            p_client_id: user.id,
            p_failure_code: payment.status,
            p_failure_message: 'Verified terminal provider status',
            p_business_key: `failure:${payment.orderId}`,
        })
        return jsonResponse({ status: result.status ?? result.kind })
    } catch (error) {
        return error instanceof TossApiError
            ? jsonResponse({ message: 'Payment provider status could not be verified.' }, { status: 502 })
            : jsonResponse({ message: 'Payment failure could not be recorded.' }, { status: 409 })
    }
}

if (import.meta.main) Deno.serve(handlePaymentFail)
