import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, getRequiredEnv } from '../_shared/supabase.ts'
import { getTossPaymentByOrderId } from '../_shared/toss.ts'

type TossWebhookPayload = {
    readonly eventType?: string
    readonly data?: {
        readonly orderId?: string
        readonly status?: string
        readonly paymentKey?: string
        readonly approvedAt?: string
    }
}

const isWebhookPayload = (value: unknown): value is TossWebhookPayload => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as TossWebhookPayload
    return typeof candidate.data?.orderId === 'string'
}

Deno.serve(async (request) => {
    const options = handleOptions(request)
    if (options) return options

    try {
        const payload: unknown = await request.json()
        if (!isWebhookPayload(payload)) {
            return jsonResponse({ message: 'Webhook payload가 올바르지 않습니다.' }, { status: 400 })
        }

        const orderId = payload.data.orderId
        const payment = await getTossPaymentByOrderId({
            secretKey: getRequiredEnv('TOSS_PAYMENTS_SECRET_KEY'),
            orderId,
        })
        const client = createServiceClient()

        if (payment.status === 'DONE') {
            const approvedAt = payment.approvedAt || new Date().toISOString()
            const { data: order } = await client
                .from('payment_orders')
                .update({
                    status: 'approved',
                    payment_key: payment.paymentKey,
                    approved_at: approvedAt,
                })
                .eq('order_id', payment.orderId)
                .select('proposal_id')
                .single()

            if (order?.proposal_id) {
                await client
                    .from('proposals')
                    .update({
                        status: 'accepted',
                        payment_status: 'paid',
                        paid_at: approvedAt,
                    })
                    .eq('id', order.proposal_id)
            }
        }

        if (['CANCELED', 'PARTIAL_CANCELED', 'EXPIRED', 'ABORTED'].includes(payment.status)) {
            await client
                .from('payment_orders')
                .update({
                    status: 'failed',
                    payment_key: payment.paymentKey,
                    failure_code: payment.status,
                    failure_message: '토스페이먼츠 결제 상태 변경 webhook으로 실패 상태가 반영되었습니다.',
                })
                .eq('order_id', payment.orderId)
        }

        return jsonResponse({ received: true })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Webhook 처리 중 오류가 발생했습니다.'
        return jsonResponse({ message }, { status: 500 })
    }
})
