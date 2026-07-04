import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, requireUser } from '../_shared/supabase.ts'

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

        const orderId = crypto.randomUUID()
        const orderName = `${proposal.title} 결제`
        const { error: insertError } = await client.from('payment_orders').insert({
            order_id: orderId,
            proposal_id: proposal.id,
            client_id: proposal.client_id,
            amount: proposal.total_price,
            currency: 'KRW',
            order_name: orderName,
            status: 'ready',
        })

        if (insertError) {
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
