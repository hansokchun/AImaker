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
    readonly platform_fee_rate: number
    readonly platform_fee: number
    readonly expert_payout: number
    readonly status: string
}

type ProposalRow = {
    readonly id: string
    readonly request_id: string | null
    readonly client_id: string
    readonly expert_id: string
    readonly title: string
    readonly total_price: number
    readonly progress_type: 'single' | 'milestone'
    readonly milestones: unknown
    readonly revision_count: number
}

type WorkIdRow = {
    readonly id: string
}

type WorkStepInsert = {
    readonly work_id: string
    readonly step_order: number
    readonly title: string
    readonly description: string
    readonly status: 'waiting' | 'in_progress'
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
        && typeof candidate.platform_fee_rate === 'number'
        && typeof candidate.platform_fee === 'number'
        && typeof candidate.expert_payout === 'number'
        && typeof candidate.status === 'string'
}

const isProposalRow = (value: unknown): value is ProposalRow => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<ProposalRow>
    return typeof candidate.id === 'string'
        && (typeof candidate.request_id === 'string' || candidate.request_id === null)
        && typeof candidate.client_id === 'string'
        && typeof candidate.expert_id === 'string'
        && typeof candidate.title === 'string'
        && typeof candidate.total_price === 'number'
        && (candidate.progress_type === 'single' || candidate.progress_type === 'milestone')
        && typeof candidate.revision_count === 'number'
}

const isWorkIdRow = (value: unknown): value is WorkIdRow => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<WorkIdRow>
    return typeof candidate.id === 'string'
}

const toTextList = (value: unknown): readonly string[] => {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

const buildInitialWorkSteps = (proposal: ProposalRow, workId: string): readonly WorkStepInsert[] => {
    const milestones = toTextList(proposal.milestones)
    const titles = proposal.progress_type === 'milestone' && milestones.length > 0 ? milestones : [proposal.title]

    return titles.map((title, index) => ({
        work_id: workId,
        step_order: index + 1,
        title,
        description: index === 0 ? '작업을 시작합니다.' : '이전 단계 완료 후 진행합니다.',
        status: index === 0 ? 'in_progress' : 'waiting',
    }))
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
            .select('order_id, proposal_id, client_id, amount, platform_fee_rate, platform_fee, expert_payout, status')
            .eq('order_id', body.orderId)
            .single()

        if (error || !isPaymentOrderRow(order)) {
            return jsonResponse({ message: '결제 주문을 찾을 수 없습니다.' }, { status: 404 })
        }

        if (order.client_id !== user.id) {
            return jsonResponse({ message: '결제 승인 권한이 없습니다.' }, { status: 403 })
        }

        if (order.status === 'approved') {
            const { data: existingWork } = await client
                .from('works')
                .select('id')
                .eq('proposal_id', order.proposal_id)
                .limit(1)
                .maybeSingle()
            return jsonResponse({
                proposalId: order.proposal_id,
                workId: isWorkIdRow(existingWork) ? existingWork.id : undefined,
            })
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
        const { data: proposal, error: proposalFetchError } = await client
            .from('proposals')
            .select('id, request_id, client_id, expert_id, title, total_price, progress_type, milestones, revision_count')
            .eq('id', order.proposal_id)
            .single()

        if (proposalFetchError || !isProposalRow(proposal)) {
            return jsonResponse({ message: '결제된 제안서를 찾을 수 없습니다.' }, { status: 404 })
        }

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
                platform_fee_rate: order.platform_fee_rate,
                paid_at: approvedAt,
            })
            .eq('id', order.proposal_id)

        const { data: existingWork } = await client
            .from('works')
            .select('id')
            .eq('proposal_id', order.proposal_id)
            .limit(1)
            .maybeSingle()

        if (isWorkIdRow(existingWork)) {
            return jsonResponse({ proposalId: order.proposal_id, workId: existingWork.id })
        }

        const { data: work, error: workError } = await client
            .from('works')
            .insert({
                proposal_id: proposal.id,
                request_id: proposal.request_id,
                client_id: proposal.client_id,
                expert_id: proposal.expert_id,
                title: proposal.title,
                progress_type: proposal.progress_type,
                status: 'in_progress',
                total_price: proposal.total_price,
                platform_fee: order.platform_fee,
                expert_payout: order.expert_payout,
                settlement_status: 'held',
                revision_limit: proposal.revision_count,
                revision_used: 0,
            })
            .select('id')
            .single()

        if (workError || !isWorkIdRow(work)) {
            return jsonResponse({ message: '결제 후 작업방 생성에 실패했습니다.' }, { status: 500 })
        }

        const { error: stepError } = await client.from('work_steps').insert(buildInitialWorkSteps(proposal, work.id))

        if (stepError) {
            return jsonResponse({ message: '결제 후 작업 단계 생성에 실패했습니다.' }, { status: 500 })
        }

        if (proposal.request_id) {
            await client
                .from('service_requests')
                .update({ status: 'in_progress' })
                .eq('id', proposal.request_id)
        }

        return jsonResponse({ proposalId: order.proposal_id, workId: work.id })
    } catch (error) {
        if (error instanceof TossApiError) {
            return jsonResponse({ message: error.message }, { status: error.status })
        }

        const message = error instanceof Error ? error.message : '결제 승인 중 오류가 발생했습니다.'
        return jsonResponse({ message }, { status: 500 })
    }
})
