import { handleOptions } from '../_shared/cors.ts'
import { isPaymentPolicyActive, paymentPolicyUnavailableResponse } from '../_shared/payment-policy.ts'
import { createServiceClient, createUserClient, requireUser } from '../_shared/supabase.ts'
import { runAdminAction } from './admin-handlers.ts'
import { completeManualSettlementWithClient } from './manual-settlement.ts'
import { acceptProposal, createProposal, updateProposal, updateProposalDecision } from './proposal-handlers.ts'
import { ok, responseError } from './responses.ts'
import { cancelWork, openWorkDispute, requestDeadlineExtension, requestSettlement, respondDeadlineExtension, reviewDeliverable, submitDeliverable } from './work-handlers.ts'
import { isRecord, isWorkflowRequest } from './validation.ts'

Deno.serve(async (request) => {
    const options = handleOptions(request)
    if (options) return options
    if (request.method !== 'POST') return responseError('POST 요청만 지원합니다.', 405)

    try {
        const user = await requireUser(request)
        const { data: profile, error: profileError } = await createUserClient(request)
            .from('profiles')
            .select('account_status, withdrawn_at')
            .eq('id', user.id)
            .maybeSingle()
        if (profileError) return responseError('怨꾩젙 ?곹깭瑜??뺤씤?섏? 紐삵뻽?듬땲??', 500)
        if (!isRecord(profile) || profile.account_status !== 'active' || profile.withdrawn_at !== null) {
            return responseError('?쒖꽦 怨꾩젙留?嫄곕옒 湲곕뒫???ъ슜?????덉뒿?덈떎.', 403)
        }
        const client = createServiceClient()
        const body: unknown = await request.json()
        if (!isWorkflowRequest(body)) return responseError('거래 요청 형식이 올바르지 않습니다.', 400)

        switch (body.type) {
            case 'create_proposal':
                return await createProposal(client, user.id, body.proposal)
            case 'update_proposal':
                return await updateProposal(client, user.id, body.proposal)
            case 'accept_proposal':
                return await acceptProposal(client, user.id, body.proposalId)
            case 'request_proposal_revision':
                return await updateProposalDecision(client, user.id, body.proposalId, 'revision_requested')
            case 'cancel_proposal':
                return await updateProposalDecision(client, user.id, body.proposalId, 'cancelled')
            case 'request_work_cancellation':
                return await cancelWork(client, user.id, body.workId, body.reason)
            case 'accept_work_cancellation':
                return await cancelWork(client, user.id, body.workId, undefined, true)
            case 'submit_deliverable':
                return await submitDeliverable(client, user.id, body.deliverable)
            case 'approve_deliverable':
                return await reviewDeliverable(client, user.id, body.workId, body.deliverableId, true)
            case 'request_work_revision':
                return await reviewDeliverable(client, user.id, body.workId, body.deliverableId, false)
            case 'request_work_dispute':
                return await openWorkDispute(client, user.id, body.workId, body.reason, body.details)
            case 'request_deadline_extension':
                return await requestDeadlineExtension(client, user.id, body.workId, body.proposedDueAt, body.reason)
            case 'respond_deadline_extension':
                return await respondDeadlineExtension(client, user.id, body.extensionId, body.accepted)
            case 'request_settlement_withdrawal':
                return await requestSettlement(client, user.id, body.workId)
            case 'admin_moderation_action':
                return await runAdminAction(client, user.id, body.action)
            case 'complete_manual_settlement': {
                if (!isPaymentPolicyActive()) return paymentPolicyUnavailableResponse()
                const result = await completeManualSettlementWithClient(client, user.id, body.settlement)
                if (result.kind === 'forbidden') return responseError('Administrator access is required.', 403)
                if (result.kind === 'not_found') return responseError('Settlement request was not found.', 404)
                if (result.kind === 'notification_failed') return responseError('Settlement was completed but expert notification could not be queued.', 500)
                return ok({ workId: body.settlement.workId, operationId: result.operationId, payoutId: result.payoutId })
            }
            default:
                return responseError('지원하지 않는 거래 작업입니다.', 400)
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : '거래 처리 중 오류가 발생했습니다.'
        return responseError(message, 500)
    }
})
