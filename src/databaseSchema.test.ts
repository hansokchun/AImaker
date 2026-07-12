import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(process.cwd(), 'database.sql'), 'utf8')
const launchVerificationMigrationSql = readFileSync(
    join(process.cwd(), 'supabase', 'migrations', '20260617084516_add_launch_verification_fields.sql'),
    'utf8',
)

describe('database.sql', () => {
    it('defines the transaction tables from SupabasePlan', () => {
        const tables = [
            'profiles',
            'expert_products',
            'consultations',
            'consultation_messages',
            'service_requests',
            'proposals',
            'payment_orders',
            'works',
            'expert_payout_accounts',
            'settlement_payouts',
            'notification_preferences',
            'notification_events',
            'work_steps',
            'deliverables',
            'reviews',
        ]

        for (const table of tables) {
            expect(sql).toMatch(new RegExp(`create table(?: if not exists)? public\\.${table}`, 'i'))
            expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
        }
    })

    it('stores consultation chats for expert inquiry transactions', () => {
        expect(sql).toMatch(/create table(?: if not exists)? public\.consultations/i)
        expect(sql).toMatch(/create table(?: if not exists)? public\.consultation_messages/i)
        expect(sql).toMatch(/product_id uuid references public\.expert_products\(id\)/i)
        expect(sql).toMatch(/consultation_id uuid references public\.consultations\(id\)/i)
        expect(sql).toMatch(/status text not null default 'open'/i)
        expect(sql).toMatch(/last_message_at timestamptz/i)
    })

    it('limits consultation chats to the client and expert participants', () => {
        const consultationPolicy = sql.match(/create policy "Consultation participants can view consultations"[\s\S]*?;/i)?.[0] || ''
        const messagePolicy = sql.match(/create policy "Consultation participants can view messages"[\s\S]*?;/i)?.[0] || ''

        expect(consultationPolicy).toMatch(/auth\.uid\(\) = client_id or auth\.uid\(\) = expert_id/i)
        expect(messagePolicy).toMatch(/exists \([\s\S]*select 1 from public\.consultations/i)
        expect(messagePolicy).toMatch(/consultations\.id = consultation_messages\.consultation_id/i)
        expect(messagePolicy).toMatch(/consultations\.client_id = auth\.uid\(\) or consultations\.expert_id = auth\.uid\(\)/i)
    })

    it('captures the product, proposal, work, deliverable, and review constraints', () => {
        expect(sql).toMatch(/expert_id uuid references public\.profiles\(id\)/i)
        expect(sql).toMatch(/product_id uuid references public\.expert_products\(id\)/i)
        expect(sql).toMatch(/expires_at timestamptz not null default \(now\(\) \+ interval '3 days'\)/i)
        expect(sql).toMatch(/unique \(work_id, client_id\)/i)
        expect(sql).toMatch(/rating integer not null check \(rating between 1 and 5\)/i)
        expect(sql).toMatch(/status text not null default 'published'/i)
        expect(sql).toMatch(/status text not null default 'submitted'/i)
    })

    it('defines the planned storage buckets and policies', () => {
        for (const bucket of ['product-samples', 'deliverable-files', 'profile-images']) {
            expect(sql).toContain(bucket)
        }

        expect(sql).toMatch(/insert into storage\.buckets/i)
        expect(sql).toMatch(/create policy "Public can read product samples"/i)
        expect(sql).toMatch(/create policy "Work participants can read deliverable files"/i)
    })

    it('defines admin role and audit action tables for operations', () => {
        expect(sql).toMatch(/create table(?: if not exists)? public\.admin_users/i)
        expect(sql).toMatch(/create table(?: if not exists)? public\.admin_reports/i)
        expect(sql).toMatch(/create table(?: if not exists)? public\.admin_actions/i)
        expect(sql).toMatch(/alter table public\.admin_users enable row level security/i)
        expect(sql).toMatch(/alter table public\.admin_reports enable row level security/i)
        expect(sql).toMatch(/alter table public\.admin_actions enable row level security/i)
        expect(sql).toMatch(/create policy "Admins can view reports"/i)
        expect(sql).toMatch(/create policy "Authenticated users can create reports"/i)
        expect(sql).toMatch(/reporter_id = auth\.uid\(\)/i)
        expect(sql).toMatch(/create policy "Admins can update reports"/i)
        expect(sql).toMatch(/create policy "Admins can view consultation messages"/i)
        expect(sql).toMatch(/create policy "Admins can view work messages"/i)
        expect(sql).toMatch(/create policy "Admins can update consultations"/i)
        expect(sql).toMatch(/create policy "Admins can update works"/i)
        expect(sql).toMatch(/create policy "Admins can update profiles"/i)
        expect(sql).toMatch(/create policy "Admins can insert admin actions"/i)
        expect(sql).toMatch(/release_restriction/i)
        expect(sql).toMatch(/restore_product/i)
        expect(sql).toMatch(/feature_product/i)
        expect(sql).toMatch(/move_product_up/i)
        expect(sql).toMatch(/resolve_report/i)
        expect(sql).toMatch(/dismiss_report/i)
        expect(sql).toMatch(/hide_review/i)
        expect(sql).toMatch(/restore_review/i)
        expect(sql).toMatch(/mark_settlement_pending/i)
        expect(sql).toMatch(/mark_settlement_settled/i)
        expect(sql).toMatch(/mark_refund_pending/i)
        expect(sql).toMatch(/execute_toss_refund/i)
        expect(sql).toMatch(/open_dispute/i)
        expect(sql).toMatch(/resolve_dispute/i)
        expect(sql).toMatch(/create policy "Admins can update reviews"/i)
    })

    it('drops policies and triggers before recreating them for safe reruns', () => {
        expect(sql).toMatch(/drop policy if exists "Users can view own profile" on public\.profiles;/i)
        expect(sql).toMatch(/drop trigger if exists set_work_steps_updated_at on public\.work_steps;/i)
        expect(sql).toMatch(/drop policy if exists "Public can read product samples" on storage\.objects;/i)
    })

    it('keeps profile email private by limiting profiles select to the owner', () => {
        expect(sql).not.toMatch(/create policy "Public profiles are viewable by everyone"[\s\S]*?using \(true\);/i)
        expect(sql).toMatch(/create policy "Users can view own profile"[\s\S]*?on public\.profiles for select[\s\S]*?using \(auth\.uid\(\) = id\);/i)
    })

    it('allows users to delete their own profile for withdrawal cleanup', () => {
        expect(sql).toMatch(/create policy "Users can delete own profile"[\s\S]*?on public\.profiles for delete[\s\S]*?using \(\(select auth\.uid\(\)\) = id\);/i)
    })

    it('does not expose submitted service requests as a public request board', () => {
        expect(sql).toMatch(/drop policy if exists "Authenticated users can view submitted requests" on public\.service_requests;/i)
        expect(sql).not.toMatch(/create policy "Authenticated users can view submitted requests"/i)
    })

    it('allows clients to update their own request status during proposal and work flow', () => {
        const policyMatch = sql.match(/create policy "Clients can update own request status"[\s\S]*?;/i)
        const policySql = policyMatch?.[0] || ''

        expect(policySql).toMatch(/on public\.service_requests for update/i)
        expect(policySql).toMatch(/using \(auth\.uid\(\) = client_id\)/i)
        expect(policySql).toMatch(/with check \(auth\.uid\(\) = client_id\)/i)
    })

    it('limits proposal status updates to the client who received the proposal', () => {
        const policyMatch = sql.match(/create policy "Clients can update received proposals"[\s\S]*?;/i)
        const policySql = policyMatch?.[0] || ''

        expect(policySql).toMatch(/on public\.proposals for update/i)
        expect(policySql).toMatch(/using \(auth\.uid\(\) = client_id\)/i)
        expect(policySql).toMatch(/with check \(auth\.uid\(\) = client_id\)/i)
        expect(policySql).not.toMatch(/expert_id/)
    })

    it('allows experts to insert proposals only for submitted requests with matching client', () => {
        const policyMatch = sql.match(/create policy "Experts can insert proposal for submitted request"[\s\S]*?;/i)
        const policySql = policyMatch?.[0] || ''

        expect(policySql).toMatch(/on public\.proposals for insert/i)
        expect(policySql).toMatch(/auth\.uid\(\) = expert_id/i)
        expect(policySql).toMatch(/exists \([\s\S]*select 1 from public\.service_requests/i)
        expect(policySql).toMatch(/service_requests\.id = proposals\.request_id/i)
        expect(policySql).toMatch(/service_requests\.client_id = proposals\.client_id/i)
        expect(policySql).toMatch(/service_requests\.status in \('submitted', 'pending'\)/i)
        expect(policySql).toMatch(/service_requests\.expert_id = proposals\.expert_id/i)
    })

    it('allows works to be inserted only from an accepted matching proposal', () => {
        const policyMatch = sql.match(/create policy "Accepted proposal participants can insert works"[\s\S]*?;/i)
        const policySql = policyMatch?.[0] || ''

        expect(policySql).toMatch(/on public\.works for insert/i)
        expect(policySql).toMatch(/auth\.uid\(\) = client_id/i)
        expect(policySql).toMatch(/exists \([\s\S]*select 1 from public\.proposals/i)
        expect(policySql).toMatch(/proposals\.id = works\.proposal_id/i)
        expect(policySql).toMatch(/proposals\.request_id = works\.request_id/i)
        expect(policySql).toMatch(/proposals\.client_id = works\.client_id/i)
        expect(policySql).toMatch(/proposals\.expert_id = works\.expert_id/i)
        expect(policySql).toMatch(/proposals\.status = 'accepted'/i)
        expect(policySql).toMatch(/proposals\.payment_status = 'paid'/i)
    })

    it('stores MVP payment, platform fee, and settlement status fields', () => {
        expect(sql).toMatch(/payment_status text not null default 'unpaid'/i)
        expect(sql).toMatch(/platform_fee_rate numeric\(5,4\) not null default 0/i)
        expect(sql).toMatch(/paid_at timestamptz/i)
        expect(sql).toMatch(/total_price integer not null default 0/i)
        expect(sql).toMatch(/platform_fee integer not null default 0/i)
        expect(sql).toMatch(/expert_payout integer not null default 0/i)
        expect(sql).toMatch(/settlement_status text not null default 'held'/i)
        expect(sql).toMatch(/revision_limit integer not null default 0/i)
        expect(sql).toMatch(/revision_used integer not null default 0/i)
        expect(sql).toMatch(/refund_status text/i)
        expect(sql).toMatch(/dispute_status text/i)
        expect(sql).toMatch(/cancellation_reason text/i)
        expect(sql).toMatch(/cancelled_at timestamptz/i)
        expect(sql).toMatch(/add column if not exists payment_status/i)
        expect(sql).toMatch(/add column if not exists settlement_status/i)
        expect(sql).toMatch(/add column if not exists dispute_status/i)
    })

    it('stores Toss payment orders without exposing write access to clients', () => {
        expect(sql).toMatch(/create table(?: if not exists)? public\.payment_orders/i)
        expect(sql).toMatch(/order_id text not null unique/i)
        expect(sql).toMatch(/proposal_id uuid not null references public\.proposals\(id\)/i)
        expect(sql).toMatch(/amount integer not null check \(amount > 0\)/i)
        expect(sql).toMatch(/platform_fee_rate numeric\(5,4\) not null default 0/i)
        expect(sql).toMatch(/platform_fee integer not null default 0/i)
        expect(sql).toMatch(/expert_payout integer not null default 0/i)
        expect(sql).toMatch(/status text not null default 'ready' check \(status in \('ready', 'approved', 'failed', 'refunded'\)\)/i)
        expect(sql).toMatch(/payment_key text/i)
        expect(sql).toMatch(/approved_at timestamptz/i)
        expect(sql).toMatch(/cancel_reason text/i)
        expect(sql).toMatch(/cancelled_at timestamptz/i)

        const policyMatch = sql.match(/create policy "Clients can view own payment orders"[\s\S]*?;/i)
        const policySql = policyMatch?.[0] || ''

        expect(policySql).toMatch(/on public\.payment_orders for select/i)
        expect(policySql).toMatch(/using \(auth\.uid\(\) = client_id\)/i)
        expect(sql).not.toMatch(/on public\.payment_orders for insert/i)
        expect(sql).not.toMatch(/on public\.payment_orders for update/i)
    })

    it('stores expert payout accounts and settlement payout queues', () => {
        expect(sql).toMatch(/create table(?: if not exists)? public\.expert_payout_accounts/i)
        expect(sql).toMatch(/expert_id uuid not null unique references public\.profiles\(id\)/i)
        expect(sql).toMatch(/bank_name text not null/i)
        expect(sql).toMatch(/account_number text not null/i)
        expect(sql).toMatch(/create table(?: if not exists)? public\.settlement_payouts/i)
        expect(sql).toMatch(/work_id uuid not null unique references public\.works\(id\)/i)
        expect(sql).toMatch(/payout_account_id uuid references public\.expert_payout_accounts\(id\)/i)
        expect(sql).toMatch(/status text not null default 'queued' check \(status in \('queued', 'processing', 'paid', 'failed'\)\)/i)
        expect(sql).toMatch(/create policy "Experts can view own payout account"/i)
        expect(sql).toMatch(/create policy "Experts can view own settlement payouts"/i)
        expect(sql).toMatch(/create policy "Admins can view payout accounts"/i)
        expect(sql).toMatch(/create policy "Admins can view settlement payouts"/i)
        expect(sql).toMatch(/create policy "Admins can update settlement payouts"/i)
    })

    it('stores user notification preferences and queued notification events', () => {
        expect(sql).toMatch(/create table(?: if not exists)? public\.notification_preferences/i)
        expect(sql).toMatch(/user_id uuid primary key references public\.profiles\(id\)/i)
        expect(sql).toMatch(/phone_number text not null default ''/i)
        expect(sql).toMatch(/kakao_alimtalk_enabled boolean not null default false/i)
        expect(sql).toMatch(/sms_fallback_enabled boolean not null default false/i)
        expect(sql).toMatch(/create table(?: if not exists)? public\.notification_events/i)
        expect(sql).toMatch(/event_type text not null check/i)
        expect(sql).toMatch(/channels text\[\] not null default array\['in_app'\]::text\[\]/i)
        expect(sql).toMatch(/status text not null default 'queued' check \(status in \('queued', 'sent', 'failed', 'skipped'\)\)/i)
        expect(sql).toMatch(/create policy "Users can view own notification preference"/i)
        expect(sql).toMatch(/create policy "Users can update own notification preference"/i)
        expect(sql).toMatch(/create policy "Users can view own notification events"/i)
        expect(sql).toMatch(/create policy "Users can insert own notification events"/i)
        expect(sql).toMatch(/create policy "Work participants can insert notification events"/i)
        expect(sql).toMatch(/auth\.uid\(\) in \(works\.client_id, works\.expert_id\)/i)
        expect(sql).toMatch(/user_id in \(works\.client_id, works\.expert_id\)/i)
    })

    it('stores profile and product trust fields used by launch UI', () => {
        expect(sql).toMatch(/contact_available_time text/i)
        expect(sql).toMatch(/average_response_time text/i)
        expect(sql).toMatch(/tax_invoice_available boolean not null default false/i)
        expect(sql).toMatch(/account_status text not null default 'active'/i)
        expect(sql).toMatch(/is_featured boolean not null default false/i)
        expect(sql).toMatch(/display_order integer not null default 0/i)
    })

    it('migrates product placement fields used when saving products', () => {
        expect(launchVerificationMigrationSql).toMatch(/add column if not exists tax_invoice_available boolean not null default false/i)
        expect(launchVerificationMigrationSql).toMatch(/add column if not exists is_featured boolean not null default false/i)
        expect(launchVerificationMigrationSql).toMatch(/add column if not exists display_order integer not null default 0/i)
    })

    it('blocks restricted experts from saving products', () => {
        const insertPolicyMatch = sql.match(/create policy "Experts can insert own products"[\s\S]*?;\s*\n/i)
        const updatePolicyMatch = sql.match(/create policy "Experts can update own products"[\s\S]*?;\s*\n/i)
        const insertPolicySql = insertPolicyMatch?.[0] || ''
        const updatePolicySql = updatePolicyMatch?.[0] || ''

        expect(insertPolicySql).toMatch(/profiles\.account_status = 'active'/i)
        expect(updatePolicySql).toMatch(/profiles\.account_status = 'active'/i)
    })

    it('allows clients to review only completed work with the matching expert', () => {
        const policyMatch = sql.match(/create policy "Clients can review completed work"[\s\S]*?;/i)
        const policySql = policyMatch?.[0] || ''

        expect(policySql).toMatch(/on public\.reviews for insert/i)
        expect(policySql).toMatch(/auth\.uid\(\) = client_id/i)
        expect(policySql).toMatch(/exists \([\s\S]*select 1 from public\.works/i)
        expect(policySql).toMatch(/works\.id = reviews\.work_id/i)
        expect(policySql).toMatch(/works\.client_id = auth\.uid\(\)/i)
        expect(policySql).toMatch(/works\.expert_id = reviews\.expert_id/i)
        expect(policySql).toMatch(/works\.status = 'completed'/i)
    })

    it('allows only admins to update review moderation status', () => {
        expect(sql).toMatch(/status text not null default 'published' check \(status in \('published', 'hidden'\)\)/i)
        const policyMatch = sql.match(/create policy "Admins can update reviews"[\s\S]*?;/i)
        const policySql = policyMatch?.[0] || ''

        expect(policySql).toMatch(/on public\.reviews for update/i)
        expect(policySql).toMatch(/is_admin\(auth\.uid\(\)\)/i)
    })

    it('does not contain trailing commas before statement terminators', () => {
        expect(sql).not.toMatch(/,\s*;/)
    })

    it('limits deliverable file storage reads to work participants', () => {
        const policyMatch = sql.match(
            /create policy "Work participants can read deliverable files"[\s\S]*?on storage\.objects for select[\s\S]*?using \(([\s\S]*?)\);/i,
        )

        expect(policyMatch?.[1]).toContain("bucket_id = 'deliverable-files'")
        expect(policyMatch?.[1]).toMatch(/exists \([\s\S]*select 1 from public\.works/i)
        expect(policyMatch?.[1]).toMatch(/works\.id::text = \(storage\.foldername\(name\)\)\[1\]/i)
        expect(policyMatch?.[1]).toMatch(/works\.client_id = auth\.uid\(\) or works\.expert_id = auth\.uid\(\)/i)
    })

    it('allows work participants to insert initial work steps after proposal acceptance', () => {
        const policyMatch = sql.match(
            /create policy "Work participants can insert work steps"[\s\S]*?on public\.work_steps for insert[\s\S]*?with check \(([\s\S]*?)\);/i,
        )

        expect(policyMatch?.[1]).toMatch(/exists \([\s\S]*select 1 from public\.works/i)
        expect(policyMatch?.[1]).toMatch(/works\.id = work_steps\.work_id/i)
        expect(policyMatch?.[1]).toMatch(/works\.client_id = auth\.uid\(\) or works\.expert_id = auth\.uid\(\)/i)
    })

    it('limits deliverable inserts to the expert assigned to the work', () => {
        const policyMatch = sql.match(
            /create policy "Experts can insert deliverables"[\s\S]*?on public\.deliverables for insert[\s\S]*?with check \(([\s\S]*?)\);/i,
        )

        expect(policyMatch?.[1]).toMatch(/exists \([\s\S]*select 1 from public\.works/i)
        expect(policyMatch?.[1]).toMatch(/works\.id = deliverables\.work_id/i)
        expect(policyMatch?.[1]).toMatch(/works\.expert_id = auth\.uid\(\)/i)
        expect(policyMatch?.[1]).toMatch(/deliverables\.expert_id = auth\.uid\(\)/i)
    })
})
