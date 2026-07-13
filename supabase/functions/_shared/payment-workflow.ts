import type { createServiceClient } from './supabase.ts'
import type { TossPayment } from './toss.ts'

type ServiceClient = ReturnType<typeof createServiceClient>

type PaymentOrderRow = {
    readonly order_id: string
    readonly proposal_id: string
    readonly client_id: string
    readonly amount: number
    readonly platform_fee_rate: number
    readonly platform_fee: number
    readonly expert_payout: number
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

type NotificationEventInsert = {
    readonly user_id: string
    readonly event_type: 'payment_completed' | 'workroom_created'
    readonly title: string
    readonly body: string
    readonly related_type: 'work'
    readonly related_id: string
    readonly channels: readonly string[]
    readonly status: 'queued'
}

type DbErrorLike = {
    readonly code?: string
}

export type PaymentWorkflowResult =
    | { readonly kind: 'ok'; readonly proposalId: string; readonly workId: string }
    | { readonly kind: 'failed'; readonly status: number; readonly message: string }

export type ApprovedPaymentRepairInput = {
    readonly client: ServiceClient
    readonly payment: Pick<TossPayment, 'paymentKey' | 'orderId' | 'totalAmount' | 'approvedAt'>
}

export const isUniqueViolation = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false
    const candidate = error as Partial<DbErrorLike>
    return candidate.code === '23505'
}

const failed = (message: string, status: number): PaymentWorkflowResult => ({ kind: 'failed', message, status })

const isFailedResult = (value: PaymentWorkflowResult | WorkIdRow | null): value is Extract<PaymentWorkflowResult, { kind: 'failed' }> =>
    value !== null && 'kind' in value && value.kind === 'failed'

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

const queuePaymentNotifications = async (
    client: ServiceClient,
    proposal: ProposalRow,
    workId: string,
): Promise<PaymentWorkflowResult | null> => {
    const events: readonly NotificationEventInsert[] = [
        {
            user_id: proposal.client_id,
            event_type: 'payment_completed',
            title: '결제가 완료되었습니다',
            body: `${proposal.title} 작업방이 열렸습니다.`,
            related_type: 'work',
            related_id: workId,
            channels: ['in_app'],
            status: 'queued',
        },
        {
            user_id: proposal.expert_id,
            event_type: 'workroom_created',
            title: '작업방이 생성되었습니다',
            body: `${proposal.title} 결제가 완료되어 작업을 시작할 수 있습니다.`,
            related_type: 'work',
            related_id: workId,
            channels: ['in_app'],
            status: 'queued',
        },
    ]
    const { error } = await client.from('notification_events').insert(events)
    if (!error) return null
    await client.from('operation_logs').insert({
        actor_id: proposal.client_id,
        event_type: 'payment_notification_queue_failed',
        target_type: 'work',
        target_id: workId,
        detail: { proposalId: proposal.id, error: error.message },
    })
    return null
}

const fetchWorkId = async (client: ServiceClient, proposalId: string): Promise<PaymentWorkflowResult | WorkIdRow | null> => {
    const { data: work, error } = await client
        .from('works')
        .select('id')
        .eq('proposal_id', proposalId)
        .limit(1)
        .maybeSingle()

    if (error) return failed('작업방 조회에 실패했습니다.', 500)
    if (!work) return null
    if (!isWorkIdRow(work)) return failed('작업방 조회 결과가 올바르지 않습니다.', 500)
    return work
}

const ensureWorkSteps = async (
    client: ServiceClient,
    proposal: ProposalRow,
    workId: string,
): Promise<PaymentWorkflowResult | null> => {
    const { error } = await client
        .from('work_steps')
        .upsert(buildInitialWorkSteps(proposal, workId), { onConflict: 'work_id,step_order', ignoreDuplicates: true })

    return error ? failed('결제 후 작업 단계 생성에 실패했습니다.', 500) : null
}

