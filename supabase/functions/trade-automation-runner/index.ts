import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, getRequiredEnv } from '../_shared/supabase.ts'

type WorkRow = {
    readonly id: string
    readonly request_id: string | null
    readonly cancellation_reason: 'before_start' | 'mutual_after_start' | null
}

type DeliverableRow = {
    readonly id: string
    readonly work_id: string
    readonly step_id: string | null
    readonly submitted_at: string
    readonly works: WorkRow | null
}

const AUTO_PURCHASE_CONFIRM_DAYS = 7
const CANCELLATION_RESPONSE_HOURS = 24

const isWorkRow = (value: unknown): value is WorkRow => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<WorkRow>
    return typeof candidate.id === 'string'
        && (typeof candidate.request_id === 'string' || candidate.request_id === null)
        && (candidate.cancellation_reason === 'before_start'
            || candidate.cancellation_reason === 'mutual_after_start'
            || candidate.cancellation_reason === null)
}

const isDeliverableRow = (value: unknown): value is DeliverableRow => {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<DeliverableRow>
    return typeof candidate.id === 'string'
        && typeof candidate.work_id === 'string'
        && (typeof candidate.step_id === 'string' || candidate.step_id === null)
        && typeof candidate.submitted_at === 'string'
        && (candidate.works === null || isWorkRow(candidate.works))
}

const requireAutomationSecret = (request: Request): Response | null => {
    const expectedSecret = getRequiredEnv('TRADE_AUTOMATION_SECRET')
    const actualSecret = request.headers.get('x-automation-secret')?.trim()
    return actualSecret === expectedSecret
        ? null
        : jsonResponse({ message: 'Automation secret is invalid.' }, { status: 401 })
}

Deno.serve(async (request) => {
    const options = handleOptions(request)
    if (options) return options

    if (request.method !== 'POST') {
        return jsonResponse({ message: 'Only POST requests are supported.' }, { status: 405 })
    }

    const unauthorized = requireAutomationSecret(request)
    if (unauthorized) return unauthorized

    const client = createServiceClient()
    const now = new Date()
    const autoConfirmBefore = new Date(now.getTime() - AUTO_PURCHASE_CONFIRM_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const autoCancelBefore = new Date(now.getTime() - CANCELLATION_RESPONSE_HOURS * 60 * 60 * 1000).toISOString()
    const nowIso = now.toISOString()

    const { data: cancellationRows, error: cancellationError } = await client
        .from('works')
        .select('id, request_id, cancellation_reason')
        .not('cancellation_requested_at', 'is', null)
        .lte('cancellation_requested_at', autoCancelBefore)
        .not('cancellation_requested_by', 'is', null)
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .neq('dispute_status', 'open')
        .limit(100)

    if (cancellationError) {
        return jsonResponse({ message: 'Failed to load automatic cancellation candidates.' }, { status: 500 })
    }

    const cancellableWorks = (cancellationRows || []).filter(isWorkRow)
    for (const work of cancellableWorks) {
        await client
            .from('works')
            .update({
                status: 'cancelled',
                refund_status: 'fee_excluded_refund_pending',
                cancellation_reason: work.cancellation_reason || 'mutual_after_start',
                cancellation_requested_by: null,
                cancellation_requested_at: null,
                cancelled_at: nowIso,
            })
            .eq('id', work.id)
        if (work.request_id) {
            await client.from('service_requests').update({ status: 'completed' }).eq('id', work.request_id)
        }
    }

    const { data: deliverableRows, error: deliverableError } = await client
        .from('deliverables')
        .select('id, work_id, step_id, submitted_at, works!inner(id, request_id, cancellation_reason)')
        .eq('status', 'submitted')
        .lte('submitted_at', autoConfirmBefore)
        .eq('works.status', 'submitted')
        .eq('works.settlement_status', 'held')
        .is('works.dispute_status', null)
        .is('works.cancellation_requested_at', null)
        .limit(100)

    if (deliverableError) {
        return jsonResponse({ message: 'Failed to load automatic purchase confirmation candidates.' }, { status: 500 })
    }

    const confirmableDeliverables = (deliverableRows || []).filter(isDeliverableRow)
    for (const deliverable of confirmableDeliverables) {
        const work = deliverable.works
        if (!work) continue
        await client.from('deliverables').update({ status: 'approved' }).eq('id', deliverable.id)
        if (deliverable.step_id) {
            await client.from('work_steps').update({ status: 'approved' }).eq('id', deliverable.step_id)
        }
        await client
            .from('works')
            .update({
                status: 'completed',
                settlement_status: 'pending',
                completed_at: nowIso,
            })
            .eq('id', work.id)
        if (work.request_id) {
            await client.from('service_requests').update({ status: 'completed' }).eq('id', work.request_id)
        }
    }

    return jsonResponse({
        autoCancelled: cancellableWorks.length,
        autoConfirmed: confirmableDeliverables.length,
    })
})
