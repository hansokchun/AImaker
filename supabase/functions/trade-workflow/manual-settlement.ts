import { executeFinancialRpc, requiredString } from '../_shared/financial-contracts.ts'
import { queueTradeNotification } from './notifications.ts'
import type { ManualSettlementPayload, ServiceClient } from './types.ts'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

type SettlementTarget = {
    readonly amount: number
    readonly expertId: string
    readonly operationId: string
    readonly payoutAccountId: string
    readonly payoutId: string
}

type FinalizationInput = Omit<SettlementTarget, 'expertId'> & {
    readonly transferReference: string
}

type PaidNotificationInput = {
    readonly expertId: string
    readonly workId: string
}

export interface ManualSettlementGateway {
    isActiveAdmin(userId: string): Promise<boolean>
    findSettlement(workId: string): Promise<SettlementTarget | null>
    finalize(input: FinalizationInput): Promise<{ readonly operationId: string; readonly payoutId: string }>
    hasPaidNotification(input: PaidNotificationInput): Promise<boolean>
    queuePaidNotification(input: PaidNotificationInput): Promise<boolean>
}

export type ManualSettlementResult =
    | { readonly kind: 'completed'; readonly operationId: string; readonly payoutId: string }
    | { readonly kind: 'forbidden' }
    | { readonly kind: 'notification_failed'; readonly operationId: string; readonly payoutId: string }
    | { readonly kind: 'not_found' }

const nonEmptyString = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null

const positiveInteger = (value: unknown): number | null =>
    typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null

const isTransferReference = (value: unknown): value is string =>
    typeof value === 'string' && /^[\p{L}\p{N}][\p{L}\p{N} ._:/-]{2,199}$/u.test(value.trim())

export const isManualSettlementPayload = (value: unknown): value is ManualSettlementPayload => {
    if (!isRecord(value)) return false
    return nonEmptyString(value.workId) !== null && isTransferReference(value.transferReference)
}

const parseSettlementTarget = (payout: unknown, operation: unknown): SettlementTarget | null => {
    if (!isRecord(payout) || !isRecord(operation)) return null
    const amount = positiveInteger(payout.amount)
    const expertId = nonEmptyString(payout.expert_id)
    const operationId = nonEmptyString(operation.id)
    const payoutAccountId = nonEmptyString(payout.payout_account_id)
    const payoutId = nonEmptyString(payout.id)
    if (amount === null || !expertId || !operationId || !payoutAccountId || !payoutId) return null
    return { amount, expertId, operationId, payoutAccountId, payoutId }
}

const createManualSettlementGateway = (client: ServiceClient): ManualSettlementGateway => ({
    isActiveAdmin: async (userId) => {
        const { data, error } = await client.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle()
        if (error) throw error
        return isRecord(data)
    },
    findSettlement: async (workId) => {
        const { data: payout, error: payoutError } = await client
            .from('settlement_payouts').select('id, expert_id, payout_account_id, amount').eq('work_id', workId).maybeSingle()
        if (payoutError) throw payoutError
        if (!isRecord(payout) || !nonEmptyString(payout.payout_account_id)) return null
        const { data: account, error: accountError } = await client
            .from('expert_payout_accounts').select('id, verified_at')
            .eq('id', payout.payout_account_id).not('verified_at', 'is', null).maybeSingle()
        if (accountError) throw accountError
        if (!isRecord(account)) return null
        const { data: operation, error: operationError } = await client
            .from('financial_operations').select('id').eq('work_id', workId).eq('operation_type', 'settlement_request').maybeSingle()
        if (operationError) throw operationError
        return parseSettlementTarget(payout, operation)
    },
    finalize: async (input) => {
        const result = await executeFinancialRpc(client, 'finalize_settlement_payout', {
            p_amount: input.amount,
            p_operation_id: input.operationId,
            p_payout_account_id: input.payoutAccountId,
            p_payout_id: input.payoutId,
            p_policy_authorized: true,
            p_provider_status: 'SUCCEEDED',
            p_provider_transfer_reference: input.transferReference,
        })
        return { operationId: requiredString(result, 'operationId'), payoutId: requiredString(result, 'payoutId') }
    },
    hasPaidNotification: async ({ expertId, workId }) => {
        const { data, error } = await client
            .from('notification_events').select('id').eq('user_id', expertId).eq('event_type', 'settlement_paid')
            .eq('related_type', 'settlement').eq('related_id', workId).maybeSingle()
        if (error) throw error
        return isRecord(data)
    },
    queuePaidNotification: async ({ expertId, workId }) =>
        await queueTradeNotification(client, expertId, 'settlement_paid', 'settlement', workId),
})

export async function completeManualSettlement(
    gateway: ManualSettlementGateway,
    userId: string,
    payload: ManualSettlementPayload,
): Promise<ManualSettlementResult> {
    if (!await gateway.isActiveAdmin(userId)) return { kind: 'forbidden' }
    const settlement = await gateway.findSettlement(payload.workId)
    if (!settlement) return { kind: 'not_found' }
    const finalized = await gateway.finalize({
        amount: settlement.amount,
        operationId: settlement.operationId,
        payoutAccountId: settlement.payoutAccountId,
        payoutId: settlement.payoutId,
        transferReference: payload.transferReference.trim(),
    })
    const notification = { expertId: settlement.expertId, workId: payload.workId }
    if (!await gateway.hasPaidNotification(notification)) {
        const queued = await gateway.queuePaidNotification(notification)
        if (!queued && !await gateway.hasPaidNotification(notification)) {
            return { kind: 'notification_failed', ...finalized }
        }
    }
    return { kind: 'completed', ...finalized }
}

export const completeManualSettlementWithClient = async (
    client: ServiceClient,
    userId: string,
    payload: ManualSettlementPayload,
): Promise<ManualSettlementResult> =>
    await completeManualSettlement(createManualSettlementGateway(client), userId, payload)
