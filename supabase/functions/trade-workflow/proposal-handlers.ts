import { ok, responseError } from './responses.ts'
import type { ProposalPayload, RowRecord, ServiceClient } from './types.ts'
import { isRecord } from './validation.ts'

const getConsultationId = (proposal: ProposalPayload): string | null => {
    if (proposal.consultationId) return proposal.consultationId
    return proposal.requestId.startsWith('consultation-') ? proposal.requestId.slice('consultation-'.length) : null
}

export async function createProposal(client: ServiceClient, userId: string, proposal: ProposalPayload): Promise<Response> {
    const consultationId = getConsultationId(proposal)
    const source = consultationId
        ? await client.from('consultations').select('id, client_id, expert_id, status').eq('id', consultationId).maybeSingle()
        : await client.from('service_requests').select('id, client_id, expert_id, status').eq('id', proposal.requestId).maybeSingle()
    if (source.error || !isRecord(source.data)) return responseError('제안서를 보낼 요청을 찾을 수 없습니다.', 404)
    if (source.data.expert_id !== userId) return responseError('제안서 작성 권한이 없습니다.', 403)
    if (!['submitted', 'pending', 'open', 'proposal_sent'].includes(String(source.data.status))) {
        return responseError('제안서를 보낼 수 없는 상태입니다.', 409)
    }

    const { data, error } = await client.from('proposals').insert({
        request_id: consultationId ? null : source.data.id,
        consultation_id: consultationId,
        client_id: source.data.client_id,
        expert_id: source.data.expert_id,
        title: proposal.title.trim(),
        scope: proposal.scope.trim(),
        deliverables: proposal.deliverables,
        total_price: proposal.totalPrice,
        delivery_days: proposal.deliveryDays,
        revision_count: proposal.revisionCount,
        progress_type: proposal.progressType,
        milestones: proposal.milestones,
        commercial_use_allowed: proposal.commercialUseAllowed,
        source_file_included: proposal.sourceFileIncluded,
        status: 'sent',
        payment_status: 'unpaid',
        expires_at: proposal.expiresAt,
    }).select('id').single()
    if (error || !isRecord(data) || typeof data.id !== 'string') return responseError('제안서 저장에 실패했습니다.', 500)

    const table = consultationId ? 'consultations' : 'service_requests'
    await client.from(table).update({ status: 'proposal_sent' }).eq('id', source.data.id)
    return ok({ proposalId: data.id })
}

export async function updateProposal(client: ServiceClient, userId: string, proposal: ProposalPayload): Promise<Response> {
    const { data: existing, error: fetchError } = await client
        .from('proposals')
        .select('id, expert_id, payment_status, status')
        .eq('id', proposal.id)
        .maybeSingle()
    if (fetchError || !isRecord(existing)) return responseError('제안서를 찾을 수 없습니다.', 404)
    if (existing.expert_id !== userId || existing.payment_status !== 'unpaid') return responseError('제안서 수정 권한이 없습니다.', 403)
    if (existing.status !== 'sent' && existing.status !== 'revision_requested') return responseError('수정할 수 없는 제안서 상태입니다.', 409)

    const { error } = await client.from('proposals').update({
        title: proposal.title.trim(),
        scope: proposal.scope.trim(),
        deliverables: proposal.deliverables,
        total_price: proposal.totalPrice,
        delivery_days: proposal.deliveryDays,
        revision_count: proposal.revisionCount,
        progress_type: proposal.progressType,
        milestones: proposal.milestones,
        commercial_use_allowed: proposal.commercialUseAllowed,
        source_file_included: proposal.sourceFileIncluded,
        status: 'sent',
        expires_at: proposal.expiresAt,
    }).eq('id', proposal.id)
    return error ? responseError('제안서 수정에 실패했습니다.', 500) : ok({ proposalId: proposal.id })
}

export async function acceptProposal(client: ServiceClient, userId: string, proposalId: string): Promise<Response> {
    const { data: proposal, error } = await client
        .from('proposals')
        .select('id, client_id, status, payment_status')
        .eq('id', proposalId)
        .maybeSingle()
    if (error || !isRecord(proposal)) return responseError('제안서를 찾을 수 없습니다.', 404)
    if (proposal.client_id !== userId) return responseError('제안서 승인 권한이 없습니다.', 403)
    if (proposal.status !== 'accepted' || proposal.payment_status !== 'paid') {
        return responseError('토스 결제 승인 후 작업방을 열 수 있습니다.', 409)
    }
    const { data: work, error: workError } = await client.from('works').select('id').eq('proposal_id', proposalId).limit(1).maybeSingle()
    if (workError || !isRecord(work) || typeof work.id !== 'string') return responseError('결제된 작업방을 찾을 수 없습니다.', 404)
    return ok({ proposalId, workId: work.id })
}

export async function updateProposalDecision(
    client: ServiceClient,
    userId: string,
    proposalId: string,
    status: 'revision_requested' | 'cancelled',
): Promise<Response> {
    const { data, error } = await client.from('proposals').select('id, client_id, expert_id, payment_status').eq('id', proposalId).maybeSingle()
    if (error || !isRecord(data)) return responseError('제안서를 찾을 수 없습니다.', 404)
    if (data.payment_status !== 'unpaid') return responseError('처리 권한이 없습니다.', 403)
    if (status === 'revision_requested' && data.client_id !== userId) return responseError('제안서 수정 요청 권한이 없습니다.', 403)
    if (status === 'cancelled' && data.client_id !== userId && data.expert_id !== userId) return responseError('제안서 취소 권한이 없습니다.', 403)
    const result = await client.from('proposals').update({ status }).eq('id', proposalId)
    return result.error ? responseError('제안서 상태 변경에 실패했습니다.', 500) : ok({ proposalId })
}
