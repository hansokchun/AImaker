import type { createServiceClient } from '../_shared/supabase.ts'

export type ServiceClient = ReturnType<typeof createServiceClient>

export type ProposalPayload = {
    readonly id: string
    readonly requestId: string
    readonly consultationId?: string
    readonly title: string
    readonly scope: string
    readonly deliverables: readonly string[]
    readonly totalPrice: number
    readonly deliveryDays: number
    readonly revisionCount: number
    readonly progressType: 'single' | 'milestone'
    readonly milestones: readonly string[]
    readonly commercialUseAllowed: boolean
    readonly sourceFileIncluded: boolean
    readonly expiresAt: string
}

export type DeliverablePayload = {
    readonly workId: string
    readonly stepId?: string
    readonly description: string
    readonly externalUrl?: string
    readonly retentionConfirmed: boolean
}

export type AdminActionPayload = {
    readonly targetType: string
    readonly targetId: string
    readonly actionType: string
    readonly reason: string
}

export type ManualSettlementPayload = {
    readonly workId: string
    readonly transferReference: string
}

export type WorkflowRequest =
    | { readonly type: 'create_proposal'; readonly proposal: ProposalPayload }
    | { readonly type: 'update_proposal'; readonly proposal: ProposalPayload }
    | { readonly type: 'accept_proposal'; readonly proposalId: string }
    | { readonly type: 'request_proposal_revision'; readonly proposalId: string }
    | { readonly type: 'cancel_proposal'; readonly proposalId: string }
    | { readonly type: 'request_work_cancellation'; readonly workId: string; readonly reason: 'before_start' | 'mutual_after_start' }
    | { readonly type: 'accept_work_cancellation'; readonly workId: string }
    | { readonly type: 'request_settlement_withdrawal'; readonly workId: string }
    | { readonly type: 'submit_deliverable'; readonly deliverable: DeliverablePayload }
    | { readonly type: 'approve_deliverable'; readonly workId: string; readonly deliverableId: string; readonly stepId?: string }
    | { readonly type: 'request_work_revision'; readonly workId: string; readonly deliverableId: string; readonly stepId?: string }
    | { readonly type: 'request_work_dispute'; readonly workId: string; readonly reason: 'scope_mismatch' | 'missing_deliverable' | 'quality_issue' | 'late_delivery' | 'other'; readonly details: string }
    | { readonly type: 'admin_moderation_action'; readonly action: AdminActionPayload }
    | { readonly type: 'complete_manual_settlement'; readonly settlement: ManualSettlementPayload }

export type RowRecord = Record<string, unknown>
