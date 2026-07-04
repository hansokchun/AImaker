import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, getRequiredEnv, requireUser } from '../_shared/supabase.ts'
import { confirmTossPayment, TossApiError } from '../_shared/toss.ts'

type ConfirmRequest = {
    readonly paymentKey: string
    readonly orderId: string
    readonly amount: number
}

type PaymentOrderRow = {
    readonly order_id: string
    readonly proposal_id: string
    readonly client_id: string
    readonly amount: number
    readonly status: string
}

const isConfirmRequest = (value: unknown): value is ConfirmRequest => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<ConfirmRequest>
    return typeof candidate.paymentKey === 'string'
        && typeof candidate.orderId === 'string'
        && typeof candidate.amount === 'number'
        && Number.isInteger(candidate.amount)
}

const isPaymentOrderRow = (value: unknown): value is PaymentOrderRow => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<PaymentOrderRow>
    return typeof candidate.order_id === 'string'
        && typeof candidate.proposal_id === 'string'
        && typeof candidate.client_id === 'string'
        && typeof candidate.amount === 'number'
        && typeof candidate.status === 'string'
}

Deno.serve(async (request) => {
    const options = handleOptions(request)
    if (options) return options

    const client = createServiceClient()

    try {
        const body: unknown = await request.json()
        if (!isConfirmRequest(body)) {
            return jsonResponse({ message: '결제 승인 정보가 올바르지 않습니다.' }, { status: 400 })
        }

        const user = await requireUser(request)
        const { data: order, error } = await client
            .from('payment_orders')
            .select('order_id, proposal_id, client_id, amount, status')
            .eq('order_id', body.orderId)
            .single()

        if (error || !isPaymentOrderRow(order)) {
            return jsonResponse({ message: '결제 주문을 찾을 수 없습니다.' }, { status: 404 })
        }

        if (order.client_id !== user.id) {
            return jsonResponse({ message: '결제 승인 권한이 없습니다.' }, { status: 403 })
        }

        if (order.status === 'approved') {
            return jsonResponse({ proposalId: order.proposal_id })
        }

        if (order.status !== 'ready' || order.amount !== body.amount) {
            return jsonResponse({ message: '결제 주문 상태 또는 금액이 일치하지 않습니다.' }, { status: 409 })
        }

        const payment = await confirmTossPayment({
            secretKey: getRequiredEnv('TOSS_PAYMENTS_SECRET_KEY'),
            paymentKey: body.paymentKey,
            orderId: body.orderId,
            amount: body.amount,
        })

        if (payment.status !== 'DONE' || payment.totalAmount !== order.amount) {
            return jsonResponse({ message: '토스페이먼츠 승인 결과가 주문 정보와 일치하지 않습니다.' }, { status: 409 })
        }

        const approvedAt = payment.approvedAt || new Date().toISOString()
        await client
            .from('payment_orders')
            .update({
                status: 'approved',
                payment_key: payment.paymentKey,
                approved_at: approvedAt,
            })
            .eq('order_id', order.order_id)

        await client
            .from('proposals')
            .update({
                status: 'accepted',
                payment_status: 'paid',
                paid_at: approvedAt,
            })
            .eq('id', order.proposal_id)

        return jsonResponse({ proposalId: order.proposal_id })
    } catch (error) {
        if (error instanceof TossApiError) {
            return jsonResponse({ message: error.message }, { status: error.status })
        }

        const message = error instanceof Error ? error.message : '결제 승인 중 오류가 발생했습니다.'
        return jsonResponse({ message }, { status: 500 })
    }
})
