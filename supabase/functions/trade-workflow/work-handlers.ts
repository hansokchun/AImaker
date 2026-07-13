import { ok, responseError } from './responses.ts'
import type { DeliverablePayload, RowRecord, ServiceClient } from './types.ts'
import { queueTradeNotification } from './notifications.ts'
import { isRecord } from './validation.ts'

async function fetchParticipantWork(client: ServiceClient, workId: string, userId: string): Promise<RowRecord | Response> {
    const { data, error } = await client
        .from('works')
        .select('id, proposal_id, request_id, client_id, expert_id, status, revision_used, revision_limit, settlement_status, settlement_requested_at, settlement_hold_reason, dispute_status, cancellation_requested_by, cancellation_requested_at, expert_payout')
        .eq('id', workId)
        .maybeSingle()
    if (error || !isRecord(data)) return responseError('작업방을 찾을 수 없습니다.', 404)
    if (data.client_id !== userId && data.expert_id !== userId) return responseError('거래 참여자만 처리할 수 있습니다.', 403)
    return data
}

const hasOpenCancellation = (work: RowRecord): boolean =>
    typeof work.cancellation_requested_by === 'string' || typeof work.cancellation_requested_at === 'string'

const assertNotFrozen = (work: RowRecord, actionName: string): Response | null => {
    if (work.dispute_status === 'open') return responseError(`분쟁 처리 중에는 ${actionName}할 수 없습니다.`, 409)
    if (hasOpenCancellation(work)) return responseError(`거래 취소 요청 응답 대기 중에는 ${actionName}할 수 없습니다.`, 409)
    return null
}

async function ensureWorkStep(client: ServiceClient, workId: string, stepId?: string): Promise<Response | null> {
    if (!stepId) return null
    const { data, error } = await client.from('work_steps').select('id').eq('id', stepId).eq('work_id', workId).maybeSingle()
    if (error || !isRecord(data)) return responseError('작업 단계가 이 작업방에 속하지 않습니다.', 403)
    return null
}

export async function cancelWork(
    client: ServiceClient,
    userId: string,
    workId: string,
    reason?: string,
    accept = false,
): Promise<Response> {
    const work = await fetchParticipantWork(client, workId, userId)
    if (work instanceof Response) return work
    if (work.status === 'completed' || work.status === 'cancelled') return responseError('취소할 수 없는 작업 상태입니다.', 409)
    if (work.dispute_status === 'open') return responseError('분쟁 처리 중에는 거래 취소를 진행할 수 없습니다.', 409)
    if (accept) {
        if (typeof work.cancellation_requested_by !== 'string') return responseError('수락할 취소 요청이 없습니다.', 409)
        if (work.cancellation_requested_by === userId) return responseError('상대방의 취소 요청만 수락할 수 있습니다.', 409)
    }

    if (!accept && reason) {
        if (hasOpenCancellation(work)) return responseError('이미 취소 요청이 접수된 거래입니다.', 409)
        const { error } = await client.from('works').update({
            cancellation_reason: reason,
            cancellation_requested_by: userId,
            cancellation_requested_at: new Date().toISOString(),
        }).eq('id', workId)
        return error ? responseError('취소 요청에 실패했습니다.', 500) : ok({ workId })
    }

    if (!accept) return responseError('거래 취소는 취소 요청 후 상대방 수락 또는 관리자 처리로 진행됩니다.', 409)
    const { error } = await client.from('works').update({
        status: 'cancelled',
        refund_status: 'fee_excluded_refund_pending',
        cancellation_requested_by: null,
        cancellation_requested_at: null,
        cancelled_at: new Date().toISOString(),
    }).eq('id', workId)
    return error ? responseError('작업 취소에 실패했습니다.', 500) : ok({ workId })
}

export async function submitDeliverable(client: ServiceClient, userId: string, payload: DeliverablePayload): Promise<Response> {
    const work = await fetchParticipantWork(client, payload.workId, userId)
    if (work instanceof Response) return work
    if (work.expert_id !== userId || (work.status !== 'in_progress' && work.status !== 'revision_requested')) return responseError('결과물 제출 권한이 없습니다.', 403)
    const frozen = assertNotFrozen(work, '제출물을 등록')
    if (frozen) return frozen
    const stepError = await ensureWorkStep(client, payload.workId, payload.stepId)
    if (stepError) return stepError
    const description = payload.description.trim()
    const externalUrl = payload.externalUrl?.trim() || null
    const fileUrl = payload.fileUrl?.trim() || null
    if (!description || (!externalUrl && !fileUrl)) return responseError('제출물 정보가 올바르지 않습니다.', 400)

    const { data, error } = await client.from('deliverables').insert({
        work_id: payload.workId,
        step_id: payload.stepId,
        expert_id: userId,
        description,
        external_url: externalUrl,
        file_url: fileUrl,
        status: 'submitted',
    }).select('id').single()
    if (error || !isRecord(data) || typeof data.id !== 'string') return responseError('제출물 저장에 실패했습니다.', 500)
    if (payload.stepId) {
        const stepResult = await client.from('work_steps').update({ status: 'submitted' }).eq('id', payload.stepId).eq('work_id', payload.workId)
        if (stepResult.error) return responseError('작업 단계 상태 변경에 실패했습니다.', 500)
    }
    const workResult = await client.from('works').update({ status: 'submitted' }).eq('id', payload.workId)
    if (workResult.error) return responseError('작업 상태 변경에 실패했습니다.', 500)
    if (typeof work.client_id === 'string') {
        await queueTradeNotification(client, work.client_id, 'deliverable_submitted', 'deliverable', data.id)
    }
    return ok({ workId: payload.workId, deliverableId: data.id })
}

