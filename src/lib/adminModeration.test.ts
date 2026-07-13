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
})
