import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, getRequiredEnv, requireUser } from '../_shared/supabase.ts'
import { cancelTossPayment, TossApiError } from '../_shared/toss.ts'

type CancelRequest = {
    readonly workId: string
    readonly reason: string
}

type AdminUserRow = {
    readonly user_id: string
}

type WorkRow = {
    readonly id: string
    readonly proposal_id: string
    readonly settlement_status: string
    readonly refund_status: string | null
}

type PaymentOrderRow = {
    readonly order_id: string
    readonly proposal_id: string
    readonly payment_key: string
    readonly status: string
}

const isCancelRequest = (value: unknown): value is CancelRequest => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<CancelRequest>
    return typeof candidate.workId === 'string'
        && candidate.workId.trim().length > 0
        && typeof candidate.reason === 'string'
        && candidate.reason.trim().length > 0
}

const isAdminUserRow = (value: unknown): value is AdminUserRow => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<AdminUserRow>
    return typeof candidate.user_id === 'string'
}

const isWorkRow = (value: unknown): value is WorkRow => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<WorkRow>
    return typeof candidate.id === 'string'
        && typeof candidate.proposal_id === 'string'
        && typeof candidate.settlement_status === 'string'
        && (typeof candidate.refund_status === 'string' || candidate.refund_status === null)
}

const isPaymentOrderRow = (value: unknown): value is PaymentOrderRow => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<PaymentOrderRow>
    return typeof candidate.order_id === 'string'
        && typeof candidate.proposal_id === 'string'
        && typeof candidate.payment_key === 'string'
        && typeof candidate.status === 'string'
}

const normalizeReason = (reason: string): string => reason.trim().slice(0, 200)

Deno.serve(async (request) => {
    const options = handleOptions(request)
    if (options) return options

    const client = createServiceClient()

    try {
        const user = await requireUser(request)
        const { data: adminUser } = await client
            .from('admin_users')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle()

        if (!isAdminUserRow(adminUser)) {
            return jsonResponse({ message: '결제 취소 권한이 없습니다.' }, { status: 403 })
        }

        const body: unknown = await request.json()
        if (!isCancelRequest(body)) {
            return jsonResponse({ message: '결제 취소 정보가 올바르지 않습니다.' }, { status: 400 })
        }

        const { data: work, error: workError } = await client
            .from('works')
            .select('id, proposal_id, settlement_status, refund_status')
            .eq('id', body.workId)
            .single()

        if (workError || !isWorkRow(work)) {
            return jsonResponse({ message: '작업방을 찾을 수 없습니다.' }, { status: 404 })
        }

        if (work.refund_status === 'refunded') {
            return jsonResponse({ workId: work.id, proposalId: work.proposal_id, status: 'refunded' })
        }

        if (work.settlement_status === 'settled') {
            return jsonResponse({ message: '이미 정산 완료된 작업은 결제 취소할 수 없습니다.' }, { status: 409 })
        }

        if (work.refund_status !== 'fee_excluded_refund_pending') {
            return jsonResponse({ message: '환불 대기 처리된 작업만 결제 취소할 수 있습니다.' }, { status: 409 })
        }

        const { data: order, error: orderError } = await client
            .from('payment_orders')
            .select('order_id, proposal_id, payment_key, status')
            .eq('proposal_id', work.proposal_id)
            .eq('status', 'approved')
            .limit(1)
            .maybeSingle()

        if (orderError || !isPaymentOrderRow(order)) {
            return jsonResponse({ message: '취소 가능한 결제 주문을 찾을 수 없습니다.' }, { status: 404 })
        }

        const cancelReason = normalizeReason(body.reason)
        const payment = await cancelTossPayment({
            secretKey: getRequiredEnv('TOSS_PAYMENTS_SECRET_KEY'),
            paymentKey: order.payment_key,
            cancelReason,
            idempotencyKey: `work-${work.id}-refund`,
        })
        const cancelledAt = payment.canceledAt || new Date().toISOString()

        await client
            .from('payment_orders')
            .update({
                status: 'refunded',
                cancel_reason: cancelReason,
                cancelled_at: cancelledAt,
                failure_code: null,
                failure_message: null,
            })
            .eq('order_id', order.order_id)

        await client
            .from('proposals')
            .update({
                payment_status: 'refunded',
                refunded_at: cancelledAt,
            })
            .eq('id', order.proposal_id)

        await client
            .from('works')
            .update({
                settlement_status: 'refunded',
                refund_status: 'refunded',
                cancelled_at: cancelledAt,
                updated_at: cancelledAt,
            })
            .eq('id', work.id)

        return jsonResponse({
            workId: work.id,
            proposalId: work.proposal_id,
            paymentStatus: payment.status,
            cancelledAt,
        })
    } catch (error) {
        if (error instanceof TossApiError) {
            return jsonResponse({ message: error.message }, { status: error.status })
        }

        const message = error instanceof Error ? error.message : '결제 취소 중 오류가 발생했습니다.'
        return jsonResponse({ message }, { status: 500 })
    }
})
