import { executeFinancialRpc } from '../_shared/financial-contracts.ts'
import { ok, responseError } from './responses.ts'
import type { DeliverablePayload, RowRecord, ServiceClient } from './types.ts'
import { queueTradeNotification } from './notifications.ts'
import { isRecord } from './validation.ts'
import { isPaymentPolicyActive, paymentPolicyUnavailableResponse } from '../_shared/payment-policy.ts'

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
    const result = await executeFinancialRpc(client, 'apply_work_cancellation', {
        p_work_id: workId,
        p_actor_id: userId,
        p_reason: reason?.trim() ?? '',
        p_accept: accept,
        p_business_key: `cancellation:${workId}:${accept ? 'accept' : 'request'}:${userId}`,
    })
    return ok({ workId, operationId: result.operationId })
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
    if (work.client_id !== userId) return responseError('결과물 검토 권한이 없습니다.', 403)
    const frozen = assertNotFrozen(work, approved ? '결과물을 승인' : '수정 요청')
    if (frozen) return frozen

    const result = await executeFinancialRpc(client, 'apply_deliverable_review', {
        p_work_id: workId,
        p_deliverable_id: deliverableId,
        p_client_id: userId,
        p_approved: approved,
        p_business_key: `deliverable-review:${deliverableId}:${approved ? 'approve' : 'revision'}`,
    })
    if (typeof work.expert_id === 'string') {
        await queueTradeNotification(
            client,
            work.expert_id,
            approved ? 'settlement_available' : 'revision_requested',
            approved ? 'work' : 'deliverable',
            approved ? workId : deliverableId,
        )
    }
    return ok({ workId, deliverableId, operationId: result.operationId })
}

export async function requestSettlement(
    client: ServiceClient,
    userId: string,
    workId: string,
): Promise<Response> {
    if (!isPaymentPolicyActive()) return paymentPolicyUnavailableResponse()
    const { data: profile } = await client.from('profiles')
        .select('account_status, withdrawn_at').eq('id', userId).maybeSingle()
    if (!isRecord(profile) || profile.account_status !== 'active' || profile.withdrawn_at !== null) {
        return responseError('An active expert account is required.', 403)
    }
    const result = await executeFinancialRpc(client, 'begin_settlement_request', {
        p_work_id: workId,
        p_expert_id: userId,
        p_policy_authorized: true,
        p_business_key: `settlement-request:${workId}`,
    })
    await queueTradeNotification(client, userId, 'settlement_requested', 'settlement', workId)
    return ok({ workId, operationId: result.operationId })
}