export async function reviewDeliverable(
    client: ServiceClient,
    userId: string,
    workId: string,
    deliverableId: string,
    approved: boolean,
): Promise<Response> {
    const work = await fetchParticipantWork(client, workId, userId)
    if (work instanceof Response) return work
    if (work.client_id !== userId || work.status !== 'submitted') return responseError('제출물 검토 권한이 없습니다.', 403)
    const frozen = assertNotFrozen(work, approved ? '결과물을 승인' : '수정 요청')
    if (frozen) return frozen
    const revisionUsed = Number(work.revision_used) || 0
    const revisionLimit = Number(work.revision_limit) || 0
    if (!approved && revisionLimit > 0 && revisionUsed >= revisionLimit) return responseError('수정 요청 가능 횟수를 초과했습니다.', 409)

    const { data: deliverable, error: deliverableError } = await client
        .from('deliverables')
        .select('id, step_id, status')
        .eq('id', deliverableId)
        .eq('work_id', workId)
        .maybeSingle()
    if (deliverableError || !isRecord(deliverable) || deliverable.status !== 'submitted') return responseError('제출물을 찾을 수 없습니다.', 404)
    const status = approved ? 'approved' : 'revision_requested'
    const deliverableResult = await client.from('deliverables').update({ status }).eq('id', deliverableId).eq('work_id', workId)
    if (deliverableResult.error) return responseError('제출물 상태 변경에 실패했습니다.', 500)
    if (typeof deliverable.step_id === 'string') {
        const stepResult = await client.from('work_steps').update({ status }).eq('id', deliverable.step_id).eq('work_id', workId)
        if (stepResult.error) return responseError('작업 단계 상태 변경에 실패했습니다.', 500)
    }
    const workUpdate = approved
        ? { status: 'completed', settlement_status: 'pending', completed_at: new Date().toISOString() }
        : { status: 'revision_requested', revision_used: revisionUsed + 1 }
    const workResult = await client.from('works').update(workUpdate).eq('id', workId)
    if (workResult.error) return responseError('작업 상태 변경에 실패했습니다.', 500)
    if (approved && typeof work.request_id === 'string') {
        await client.from('service_requests').update({ status: 'completed' }).eq('id', work.request_id)
    }
    if (typeof work.expert_id === 'string') {
        await queueTradeNotification(
            client,
            work.expert_id,
            approved ? 'settlement_available' : 'revision_requested',
            approved ? 'work' : 'deliverable',
            approved ? workId : deliverableId,
        )
    }
    return ok({ workId, deliverableId })
}

export async function requestSettlement(client: ServiceClient, userId: string, workId: string): Promise<Response> {
    const work = await fetchParticipantWork(client, workId, userId)
    if (work instanceof Response) return work
    if (work.expert_id !== userId) return responseError('작업자만 정산을 신청할 수 있습니다.', 403)
    if (work.status !== 'completed' || work.settlement_status !== 'pending') return responseError('구매확정 후 정산 대기 상태에서만 신청할 수 있습니다.', 409)
    if (work.dispute_status === 'open' || typeof work.settlement_hold_reason === 'string') return responseError('관리자 확인이 필요한 정산입니다.', 409)

    const { data: account, error: accountError } = await client.from('expert_payout_accounts').select('id').eq('expert_id', userId).limit(1).maybeSingle()
    if (accountError || !isRecord(account) || typeof account.id !== 'string') return responseError('정산 받을 계좌를 먼저 등록해주세요.', 409)
    const requestedAt = new Date().toISOString()
    const workResult = await client.from('works').update({ settlement_requested_at: requestedAt }).eq('id', workId)
    if (workResult.error) return responseError('정산 신청 상태 저장에 실패했습니다.', 500)
    const payoutResult = await client.from('settlement_payouts').upsert({
        work_id: workId,
        expert_id: userId,
        payout_account_id: account.id,
        amount: Number(work.expert_payout) || 0,
        status: 'queued',
        requested_at: requestedAt,
        failure_reason: null,
        processed_at: null,
    }, { onConflict: 'work_id' })
    if (payoutResult.error) return responseError('정산 큐 생성에 실패했습니다.', 500)
    await queueTradeNotification(client, userId, 'settlement_requested', 'settlement', workId)
    return ok({ workId })
}
