import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const accountWithdrawalSource = readFileSync(
    join(process.cwd(), 'supabase', 'functions', 'account-withdrawal', 'index.ts'),
    'utf8',
)

describe('account-withdrawal Edge Function', () => {
    it('requires an authenticated user before anonymizing account data', () => {
        expect(accountWithdrawalSource).toMatch(/const user = await requireUser\(request\)/)
        expect(accountWithdrawalSource).toMatch(/Authenticated user is required/)
        expect(accountWithdrawalSource.indexOf('await requireUser(request)'))
            .toBeLessThan(accountWithdrawalSource.indexOf('createServiceClient()'))
    })

    it('hides products and anonymizes the public profile while preserving transaction records', () => {
        expect(accountWithdrawalSource).toMatch(/from\('expert_products'\)\.update/)
        expect(accountWithdrawalSource).toMatch(/status: 'hidden'/)
        expect(accountWithdrawalSource).toMatch(/from\('profiles'\)\.update/)
        expect(accountWithdrawalSource).toMatch(/account_status: 'restricted'/)
        expect(accountWithdrawalSource).not.toMatch(/from\('works'\)\.delete/)
        expect(accountWithdrawalSource).not.toMatch(/from\('proposals'\)\.delete/)
    })
})
