import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, requireUser } from '../_shared/supabase.ts'

type FailRequest = {
    readonly orderId: string
    readonly code?: string
    readonly message?: string
}

type PaymentOrderRow = {
    readonly order_id: string
    readonly client_id: string
    readonly status: string
}

const isFailRequest = (value: unknown): value is FailRequest => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<FailRequest>
    return typeof candidate.orderId === 'string'
        && candidate.orderId.trim().length > 0
        && (candidate.code === undefined || typeof candidate.code === 'string')
        && (candidate.message === undefined || typeof candidate.message === 'string')
}

const isPaymentOrderRow = (value: unknown): value is PaymentOrderRow => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<PaymentOrderRow>
    return typeof candidate.order_id === 'string'
        && typeof candidate.client_id === 'string'
        && typeof candidate.status === 'string'
}

Deno.serve(async (request) => {
    const options = handleOptions(request)
    if (options) return options

    const client = createServiceClient()

    try {
        const body: unknown = await request.json()
        if (!isFailRequest(body)) {
            return jsonResponse({ message: '결제 실패 정보가 올바르지 않습니다.' }, { status: 400 })
        }

        const user = await requireUser(request)
        const { data: order, error } = await client
            .from('payment_orders')
            .select('order_id, client_id, status')
            .eq('order_id', body.orderId)
            .single()

        if (error || !isPaymentOrderRow(order)) {
            return jsonResponse({ message: '결제 주문을 찾을 수 없습니다.' }, { status: 404 })
        }

        if (order.client_id !== user.id) {
            return jsonResponse({ message: '결제 실패 기록 권한이 없습니다.' }, { status: 403 })
        }

        if (order.status === 'approved') {
            return jsonResponse({ status: 'approved' })
        }

        const failureCode = body.code?.trim() || 'PAYMENT_FAILED'
        const failureMessage = body.message?.trim() || '결제가 완료되지 않았습니다.'
        const { error: updateError } = await client
            .from('payment_orders')
            .update({
                status: 'failed',
                failure_code: failureCode,
                failure_message: failureMessage,
            })
            .eq('order_id', order.order_id)

        if (updateError) {
            return jsonResponse({ message: '결제 실패 상태 저장에 실패했습니다.' }, { status: 500 })
        }

        return jsonResponse({ status: 'failed' })
    } catch (error) {
        const message = error instanceof Error ? error.message : '결제 실패 처리 중 오류가 발생했습니다.'
        return jsonResponse({ message }, { status: 500 })
    }
})
