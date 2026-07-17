import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (...parts: readonly string[]): string => readFileSync(join(root, ...parts), 'utf8')
const migrationName = readdirSync(join(root, 'supabase', 'migrations'))
    .find((name) => name.endsWith('_add_atomic_financial_contracts.sql'))
const migrationSql = migrationName ? read('supabase', 'migrations', migrationName) : ''
const databaseSql = read('database.sql')

const financialEntrypoints = [
    ['toss-payment-order', 'index.ts'],
    ['toss-payment-confirm', 'index.ts'],
    ['toss-payment-fail', 'index.ts'],
    ['toss-payment-webhook', 'index.ts'],
    ['toss-payment-cancel', 'index.ts'],
    ['trade-workflow', 'work-handlers.ts'],
    ['trade-workflow', 'admin-handlers.ts'],
    ['trade-automation-runner', 'index.ts'],
] as const

describe('atomic financial contracts', () => {
    it('defines durable operations, provider inbox, and reconciliation outbox on both SQL surfaces', () => {
        for (const sql of [migrationSql, databaseSql]) {
            expect(sql).toMatch(/create table if not exists public\.financial_operations/i)
            expect(sql).toMatch(/create table if not exists public\.financial_provider_inbox/i)
            expect(sql).toMatch(/create table if not exists public\.financial_reconciliation_outbox/i)
            expect(sql).toMatch(/unique \(business_key\)/i)
            expect(sql).toMatch(/unique \(provider, provider_event_key\)/i)
            expect(sql).toMatch(/unique \(operation_id\)/i)
        }
    })

    it('keeps every contract service-role-only and invoker-secured', () => {
        expect(migrationSql).not.toMatch(/security\s+definer/i)
        expect(migrationSql).toMatch(/security\s+invoker/i)
        expect(migrationSql).toMatch(/revoke execute on function[\s\S]*from public, anon, authenticated/i)
        expect(migrationSql).toMatch(/grant execute on function[\s\S]*to service_role/i)
    })

    it('locks rows and protects expected and terminal states before money transitions', () => {
        expect(migrationSql).toMatch(/for update/i)
        expect(migrationSql).toMatch(/order by[\s\S]*for update/i)
        expect(migrationSql).toMatch(/currency = 'KRW'/i)
        expect(migrationSql).toMatch(/affected_rows/i)
        expect(migrationSql).toMatch(/manual_review/i)
        expect(migrationSql).toMatch(/PARTIAL_CANCELED/i)
        expect(migrationSql).toMatch(/approved[\s\S]*refunded[\s\S]*failed/i)
    })

    it('routes every financial entrypoint through database contracts', () => {
        for (const [folder, file] of financialEntrypoints) {
            const source = read('supabase', 'functions', folder, file)
            expect(source, `${folder}/${file}`).toMatch(/executeFinancialRpc\([^,]+, ['"](?:begin_|finalize_|record_|apply_|claim_)/)
        }
    })

    it('does not directly finalize money state in provider-facing handlers', () => {
        for (const folder of ['toss-payment-confirm', 'toss-payment-fail', 'toss-payment-webhook', 'toss-payment-cancel']) {
            const source = read('supabase', 'functions', folder, 'index.ts')
            expect(source, folder).not.toMatch(/\.from\(['"](?:payment_orders|proposals|works|settlement_payouts)['"]\)\s*\.update/)
        }
    })

    it('reports automation outcomes as attempted equals succeeded plus skipped plus failed', () => {
        const source = read('supabase', 'functions', 'trade-automation-runner', 'index.ts')
        expect(source).toMatch(/attempted/)
        expect(source).toMatch(/succeeded/)
        expect(source).toMatch(/skipped/)
        expect(source).toMatch(/failed/)
    })

    it('persists reconciliation in a separate transaction after provider outcomes become uncertain', () => {
        expect(migrationSql).toMatch(/create or replace function public\.record_financial_reconciliation/i)
        expect(migrationSql).not.toMatch(/finalize_payment_confirmation[\s\S]*?exception when others[\s\S]*?provider_succeeded_db_finalize_failed/i)
        expect(migrationSql).not.toMatch(/finalize_payment_refund[\s\S]*?exception when others[\s\S]*?provider_refund_succeeded_db_finalize_failed/i)
        expect(read('supabase', 'functions', 'toss-payment-confirm', 'index.ts')).toMatch(/record_financial_reconciliation/)
        expect(read('supabase', 'functions', 'toss-payment-cancel', 'index.ts')).toMatch(/record_financial_reconciliation/)
    })

    it('requires provider evidence and policy approval before settlement finalization', () => {
        expect(migrationSql).toMatch(/create or replace function public\.finalize_settlement_payout/i)
        expect(migrationSql).toMatch(/p_provider_transfer_reference text/i)
        expect(migrationSql).toMatch(/p_policy_authorized boolean/i)
        expect(migrationSql).toMatch(/provider payout evidence required/i)
        expect(migrationSql).toMatch(/work_row\.expert_payout <> p_amount/i)
        expect(migrationSql).toMatch(/account_row\.expert_id <> payout_row\.expert_id/i)
    })

    it('verifies webhook state with Toss before journaling canonical provider data', () => {
        const source = read('supabase', 'functions', 'toss-payment-webhook', 'index.ts')
        expect(source.indexOf('getTossPaymentByOrderId')).toBeLessThan(source.indexOf("'record_provider_event'"))
        expect(source).toMatch(/`verified:\$\{orderId\}:\$\{paymentKey\}:\$\{status\}`/)
        expect(source).not.toMatch(/tosspayments-webhook-transmission-id/)
        expect(source).toMatch(/p_payload: \{[\s\S]*orderId: payment\.orderId/)
        expect(source).not.toMatch(/p_payload: payment/)
        expect(source).toMatch(/payment\.status === 'CANCELED'/)
        expect(source).toMatch(/p_status: 'manual_review'/)
        expect(source).toMatch(/record_financial_reconciliation/)
        expect(source).not.toMatch(/verifiedAmount:/)
    })

    it('requires an active non-withdrawn administrator before calling the refund provider', () => {
        const source = read('supabase', 'functions', 'toss-payment-cancel', 'index.ts')
        expect(source).toMatch(/select\('account_status, withdrawn_at'\)/)
        expect(source).toMatch(/value\.account_status === 'active'/)
        expect(source).toMatch(/value\.withdrawn_at === null/)
        expect(source.indexOf('isActiveProfile(profile)')).toBeLessThan(source.indexOf('await cancelTossPayment'))
    })

    it('rejects withdrawn experts before settlement service-role mutations', () => {
        const source = read('supabase', 'functions', 'trade-workflow', 'work-handlers.ts')
        expect(source).toMatch(/select\('account_status, withdrawn_at'\)[\s\S]*profile\.account_status !== 'active'[\s\S]*profile\.withdrawn_at !== null/)
        expect(source.indexOf("select('account_status, withdrawn_at')")).toBeLessThan(source.indexOf("'begin_settlement_request'"))
        expect(migrationSql).toMatch(/function public\.begin_settlement_request[\s\S]*account_status = 'active' and withdrawn_at is null[\s\S]*active expert account required/i)
    })

    it('preserves milestone steps and resolves reconciliation after successful recovery', () => {
        expect(migrationSql).toMatch(/jsonb_array_elements_text\(proposal_row\.milestones\)/)
        expect(migrationSql).toMatch(/source\.step_order = 1 then 'in_progress' else 'waiting'/)
        expect(migrationSql).toMatch(/financial_reconciliation_outbox set status = 'resolved'/)
    })

    it('returns committed cancellation, review, settlement, and automation operations on replay', () => {
        const cancellationReplay = migrationSql.indexOf("operation_row.metadata ->> 'action' <> 'cancellation'")
        const cancellationStateCheck = migrationSql.indexOf("work_row.status in ('completed', 'cancelled')")
        expect(cancellationReplay).toBeGreaterThan(-1)
        expect(cancellationReplay).toBeLessThan(cancellationStateCheck)
        const reviewReplay = migrationSql.indexOf("operation_row.metadata ->> 'action' <> 'deliverable_review'")
        const reviewStateCheck = migrationSql.indexOf("work_row.status <> 'submitted'")
        expect(reviewReplay).toBeGreaterThan(-1)
        expect(reviewReplay).toBeLessThan(reviewStateCheck)
        expect(migrationSql).toMatch(/work_row\.settlement_requested_at is not null[\s\S]*settlement replay invariant mismatch/)
        expect(migrationSql).toMatch(/on conflict \(business_key\) do nothing returning \* into run_operation/)
        expect(migrationSql).toMatch(/'duplicate', true/)
    })

    it('requires active expert and existing payout account invariants for settlement', () => {
        expect(migrationSql).toMatch(/id = p_expert_id and account_status = 'active' and withdrawn_at is null/)
        expect(migrationSql).toMatch(/if not found or payout_row\.payout_account_id is null then/)
        const source = read('supabase', 'functions', 'trade-workflow', 'work-handlers.ts')
        expect(source).toMatch(/select\('account_status, withdrawn_at'\)/)
        expect(source).toMatch(/profile\.account_status !== 'active'/)
    })

    it('accepts client failure only after provider verification of a terminal status', () => {
        const source = read('supabase', 'functions', 'toss-payment-fail', 'index.ts')
        expect(source.indexOf(".eq('client_id', user.id)")).toBeLessThan(source.indexOf('await getTossPaymentByOrderId'))
        expect(source.indexOf('await getTossPaymentByOrderId')).toBeLessThan(source.indexOf("'record_payment_failure'"))
        expect(source).toMatch(/payment\.status !== 'EXPIRED' && payment\.status !== 'ABORTED'/)
        expect(source).toMatch(/p_business_key: `failure:\$\{payment\.orderId\}`/)
    })

    it('rejects unknown local webhook orders before using provider credentials', () => {
        const source = read('supabase', 'functions', 'toss-payment-webhook', 'index.ts')
        expect(source.indexOf(".from('payment_orders')")).toBeLessThan(source.indexOf('await getTossPaymentByOrderId'))
        expect(source).toMatch(/if \(!localOrder\) return jsonResponse/)
    })
})
