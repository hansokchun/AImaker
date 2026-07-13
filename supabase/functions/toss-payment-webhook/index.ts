import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { repairApprovedPayment, type PaymentWorkflowResult } from '../_shared/payment-workflow.ts'
import { createServiceClient, getRequiredEnv } from '../_shared/supabase.ts'
import { getTossPaymentByOrderId, TossApiError } from '../_shared/toss.ts'

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

const isFailureStatus = (status: string): boolean =>
    status === 'CANCELED' || status === 'PARTIAL_CANCELED' || status === 'EXPIRED' || status === 'ABORTED'

const paymentWorkflowFailureResponse = (result: PaymentWorkflowResult): Response | null => {
    if (result.kind === 'ok') return null
    return jsonResponse({ message: result.message }, { status: result.status })
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
            const failureResponse = paymentWorkflowFailureResponse(await repairApprovedPayment({ client, payment }))
            if (failureResponse) return failureResponse
        } else if (isFailureStatus(payment.status)) {
            const { error: failedOrderUpdateError } = await client
                .from('payment_orders')
                .update({
                    status: 'failed',
                    payment_key: payment.paymentKey,
                    failure_code: payment.status,
                    failure_message: '토스페이먼츠 결제 상태 변경 webhook으로 실패 상태가 반영되었습니다.',
                })
                .eq('order_id', payment.orderId)

            if (failedOrderUpdateError) {
                return jsonResponse({ message: 'Webhook 결제 실패 상태 반영에 실패했습니다.' }, { status: 500 })
            }
        }

        return jsonResponse({ received: true })
    } catch (error) {
        if (error instanceof TossApiError) {
            return jsonResponse({ message: error.message }, { status: error.status })
        }

        const message = error instanceof Error ? error.message : 'Webhook 처리 중 오류가 발생했습니다.'
        return jsonResponse({ message }, { status: 500 })
    }
})