const ensureWork = async (client: ServiceClient, proposal: ProposalRow, order: PaymentOrderRow): Promise<PaymentWorkflowResult> => {
    const existingWork = await fetchWorkId(client, order.proposal_id)
    if (isFailedResult(existingWork)) return existingWork

    let work: WorkIdRow | null = existingWork
    if (!work) {
        const { data: insertedWork, error: workError } = await client
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

        if (workError || !isWorkIdRow(insertedWork)) {
            const racedWork = await fetchWorkId(client, order.proposal_id)
            if (isFailedResult(racedWork)) return racedWork
            if (!racedWork) return failed('결제 후 작업방 생성에 실패했습니다.', 500)
            work = racedWork
        } else {
            work = insertedWork
        }
    }

    const stepError = await ensureWorkSteps(client, proposal, work.id)
    if (stepError) return stepError

    return { kind: 'ok', proposalId: order.proposal_id, workId: work.id }
}

export async function repairApprovedPayment(input: ApprovedPaymentRepairInput): Promise<PaymentWorkflowResult> {
    const { client, payment } = input
    const approvedAt = payment.approvedAt || new Date().toISOString()
    const { data: order, error: orderFetchError } = await client
        .from('payment_orders')
        .select('order_id, proposal_id, client_id, amount, platform_fee_rate, platform_fee, expert_payout')
        .eq('order_id', payment.orderId)
        .maybeSingle()

    if (orderFetchError) return failed('결제 주문 조회에 실패했습니다.', 500)
    if (!order) return failed('결제 주문을 찾을 수 없습니다.', 404)
    if (!isPaymentOrderRow(order)) return failed('결제 주문 조회 결과가 올바르지 않습니다.', 500)
    if (order.amount !== payment.totalAmount) return failed('토스페이먼츠 승인 금액이 주문 금액과 일치하지 않습니다.', 409)

    const { error: orderUpdateError } = await client
        .from('payment_orders')
        .update({
            status: 'approved',
            payment_key: payment.paymentKey,
            approved_at: approvedAt,
            failure_code: null,
            failure_message: null,
        })
        .eq('order_id', order.order_id)

    if (orderUpdateError) return failed('결제 주문 승인 상태 저장에 실패했습니다.', 500)

    const { data: proposal, error: proposalFetchError } = await client
        .from('proposals')
        .select('id, request_id, client_id, expert_id, title, total_price, progress_type, milestones, revision_count')
        .eq('id', order.proposal_id)
        .maybeSingle()

    if (proposalFetchError) return failed('결제된 제안서 조회에 실패했습니다.', 500)
    if (!proposal) return failed('결제된 제안서를 찾을 수 없습니다.', 404)
    if (!isProposalRow(proposal)) return failed('결제된 제안서 조회 결과가 올바르지 않습니다.', 500)
    if (proposal.client_id !== order.client_id || proposal.total_price !== order.amount) {
        return failed('제안서 정보가 결제 주문과 일치하지 않습니다.', 409)
    }

    const { error: proposalUpdateError } = await client
        .from('proposals')
        .update({
            status: 'accepted',
            payment_status: 'paid',
            platform_fee_rate: order.platform_fee_rate,
            paid_at: approvedAt,
        })
        .eq('id', order.proposal_id)

    if (proposalUpdateError) return failed('결제된 제안서 상태 저장에 실패했습니다.', 500)

    const workResult = await ensureWork(client, proposal, order)
    if (workResult.kind === 'failed') return workResult

    if (proposal.request_id) {
        const { error: requestUpdateError } = await client
            .from('service_requests')
            .update({ status: 'in_progress' })
            .eq('id', proposal.request_id)

        if (requestUpdateError) return failed('결제 후 요청 상태 변경에 실패했습니다.', 500)
    }

    const notificationResult = await queuePaymentNotifications(client, proposal, workResult.workId)
    if (notificationResult) return notificationResult

    return workResult
}
