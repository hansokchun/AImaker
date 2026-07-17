import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const paymentWorkflowSource = readFileSync(
    join(process.cwd(), 'supabase', 'functions', '_shared', 'payment-workflow.ts'),
    'utf8',
)

describe('payment workflow shared Edge Function helper', () => {
    it('routes approved payment repair through the atomic confirmation contracts', () => {
        expect(paymentWorkflowSource).toMatch(/executeFinancialRpc\(input\.client, 'begin_payment_confirmation'/)
        expect(paymentWorkflowSource).toMatch(/executeFinancialRpc\(input\.client, 'finalize_payment_confirmation'/)
        expect(paymentWorkflowSource).not.toMatch(/\.from\('payment_orders'\)/)
        expect(paymentWorkflowSource).not.toMatch(/\.from\('proposals'\)/)
        expect(paymentWorkflowSource).not.toMatch(/\.from\('works'\)/)
    })
})
