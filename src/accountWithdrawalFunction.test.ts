import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const accountWithdrawalSource = readFileSync(
    join(process.cwd(), 'supabase', 'functions', 'account-withdrawal', 'index.ts'),
    'utf8',
)
const accountWithdrawalHandlerSource = readFileSync(
    join(process.cwd(), 'supabase', 'functions', 'account-withdrawal', 'handler.ts'),
    'utf8',
)

describe('account-withdrawal Edge Function', () => {
    it('requires an authenticated user before anonymizing account data', () => {
        expect(accountWithdrawalSource).toMatch(/const user = await requireUser\(request\)/)
        expect(accountWithdrawalHandlerSource).toMatch(/Authenticated user is required/)
        expect(accountWithdrawalHandlerSource.indexOf('dependencies.authenticate(request)'))
            .toBeLessThan(accountWithdrawalHandlerSource.indexOf('dependencies.blockAndAnonymize(actor.userId)'))
    })

    it('delegates one transactional account block and separately revokes global sessions', () => {
        expect(accountWithdrawalSource).toMatch(/rpc\('withdraw_account'/)
        expect(accountWithdrawalSource).toMatch(/auth\.admin\.signOut\(accessToken, 'global'\)/)
        expect(accountWithdrawalSource).toMatch(/rpc\('record_withdrawal_session_revocation'/)
        expect(accountWithdrawalSource).not.toMatch(/\.delete\(\)/)
        expect(accountWithdrawalSource).not.toMatch(/request\.json\(\)/)
    })
})
