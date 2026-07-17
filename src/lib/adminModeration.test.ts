import { describe, expect, it, vi } from 'vitest'
import type { AdminAction } from './adminStorage'

const adminWorkAction: AdminAction = {
    id: 'admin-action-work-01',
    adminId: 'admin-user-01',
    targetType: 'work',
    targetId: 'work-admin-01',
    actionType: 'mark_settlement_settled',
    reason: '정산 완료',
    createdAt: '2026-07-12T00:00:00.000Z',
}

describe('admin moderation trade boundary', () => {
    it('routes work-target admin moderation actions through the trade workflow Edge Function', async () => {
        vi.resetModules()
        const invoke = vi.fn().mockResolvedValue({ data: {}, error: null })
        const from = vi.fn()
        vi.doMock('./supabase', () => ({ supabase: { functions: { invoke }, from } }))

        const { applyAdminActionEffect } = await import('./adminModeration')

        await applyAdminActionEffect(adminWorkAction)

        expect(invoke).toHaveBeenCalledWith('trade-workflow', {
            body: {
                type: 'admin_moderation_action',
                action: adminWorkAction,
            },
        })
        expect(from).not.toHaveBeenCalledWith('works')
        expect(from).not.toHaveBeenCalledWith('settlement_payouts')
    })

    it.each([
        ['restrict', 'user'],
        ['close_consultation', 'consultation'],
        ['hide_review', 'review'],
    ] as const)('routes %s through the server boundary without direct table mutation', async (actionType, targetType) => {
        vi.resetModules()
        const invoke = vi.fn().mockResolvedValue({ data: {}, error: null })
        const from = vi.fn()
        vi.doMock('./supabase', () => ({ supabase: { functions: { invoke }, from } }))

        const { applyAdminActionEffect } = await import('./adminModeration')
        const action: AdminAction = {
            ...adminWorkAction,
            actionType,
            targetId: `target-${targetType}`,
            targetType,
        }

        await applyAdminActionEffect(action)

        expect(invoke).toHaveBeenCalledWith('trade-workflow', {
            body: { type: 'admin_moderation_action', action },
        })
        expect(from).not.toHaveBeenCalled()
    })

    it('surfaces configured Supabase errors instead of applying a local fallback', async () => {
        vi.resetModules()
        const invoke = vi.fn().mockResolvedValue({ data: null, error: new Error('permission denied') })
        vi.doMock('./supabase', () => ({ supabase: { functions: { invoke }, from: vi.fn() } }))

        const { applyAdminActionEffect } = await import('./adminModeration')

        await expect(applyAdminActionEffect({
            ...adminWorkAction,
            actionType: 'restrict',
            targetId: 'target-user',
            targetType: 'user',
        })).rejects.toThrow()
    })

    it('routes Toss refunds through the provider-backed cancellation boundary', async () => {
        vi.resetModules()
        const invoke = vi.fn().mockResolvedValue({ data: {}, error: null })
        vi.doMock('./supabase', () => ({ supabase: { functions: { invoke }, from: vi.fn() } }))
        const { applyAdminActionEffect } = await import('./adminModeration')
        const action: AdminAction = { ...adminWorkAction, actionType: 'execute_toss_refund', reason: 'Customer refund' }

        await applyAdminActionEffect(action)

        expect(invoke).toHaveBeenCalledWith('toss-payment-cancel', {
            body: { workId: action.targetId, reason: action.reason },
        })
    })
})
