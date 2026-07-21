import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260714090000_harden_identity_consultation_withdrawal.sql',
)
const migration = readFileSync(migrationPath, 'utf8')
const archivedMigration = readFileSync(join(
    process.cwd(),
    'supabase',
    'migration-history',
    '20260714090000_harden_identity_consultation_withdrawal.sql',
), 'utf8')
const database = readFileSync(join(process.cwd(), 'database.sql'), 'utf8')
const adminModerationSource = readFileSync(join(process.cwd(), 'src', 'lib', 'adminModeration.ts'), 'utf8')
const adminStorageSource = readFileSync(join(process.cwd(), 'src', 'lib', 'adminStorage.ts'), 'utf8')
const storageSource = readFileSync(join(process.cwd(), 'src', 'lib', 'storage.ts'), 'utf8')

describe.each([
    ['additive migration', migration],
    ['database mirror', database],
])('%s security boundaries', (_label, sql) => {
    it('protects server-managed withdrawal fields while leaving is_expert user-selectable', () => {
        expect(sql).toMatch(/add column if not exists withdrawn_at timestamptz/i)
        expect(sql).toMatch(/new\.account_status is distinct from old\.account_status/i)
        expect(sql).toMatch(/new\.withdrawn_at is distinct from old\.withdrawn_at/i)
        expect(sql).toMatch(/grant update\s*\([\s\S]*is_expert[\s\S]*\)\s*on public\.profiles to authenticated/i)
    })

    it('requires owner-folder validated avatar uploads and retains public legacy reads', () => {
        expect(sql).toMatch(/create policy "Users can upload own profile images"[\s\S]*storage\.foldername\(name\)\)\[1\][\s\S]*auth\.uid/i)
        expect(sql).toMatch(/metadata->>'mimetype'[\s\S]*image\/jpeg[\s\S]*image\/png[\s\S]*image\/webp/i)
        expect(sql).toMatch(/metadata->>'size'[\s\S]*5242880/i)
        expect(sql).toMatch(/update storage\.buckets[\s\S]*file_size_limit = 5242880[\s\S]*allowed_mime_types[\s\S]*image\/webp/i)
        expect(sql).toMatch(/create policy "Public can read profile images"/i)
        expect(sql).toMatch(/create policy "Users can upload own profile images"[\s\S]*account_status = 'active'[\s\S]*withdrawn_at is null/i)
    })

    it('closes direct consultation mutations and grants only participant RPCs', () => {
        expect(sql).toMatch(/drop policy if exists "Consultation participants can update consultations"/i)
        expect(sql).toMatch(/drop policy if exists "Consultation participants can insert messages"/i)
        expect(sql).toMatch(/create or replace function public\.create_consultation/i)
        expect(sql).toMatch(/create or replace function public\.append_consultation_message/i)
        expect(sql).toMatch(/create or replace function public\.transition_consultation/i)
        expect(sql).toMatch(/grant execute on function public\.append_consultation_message[\s\S]*to authenticated/i)
        expect(sql).toMatch(/create policy "Consultation participants can view consultations"[\s\S]*account_status = 'active'[\s\S]*withdrawn_at is null/i)
        expect(sql).toMatch(/create policy "Consultation participants can view messages"[\s\S]*account_status = 'active'[\s\S]*withdrawn_at is null/i)
        expect(sql).toMatch(/function public\.append_consultation_message[\s\S]*for update[\s\S]*open active-participant consultation required/i)
        expect(sql).toMatch(/function public\.transition_consultation[\s\S]*active participant account required[\s\S]*last_message_at = now\(\)/i)
    })

    it('removes direct admin mutation and audit bypass policies', () => {
        expect(sql).toMatch(/drop policy if exists "Admins can insert admin actions" on public\.admin_actions/i)
        expect(sql).toMatch(/drop policy if exists "Admins can update reports" on public\.admin_reports/i)
        expect(sql).toMatch(/drop policy if exists "Admins can update profiles" on public\.profiles/i)
        expect(sql).toMatch(/drop policy if exists "Admins can update products" on public\.expert_products/i)
        expect(sql).toMatch(/drop policy if exists "Admins can update reviews" on public\.reviews/i)
        expect(sql).toMatch(/revoke insert on public\.admin_actions from authenticated/i)
        expect(sql).toMatch(/function public\.apply_admin_moderation_action[\s\S]*active admin role required/i)
        expect(sql).toMatch(/target_type_value = 'work'[\s\S]*open_dispute[\s\S]*resolve_dispute/i)
    })

    it('blocks stale withdrawn experts and admins from payout or privileged reads', () => {
        expect(sql).toMatch(/create policy "Experts can view own payout account"[\s\S]*account_status = 'active'[\s\S]*withdrawn_at is null/i)
        expect(sql).toMatch(/create policy "Experts can upsert own payout account"[\s\S]*account_status = 'active'[\s\S]*withdrawn_at is null/i)
        expect(sql).toMatch(/create policy "Experts can update own payout account"[\s\S]*account_status = 'active'[\s\S]*withdrawn_at is null/i)
        expect(sql).toMatch(/create or replace function public\.is_active_admin[\s\S]*account_status = 'active'[\s\S]*withdrawn_at is null/i)
        expect(sql).toMatch(/create policy "Admins can view consultations"[\s\S]*public\.is_active_admin/i)
        expect(sql).toMatch(/create policy "Admins can view consultation messages"[\s\S]*public\.is_active_admin/i)
        expect(sql).toMatch(/create policy "Admins can view payout accounts"[\s\S]*public\.is_active_admin/i)
        const publicReviewPolicy = sql.match(/create policy "Public can read reviews"[\s\S]*?;/i)?.[0] ?? ''
        expect(publicReviewPolicy).toMatch(/status = 'published'/i)
        expect(publicReviewPolicy).not.toMatch(/public\.is_active_admin/i)
    })

    it('prevents stale JWTs from restoring anonymized data or using other Storage writes', () => {
        expect(sql).toMatch(/function public\.guard_inactive_authenticated_mutation[\s\S]*active account required/i)
        expect(sql).toMatch(/trigger guard_inactive_authenticated_mutation[\s\S]*on public\.expert_profiles/i)
        expect(sql).toMatch(/trigger guard_inactive_authenticated_mutation[\s\S]*on public\.notification_preferences/i)
        expect(sql).toMatch(/trigger guard_inactive_authenticated_mutation[\s\S]*on public\.expert_products/i)
        expect(sql).toMatch(/trigger guard_inactive_authenticated_mutation[\s\S]*on public\.work_messages/i)
        expect(sql).toMatch(/create policy "Work participants can view messages"[\s\S]*account_status = 'active'[\s\S]*withdrawn_at is null/i)
        expect(sql).toMatch(/create policy "Work participants can insert messages"[\s\S]*sender_id = \(select auth\.uid\(\)\)[\s\S]*account_status = 'active'[\s\S]*withdrawn_at is null/i)
        expect(sql).toMatch(/create policy "Users can upload own product samples"[\s\S]*account_status = 'active'[\s\S]*withdrawn_at is null/i)
        if (_label === 'database mirror') {
            expect(sql.lastIndexOf('drop policy if exists "Experts can upload deliverable files"')).toBeGreaterThan(
                sql.lastIndexOf('create policy "Experts can upload deliverable files"'),
            )
        } else {
            expect(sql).toMatch(/create policy "Experts can upload deliverable files"[\s\S]*account_status = 'active'[\s\S]*withdrawn_at is null/i)
        }
    })

    it('keeps withdrawal transactional and service-only without physical deletion', () => {
        const functionSql = sql.match(/create or replace function public\.withdraw_account[\s\S]*?\$\$;/i)?.[0] ?? ''
        expect(functionSql).toMatch(/update public\.profiles/i)
        expect(functionSql).toMatch(/account_status = 'restricted'/i)
        expect(functionSql).toMatch(/withdrawn_at = coalesce\(withdrawn_at, now\(\)\)/i)
        expect(functionSql).toMatch(/update public\.expert_payout_accounts set bank_name = '', account_number = '', account_holder = '', verified_at = null/i)
        expect(functionSql).not.toMatch(/\bdelete\s+from\b/i)
        expect(sql).toMatch(/revoke all on function public\.withdraw_account\(uuid\) from public, anon, authenticated/i)
        expect(sql).toMatch(/grant execute on function public\.withdraw_account\(uuid\) to service_role/i)
    })
})

describe('security migration mirrors', () => {
    it('keeps the active and archived additive migration byte-identical', () => {
        expect(archivedMigration).toBe(migration)
    })

    it('contains the complete additive migration in the database snapshot', () => {
        expect(database).toContain(migration)
    })
})

describe('client mutation boundaries', () => {
    it('uses consultation RPCs without direct protected status or timestamp updates', () => {
        expect(storageSource).toMatch(/rpc\('create_consultation'/)
        expect(storageSource).toMatch(/rpc\('append_consultation_message'/)
        expect(storageSource).toMatch(/rpc\('transition_consultation'/)
        expect(storageSource).not.toMatch(/\.from\('consultations'\)[\s\S]{0,160}\.update\(/)
        expect(storageSource).not.toMatch(/\.from\('consultation_messages'\)[\s\S]{0,160}\.insert\(/)
    })

    it('routes configured admin mutations through Edge and writes no duplicate client audit', () => {
        expect(adminModerationSource).toMatch(/functions\.invoke\('trade-workflow'/)
        expect(adminModerationSource).not.toMatch(/\.from\(/)
        expect(adminStorageSource).not.toMatch(/from\('admin_actions'\)\.insert/)
    })
})
