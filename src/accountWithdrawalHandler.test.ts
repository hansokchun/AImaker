import { describe, expect, it, vi } from 'vitest'
import { handleAccountWithdrawal, type AccountWithdrawalDependencies } from '../supabase/functions/account-withdrawal/handler.ts'

const authenticatedUser = {
    accessToken: 'test-access-token',
    userId: '11111111-1111-4111-8111-111111111111',
}

const createDependencies = (): AccountWithdrawalDependencies => ({
    authenticate: vi.fn(async () => authenticatedUser),
    blockAndAnonymize: vi.fn(async () => undefined),
    recordSessionRevocation: vi.fn(async () => undefined),
    revokeGlobalSessions: vi.fn(async () => undefined),
})

describe('account withdrawal request boundary', () => {
    it('uses the authenticated actor and ignores a client-supplied user ID', async () => {
        const dependencies = createDependencies()
        const request = new Request('http://localhost/functions/v1/account-withdrawal', {
            body: JSON.stringify({ userId: 'attacker-selected-user' }),
            method: 'POST',
        })

        const response = await handleAccountWithdrawal(request, dependencies)

        expect(response.status).toBe(200)
        expect(dependencies.blockAndAnonymize).toHaveBeenCalledWith(authenticatedUser.userId)
        expect(dependencies.revokeGlobalSessions).toHaveBeenCalledWith(authenticatedUser.accessToken)
        expect(dependencies.recordSessionRevocation).toHaveBeenCalledWith(authenticatedUser.userId, {
            detail: null,
            succeeded: true,
        })
    })

    it('does not revoke sessions when the transactional account block fails', async () => {
        const dependencies = createDependencies()
        vi.mocked(dependencies.blockAndAnonymize).mockRejectedValue(new Error('transaction failed'))

        const response = await handleAccountWithdrawal(
            new Request('http://localhost/functions/v1/account-withdrawal', { method: 'POST' }),
            dependencies,
        )

        expect(response.status).toBe(500)
        expect(dependencies.revokeGlobalSessions).not.toHaveBeenCalled()
        expect(dependencies.recordSessionRevocation).not.toHaveBeenCalled()
    })

    it('keeps the access block and records recovery when global revocation fails', async () => {
        const dependencies = createDependencies()
        vi.mocked(dependencies.revokeGlobalSessions).mockRejectedValue(new Error('auth unavailable'))

        const response = await handleAccountWithdrawal(
            new Request('http://localhost/functions/v1/account-withdrawal', { method: 'POST' }),
            dependencies,
        )

        expect(response.status).toBe(202)
        expect(dependencies.recordSessionRevocation).toHaveBeenCalledWith(authenticatedUser.userId, {
            detail: 'auth unavailable',
            succeeded: false,
        })
        await expect(response.json()).resolves.toMatchObject({
            accessBlocked: true,
            sessionRevocation: 'recovery_required',
        })
    })

    it('reports an unrecorded session outcome without undoing the access block', async () => {
        const dependencies = createDependencies()
        vi.mocked(dependencies.recordSessionRevocation).mockRejectedValue(new Error('log unavailable'))

        const response = await handleAccountWithdrawal(
            new Request('http://localhost/functions/v1/account-withdrawal', { method: 'POST' }),
            dependencies,
        )

        expect(response.status).toBe(500)
        await expect(response.json()).resolves.toMatchObject({
            accessBlocked: true,
            sessionRevocation: 'outcome_unrecorded',
        })
    })

    it('rejects stale or missing authentication without changing data', async () => {
        const dependencies = createDependencies()
        vi.mocked(dependencies.authenticate).mockRejectedValue(new Error('stale session'))

        const response = await handleAccountWithdrawal(
            new Request('http://localhost/functions/v1/account-withdrawal', { method: 'POST' }),
            dependencies,
        )

        expect(response.status).toBe(401)
        expect(dependencies.blockAndAnonymize).not.toHaveBeenCalled()
    })
})
