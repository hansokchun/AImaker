import { isManualSettlementPayload } from './manual-settlement.ts'
import type { AdminActionPayload, DeliverablePayload, ProposalPayload, RowRecord, WorkflowRequest } from './types.ts'

export const isRecord = (value: unknown): value is RowRecord => typeof value === 'object' && value !== null

const stringValue = (record: RowRecord, key: string): string | null => {
    const value = record[key]
    return typeof value === 'string' && value.trim().length > 0 ? value : null
}

const numberValue = (record: RowRecord, key: string): number | null => {
    const value = record[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const booleanValue = (record: RowRecord, key: string): boolean | null => {
    const value = record[key]
    return typeof value === 'boolean' ? value : null
}

const textListValue = (record: RowRecord, key: string): readonly string[] | null => {
    const value = record[key]
    if (!Array.isArray(value)) return null
    const texts = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    return texts.length === value.length ? texts : null
}

const isProposalPayload = (value: unknown): value is ProposalPayload => {
    if (!isRecord(value)) return false
    return Boolean(
        stringValue(value, 'id')
        && stringValue(value, 'requestId')
        && stringValue(value, 'title')
        && stringValue(value, 'scope')
        && textListValue(value, 'deliverables')
        && numberValue(value, 'totalPrice') !== null
        && numberValue(value, 'deliveryDays') !== null
        && numberValue(value, 'revisionCount') !== null
        && (value.progressType === 'single' || value.progressType === 'milestone')
        && textListValue(value, 'milestones')
        && booleanValue(value, 'commercialUseAllowed') !== null
        && booleanValue(value, 'sourceFileIncluded') !== null
        && stringValue(value, 'expiresAt'),
    )
}

const isDeliverablePayload = (value: unknown): value is DeliverablePayload => {
    if (!isRecord(value)) return false
    const externalUrl = stringValue(value, 'externalUrl')
    const fileUrl = stringValue(value, 'fileUrl')
    return Boolean(
        stringValue(value, 'workId')
        && stringValue(value, 'description')
        && (externalUrl || fileUrl)
        && (value.stepId === undefined || typeof value.stepId === 'string'),
    )
}

const isAdminActionPayload = (value: unknown): value is AdminActionPayload => {
    return isRecord(value)
        && typeof value.targetType === 'string'
        && typeof value.targetId === 'string'
        && typeof value.actionType === 'string'
        && typeof value.reason === 'string'
}

export const isWorkflowRequest = (value: unknown): value is WorkflowRequest => {
    if (!isRecord(value)) return false
    const type = stringValue(value, 'type')
    if (!type) return false

    switch (type) {
        case 'create_proposal':
        case 'update_proposal':
            return isProposalPayload(value.proposal)
        case 'accept_proposal':
        case 'request_proposal_revision':
        case 'cancel_proposal':
            return typeof value.proposalId === 'string'
        case 'request_work_cancellation':
            return typeof value.workId === 'string' && (value.reason === 'before_start' || value.reason === 'mutual_after_start')
        case 'accept_work_cancellation':
        case 'request_settlement_withdrawal':
            return typeof value.workId === 'string'
        case 'submit_deliverable':
            return isDeliverablePayload(value.deliverable)
        case 'approve_deliverable':
        case 'request_work_revision':
            return typeof value.workId === 'string' && typeof value.deliverableId === 'string'
        case 'request_work_dispute':
            return typeof value.workId === 'string'
                && ['scope_mismatch', 'missing_deliverable', 'quality_issue', 'late_delivery', 'other'].includes(String(value.reason))
                && typeof value.details === 'string' && value.details.trim().length >= 10 && value.details.trim().length <= 1000
        case 'admin_moderation_action':
            return isAdminActionPayload(value.action)
        case 'complete_manual_settlement':
            return isManualSettlementPayload(value.settlement)
        default:
            return false
    }
}
