import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { isUniqueViolation } from '../_shared/payment-workflow.ts'
import { createServiceClient, requireUser } from '../_shared/supabase.ts'
import { calculateSettlementAmounts, getPlatformFeeRate } from '../_shared/settlement.ts'

type OrderRequest = {
    readonly proposalId: string
}

type ProposalRow = {
    readonly id: string
    readonly client_id: string
    readonly title: string
    readonly total_price: number
    readonly status: string
    readonly payment_status: string
    readonly expires_at: string
}

type ExistingOrderRow = {
    readonly order_id: string
    readonly order_name: string
    readonly amount: number
    readonly status: 'ready' | 'approved'
}

const isOrderRequest = (value: unknown): value is OrderRequest => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<OrderRequest>
    return typeof candidate.proposalId === 'string' && candidate.proposalId.length > 0
}

const isProposalRow = (value: unknown): value is ProposalRow => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<ProposalRow>
    return typeof candidate.id === 'string'
        && typeof candidate.client_id === 'string'
        && typeof candidate.title === 'string'
        && typeof candidate.total_price === 'number'
        && typeof candidate.status === 'string'
        && typeof candidate.payment_status === 'string'
        && typeof candidate.expires_at === 'string'
}

const isExistingOrderRow = (value: unknown): value is ExistingOrderRow => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<ExistingOrderRow>
    return typeof candidate.order_id === 'string'
        && typeof candidate.order_name === 'string'
        && typeof candidate.amount === 'number'
        && (candidate.status === 'ready' || candidate.status === 'approved')
}

const existingOrderResponse = (order: ExistingOrderRow, proposal: ProposalRow): Response | null => {
    if (order.status === 'approved') {
        return jsonResponse({ message: '이미 결제 완료된 제안서입니다.' }, { status: 409 })
    }

    if (order.amount !== proposal.total_price) return null

    return jsonResponse({
        orderId: order.order_id,
        orderName: order.order_name,
        amount: order.amount,
    })
}

Deno.serve(async (request) => {
    const options = handleOptions(request)
    if (options) return options

    try {
        const body: unknown = await request.json()
        if (!isOrderRequest(body)) {
            return jsonResponse({ message: 'proposalId가 필요합니다.' }, { status: 400 })
        }

        const user = await requireUser(request)
        const client = createServiceClient()
        const { data: proposal, error } = await client
            .from('proposals')
            .select('id, client_id, title, total_price, status, payment_status, expires_at')
            .eq('id', body.proposalId)
            .single()

        if (error || !isProposalRow(proposal)) {
            return jsonResponse({ message: '결제할 제안서를 찾을 수 없습니다.' }, { status: 404 })
        }

        if (proposal.client_id !== user.id) {
            return jsonResponse({ message: '제안서 결제 권한이 없습니다.' }, { status: 403 })
        }

        if (!['sent', 'revision_requested'].includes(proposal.status) || proposal.payment_status !== 'unpaid') {
            return jsonResponse({ message: '이미 처리된 제안서입니다.' }, { status: 409 })
        }

        if (new Date(proposal.expires_at) < new Date()) {
            return jsonResponse({ message: '만료된 제안서는 결제할 수 없습니다.' }, { status: 409 })
        }

        if (proposal.total_price <= 0) {
            return jsonResponse({ message: '결제 금액이 올바르지 않습니다.' }, { status: 409 })
        }

        const { data: existingOrder, error: existingOrderError } = await client
            .from('payment_orders')
            .select('order_id, order_name, amount, status')
            .eq('proposal_id', proposal.id)
            .in('status', ['ready', 'approved'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (existingOrderError) {
            return jsonResponse({ message: '기존 결제 주문 조회에 실패했습니다.' }, { status: 500 })
        }

        if (existingOrder) {
            if (!isExistingOrderRow(existingOrder)) {
                return jsonResponse({ message: '기존 결제 주문 조회 결과가 올바르지 않습니다.' }, { status: 500 })
            }

            const response = existingOrderResponse(existingOrder, proposal)
            if (response) return response
            const { error: staleOrderError } = await client
                .from('payment_orders')
                .update({
                    status: 'failed',
                    failure_code: 'STALE_ORDER_AMOUNT',
                    failure_message: '제안서 금액 변경으로 이전 결제 주문이 만료되었습니다.',
                })
                .eq('order_id', existingOrder.order_id)
                .eq('status', 'ready')

            if (staleOrderError) {
                return jsonResponse({ message: '기존 결제 주문 정리에 실패했습니다.' }, { status: 500 })
            }
        }

        const orderId = crypto.randomUUID()
        const orderName = `${proposal.title} 결제`
        const platformFeeRate = getPlatformFeeRate()
        const settlement = calculateSettlementAmounts(proposal.total_price, platformFeeRate)
        const { error: insertError } = await client.from('payment_orders').insert({
            order_id: orderId,
            proposal_id: proposal.id,
            client_id: proposal.client_id,
            amount: proposal.total_price,
            currency: 'KRW',
            order_name: orderName,
            platform_fee_rate: platformFeeRate,
            platform_fee: settlement.platformFee,
            expert_payout: settlement.expertPayout,
            status: 'ready',
        })

        if (insertError) {
            if (isUniqueViolation(insertError)) {
                const { data: racedOrder, error: racedOrderError } = await client
                    .from('payment_orders')
                    .select('order_id, order_name, amount, status')
                    .eq('proposal_id', proposal.id)
                    .in('status', ['ready', 'approved'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (racedOrderError) {
                    return jsonResponse({ message: '경합 결제 주문 조회에 실패했습니다.' }, { status: 500 })
                }

                if (racedOrder && isExistingOrderRow(racedOrder)) {
                    const response = existingOrderResponse(racedOrder, proposal)
                    if (response) return response
                }
            }

            return jsonResponse({ message: '결제 주문 저장에 실패했습니다.' }, { status: 500 })
        }

        return jsonResponse({
            orderId,
            orderName,
            amount: proposal.total_price,
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : '결제 주문 생성 중 오류가 발생했습니다.'
        return jsonResponse({ message }, { status: 500 })
    }
})
