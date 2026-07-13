import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { repairApprovedPayment, type PaymentWorkflowResult } from '../_shared/payment-workflow.ts'
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
    readonly platform_fee_rate: number
    readonly platform_fee: number
    readonly expert_payout: number
    readonly status: string
    readonly payment_key: string | null
    readonly approved_at: string | null
}

type ProposalRow = {
    readonly id: string
    readonly client_id: string
    readonly total_price: number
    readonly status: string
    readonly payment_status: string
    readonly expires_at: string
}

const isConfirmRequest = (value: unknown): value is ConfirmRequest => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<ConfirmRequest>
    return typeof candidate.paymentKey === 'string'
        && candidate.paymentKey.trim().length > 0
        && typeof candidate.orderId === 'string'
        && candidate.orderId.trim().length > 0
        && typeof candidate.amount === 'number'
        && Number.isInteger(candidate.amount)
        && candidate.amount > 0
}

const isPaymentOrderRow = (value: unknown): value is PaymentOrderRow => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<PaymentOrderRow>
    return typeof candidate.order_id === 'string'
        && typeof candidate.proposal_id === 'string'
        && typeof candidate.client_id === 'string'
        && typeof candidate.amount === 'number'
        && typeof candidate.platform_fee_rate === 'number'
        && typeof candidate.platform_fee === 'number'
        && typeof candidate.expert_payout === 'number'
        && typeof candidate.status === 'string'
        && (typeof candidate.payment_key === 'string' || candidate.payment_key === null)
        && (typeof candidate.approved_at === 'string' || candidate.approved_at === null)
}

const isProposalRow = (value: unknown): value is ProposalRow => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<ProposalRow>
    return typeof candidate.id === 'string'
        && typeof candidate.client_id === 'string'
        && typeof candidate.total_price === 'number'
        && typeof candidate.status === 'string'
        && typeof candidate.payment_status === 'string'
        && typeof candidate.expires_at === 'string'
}

const isPayableProposalStatus = (status: string): boolean => status === 'sent' || status === 'revision_requested'

const paymentWorkflowResponse = (result: PaymentWorkflowResult): Response => {
    if (result.kind === 'ok') {
        return jsonResponse({ proposalId: result.proposalId, workId: result.workId })
    }
    return jsonResponse({ message: result.message }, { status: result.status })
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
            .select(
                'order_id, proposal_id, client_id, amount, platform_fee_rate, platform_fee, expert_payout, status, payment_key, approved_at',
            )
            .eq('order_id', body.orderId)
            .maybeSingle()

        if (error) {
            return jsonResponse({ message: '결제 주문 조회에 실패했습니다.' }, { status: 500 })
        }

        if (!order) {
            return jsonResponse({ message: '결제 주문을 찾을 수 없습니다.' }, { status: 404 })
        }

        if (!isPaymentOrderRow(order)) {
            return jsonResponse({ message: '결제 주문 조회 결과가 올바르지 않습니다.' }, { status: 500 })
        }

        if (order.client_id !== user.id) {
            return jsonResponse({ message: '결제 승인 권한이 없습니다.' }, { status: 403 })
        }

        if (order.amount !== body.amount) {
            return jsonResponse({ message: '결제 주문 금액이 일치하지 않습니다.' }, { status: 409 })
        }

        if (order.status === 'approved') {
            if (order.payment_key && order.payment_key !== body.paymentKey) {
                return jsonResponse({ message: '결제 키가 기존 승인 주문과 일치하지 않습니다.' }, { status: 409 })
            }

            const result = await repairApprovedPayment({
                client,
                payment: {
                    paymentKey: order.payment_key || body.paymentKey,
                    orderId: order.order_id,
                    totalAmount: order.amount,
                    approvedAt: order.approved_at || undefined,
                },
            })
            return paymentWorkflowResponse(result)
        }

        if (order.status !== 'ready') {
            return jsonResponse({ message: '결제 주문 상태가 승인할 수 없는 상태입니다.' }, { status: 409 })
        }

        const { data: proposal, error: proposalFetchError } = await client
            .from('proposals')
            .select('id, client_id, total_price, status, payment_status, expires_at')
            .eq('id', order.proposal_id)
            .maybeSingle()

        if (proposalFetchError) {
            return jsonResponse({ message: '결제할 제안서 조회에 실패했습니다.' }, { status: 500 })
        }

        if (!proposal) {
            return jsonResponse({ message: '결제할 제안서를 찾을 수 없습니다.' }, { status: 404 })
        }

        if (!isProposalRow(proposal)) {
            return jsonResponse({ message: '결제할 제안서 조회 결과가 올바르지 않습니다.' }, { status: 500 })
        }

        if (proposal.client_id !== user.id) {
            return jsonResponse({ message: '제안서 결제 권한이 없습니다.' }, { status: 403 })
        }

        if (proposal.client_id !== order.client_id || proposal.total_price !== order.amount) {
            return jsonResponse({ message: '제안서 정보가 결제 주문과 일치하지 않습니다.' }, { status: 409 })
        }

        if (!isPayableProposalStatus(proposal.status) || proposal.payment_status !== 'unpaid') {
            return jsonResponse({ message: '이미 처리된 제안서입니다.' }, { status: 409 })
        }

        if (new Date(proposal.expires_at) < new Date()) {
            return jsonResponse({ message: '만료된 제안서는 결제할 수 없습니다.' }, { status: 409 })
        }

        const payment = await confirmTossPayment({
            secretKey: getRequiredEnv('TOSS_PAYMENTS_SECRET_KEY'),
            paymentKey: body.paymentKey,
            orderId: body.orderId,
            amount: body.amount,
        })

        if (payment.status !== 'DONE' || payment.orderId !== order.order_id || payment.totalAmount !== order.amount) {
            return jsonResponse({ message: '토스페이먼츠 승인 결과가 주문 정보와 일치하지 않습니다.' }, { status: 409 })
        }

        const result = await repairApprovedPayment({ client, payment })
        return paymentWorkflowResponse(result)
    } catch (error) {
        if (error instanceof TossApiError) {
            return jsonResponse({ message: error.message }, { status: error.status })
        }

        const message = error instanceof Error ? error.message : '결제 승인 중 오류가 발생했습니다.'
        return jsonResponse({ message }, { status: 500 })
    }
})
