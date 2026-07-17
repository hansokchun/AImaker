import {
    completeManualSettlement,
    isManualSettlementPayload,
    type ManualSettlementGateway,
} from './manual-settlement.ts'
import { isWorkflowRequest } from './validation.ts'

const assertEquals = (actual: unknown, expected: unknown): void => {
    if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`)
}

const givenGateway = (): ManualSettlementGateway & {
    readonly finalized: readonly unknown[]
    readonly notifications: readonly unknown[]
} => {
    const finalized: unknown[] = []
    const notifications: unknown[] = []
    return {
        finalized,
        notifications,
        isActiveAdmin: async () => true,
        findSettlement: async () => ({
            amount: 1300,
            expertId: 'expert-id',
            operationId: 'operation-id',
            payoutAccountId: 'account-id',
            payoutId: 'payout-id',
        }),
        finalize: async (input) => {
            finalized.push(input)
            return { operationId: input.operationId, payoutId: input.payoutId }
        },
        hasPaidNotification: async () => notifications.length > 0,
        queuePaidNotification: async (input) => {
            notifications.push(input)
            return true
        },
    }
}

Deno.test('manual settlement rejects missing or blank transfer references at the request boundary', () => {
    // Given: malformed browser requests.
    // When: each request is parsed.
    // Then: neither can enter the settlement flow.
    assertEquals(isManualSettlementPayload({ workId: 'work-id' }), false)
    assertEquals(isManualSettlementPayload({ workId: 'work-id', transferReference: '   ' }), false)
    assertEquals(isManualSettlementPayload({ workId: 'work-id', transferReference: '@@@' }), false)
    assertEquals(isWorkflowRequest({ type: 'complete_manual_settlement', settlement: { workId: 'work-id', transferReference: '@@@' } }), false)
})

Deno.test('manual settlement rejects a non-admin before reading or finalizing payout data', async () => {
    // Given: a caller without an active administrator record.
    const gateway = givenGateway()
    const nonAdminGateway: ManualSettlementGateway = { ...gateway, isActiveAdmin: async () => false }

    // When: the caller requests manual settlement completion.
    const result = await completeManualSettlement(nonAdminGateway, 'member-id', {
        transferReference: 'bank-transfer-20260717-1',
        workId: 'work-id',
    })

    // Then: no financial finalization or expert notification occurs.
    assertEquals(result.kind, 'forbidden')
    assertEquals(gateway.finalized.length, 0)
    assertEquals(gateway.notifications.length, 0)
})

Deno.test('manual settlement resolves financial values server-side then finalizes and notifies only the expert', async () => {
    // Given: an active administrator and a pending server-side settlement record.
    const gateway = givenGateway()

    // When: the administrator records a completed bank transfer.
    const result = await completeManualSettlement(gateway, 'admin-id', {
        transferReference: 'bank-transfer-20260717-1',
        workId: 'work-id',
    })

    // Then: browser-supplied financial values are absent, while server values finalize the RPC.
    assertEquals(result.kind, 'completed')
    assertEquals(gateway.finalized.length, 1)
    assertEquals(JSON.stringify(gateway.finalized[0]), JSON.stringify({
        amount: 1300,
        operationId: 'operation-id',
        payoutAccountId: 'account-id',
        payoutId: 'payout-id',
        transferReference: 'bank-transfer-20260717-1',
    }))
    assertEquals(JSON.stringify(gateway.notifications[0]), JSON.stringify({ expertId: 'expert-id', workId: 'work-id' }))
})

Deno.test('manual settlement retry does not queue a duplicate expert notification', async () => {
    // Given: a settlement whose first completion has already queued the notification.
    const gateway = givenGateway()
    await completeManualSettlement(gateway, 'admin-id', {
        transferReference: 'bank-transfer-20260717-1',
        workId: 'work-id',
    })

    // When: the same completion is retried.
    const result = await completeManualSettlement(gateway, 'admin-id', {
        transferReference: 'bank-transfer-20260717-1',
        workId: 'work-id',
    })

    // Then: the idempotent finalizer may run again, but only one notification exists.
    assertEquals(result.kind, 'completed')
    assertEquals(gateway.finalized.length, 2)
    assertEquals(gateway.notifications.length, 1)
})

Deno.test('manual settlement treats a concurrent duplicate notification as already queued', async () => {
    // Given: another request inserted the same notification after this request checked.
    const gateway = givenGateway()
    let notificationExists = false
    const concurrentGateway: ManualSettlementGateway = {
        ...gateway,
        hasPaidNotification: async () => notificationExists,
        queuePaidNotification: async () => {
            notificationExists = true
            return false
        },
    }

    // When: the unique index rejects this request's duplicate insert.
    const result = await completeManualSettlement(concurrentGateway, 'admin-id', {
        transferReference: 'bank-transfer-20260717-1',
        workId: 'work-id',
    })

    // Then: completion remains successful because exactly one notification already exists.
    assertEquals(result.kind, 'completed')
})

Deno.test('manual settlement does not notify the expert when financial finalization fails', async () => {
    // Given: a finalizer that rejects the server-side settlement transition.
    const gateway = givenGateway()
    const rejectingGateway: ManualSettlementGateway = {
        ...gateway,
        finalize: async () => { throw new Error('finalization rejected') },
    }

    // When: the administrator attempts completion.
    let error: unknown = null
    try {
        await completeManualSettlement(rejectingGateway, 'admin-id', {
            transferReference: 'bank-transfer-20260717-1',
            workId: 'work-id',
        })
    } catch (caught) {
        error = caught
    }

    // Then: the failure is visible and no expert notification is queued.
    assertEquals(error instanceof Error, true)
    assertEquals(gateway.notifications.length, 0)
})
