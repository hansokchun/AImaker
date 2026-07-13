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
            'operation_logs',
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
        expect(sql).toMatch(/create table(?: if not exists)? public\.operation_logs/i)
        expect(sql).toMatch(/alter table public\.admin_users enable row level security/i)
        expect(sql).toMatch(/alter table public\.admin_reports enable row level security/i)
        expect(sql).toMatch(/alter table public\.admin_actions enable row level security/i)
        expect(sql).toMatch(/alter table public\.operation_logs enable row level security/i)
        expect(sql).toMatch(/create policy "Admins can view reports"/i)
        expect(sql).toMatch(/create policy "Authenticated users can create reports"/i)
        expect(sql).toMatch(/reporter_id = auth\.uid\(\)/i)
        expect(sql).toMatch(/create policy "Admins can update reports"/i)
        expect(sql).toMatch(/create policy "Admins can view consultation messages"/i)
        expect(sql).toMatch(/create policy "Admins can view work messages"/i)
        expect(sql).toMatch(/create policy "Admins can update consultations"/i)
        expect(sql).not.toMatch(/create policy "Admins can update works"/i)
        expect(sql).toMatch(/create policy "Admins can update profiles"/i)
        expect(sql).toMatch(/create policy "Admins can insert admin actions"/i)
        expect(sql).toMatch(/create policy "Admins can view operation logs"/i)
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

    it('blocks direct profile deletes so withdrawal preserves transaction records', () => {
        expect(sql).toMatch(/drop policy if exists "Users can delete own profile" on public\.profiles;/i)
        expect(sql).not.toMatch(/create policy "Users can delete own profile"[\s\S]*?on public\.profiles for delete/i)
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

    it('does not let browser-authenticated users update proposals directly', () => {
        expect(sql).toMatch(/drop policy if exists "Clients can update unpaid proposal decisions" on public.proposals/i)
        expect(sql).toMatch(/drop policy if exists "Experts can update own unpaid proposals" on public.proposals/i)
        expect(sql).not.toMatch(/create policy "Clients can update unpaid proposal decisions"/i)
        expect(sql).not.toMatch(/create policy "Experts can update own unpaid proposals"/i)
    })

    it('prevents authenticated proposal updates from changing payment and money fields', () => {
        expect(sql).toMatch(/create or replace function public\.guard_proposal_authenticated_update\(\)/i)
        expect(sql).toMatch(/drop trigger if exists guard_proposal_authenticated_update on public\.proposals/i)
        expect(sql).toMatch(/new\.total_price is distinct from old\.total_price/i)
        expect(sql).toMatch(/new\.payment_status is distinct from old\.payment_status/i)
        expect(sql).toMatch(/new\.platform_fee_rate is distinct from old\.platform_fee_rate/i)
        expect(sql).toMatch(/new\.paid_at is distinct from old\.paid_at/i)
        expect(sql).toMatch(/new\.refunded_at is distinct from old\.refunded_at/i)
    })

    it('prevents participants from changing server-managed work money and dispute fields', () => {
        const guardMatch = sql.match(/create or replace function public\.guard_work_authenticated_update\(\)[\s\S]*?end;\s*\$\$;/i)
        const guardSql = guardMatch?.[0] || ''

        expect(guardSql).toMatch(/public\.is_admin\(auth\.uid\(\)\)/i)
        expect(guardSql).toMatch(/new\.total_price is distinct from old\.total_price/i)
        expect(guardSql).toMatch(/new\.platform_fee is distinct from old\.platform_fee/i)
        expect(guardSql).toMatch(/new\.expert_payout is distinct from old\.expert_payout/i)
        expect(guardSql).toMatch(/new\.refund_status is distinct from old\.refund_status/i)
        expect(guardSql).toMatch(/new\.dispute_status is distinct from old\.dispute_status/i)
        expect(guardSql).toMatch(/new\.settlement_settled_at is distinct from old\.settlement_settled_at/i)
        expect(guardSql).toMatch(/new\.settlement_hold_reason is distinct from old\.settlement_hold_reason/i)
        expect(guardSql).toMatch(/new\.revision_limit is distinct from old\.revision_limit/i)
    })

    it('preserves legitimate participant work state transitions under the work guard', () => {
        const guardMatch = sql.match(/create or replace function public\.guard_work_authenticated_update\(\)[\s\S]*?end;\s*\$\$;/i)
        const guardSql = guardMatch?.[0] || ''

        expect(guardSql).toMatch(/new\.status = 'submitted'/i)
        expect(guardSql).toMatch(/new\.status = 'completed'/i)
        expect(guardSql).toMatch(/new\.settlement_status = 'pending'/i)
        expect(guardSql).toMatch(/new\.status = 'revision_requested'/i)
        expect(guardSql).toMatch(/new\.revision_used = old\.revision_used \+ 1/i)
        expect(guardSql).toMatch(/new\.cancellation_requested_by = auth\.uid\(\)/i)
        expect(guardSql).toMatch(/old\.cancellation_requested_by <> auth\.uid\(\)/i)
        expect(guardSql).toMatch(/new\.status = 'cancelled'/i)
        expect(guardSql).toMatch(/new\.settlement_requested_at is not null/i)
    })

    it('does not let browser-authenticated users insert proposals directly', () => {
        expect(sql).toMatch(/drop policy if exists "Experts can insert proposal for own request" on public.proposals/i)
        expect(sql).toMatch(/drop policy if exists "Experts can insert proposal for submitted request" on public.proposals/i)
        expect(sql).not.toMatch(/create policy "Experts can insert proposal for submitted request"/i)
    })

    it('does not let browser-authenticated users insert paid work rows', () => {
        expect(sql).toMatch(/drop policy if exists "Accepted proposal participants can insert works" on public\.works;/i)
        expect(sql).not.toMatch(/create policy "Accepted proposal participants can insert works"/i)
        expect(sql).not.toMatch(/on public\.works for insert/i)
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
        expect(sql).toMatch(/create unique index if not exists payment_orders_one_active_per_proposal/i)
        expect(sql).toMatch(/where status in \('ready', 'approved'\)/i)
        expect(sql).toMatch(/create unique index if not exists payment_orders_payment_key_unique/i)

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
        expect(sql).not.toMatch(/create policy "Admins can update settlement payouts"/i)
        expect(sql).not.toMatch(/create policy "Experts can insert settlement payouts"/i)
        expect(sql).not.toMatch(/create policy "Experts can retry own settlement payouts"/i)
    })

    it('registers a safe scheduler helper for trade automation cron activation', () => {
        expect(sql).toMatch(/create extension if not exists pg_net with schema extensions/i)
        expect(sql).toMatch(/create extension if not exists pg_cron with schema extensions/i)
        expect(sql).toMatch(/create or replace function public\.schedule_trade_automation_cron/i)
        expect(sql).toMatch(/only admins can schedule trade automation/i)
        expect(sql).toMatch(/cron\.schedule\(/i)
        expect(sql).toMatch(/net\.http_post/i)
        expect(sql).toMatch(/x-automation-secret/i)
        expect(sql).toMatch(/current_role in \('anon', 'authenticated'\)/i)
        expect(sql).toMatch(/revoke all on function public\.schedule_trade_automation_cron\(text, text, text\) from public;/i)
        expect(sql).toMatch(/revoke all on function public\.schedule_trade_automation_cron\(text, text, text\) from anon;/i)
        expect(sql).toMatch(/revoke all on function public\.schedule_trade_automation_cron\(text, text, text\) from authenticated;/i)
        expect(sql).toMatch(/grant execute on function public\.schedule_trade_automation_cron\(text, text, text\) to service_role;/i)
    })

    it('stores user notification preferences and queued notification events', () => {
        expect(sql).toMatch(/create table(?: if not exists)? public\.notification_preferences/i)
        expect(sql).toMatch(/user_id uuid primary key references public\.profiles\(id\)/i)
        expect(sql).toMatch(/phone_number text not null default ''/i)
        expect(sql).toMatch(/kakao_alimtalk_enabled boolean not null default false/i)
        expect(sql).toMatch(/sms_fallback_enabled boolean not null default false/i)
        expect(sql).toMatch(/create table(?: if not exists)? public\.notification_events/i)
        expect(sql).toMatch(/notification_events_dispatch_idx/i)
        expect(sql).toMatch(/event_type text not null check/i)
        expect(sql).toMatch(/channels text\[\] not null default array\['in_app'\]::text\[\]/i)
        expect(sql).toMatch(/status text not null default 'queued' check \(status in \('queued', 'sent', 'failed', 'skipped'\)\)/i)
        expect(sql).toMatch(/create policy "Users can view own notification preference"/i)
        expect(sql).toMatch(/create policy "Users can update own notification preference"/i)
        expect(sql).toMatch(/create policy "Users can view own notification events"/i)
        expect(sql).not.toMatch(/create policy "Users can insert own notification events"/i)
        expect(sql).not.toMatch(/create policy "Work participants can insert notification events"/i)
        expect(sql).toMatch(/drop policy if exists "Users can insert own notification events"/i)
        expect(sql).toMatch(/drop policy if exists "Work participants can insert notification events"/i)
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

    it('does not let browser-authenticated users insert or update work steps directly', () => {
        expect(sql).toMatch(/drop policy if exists "Work participants can insert work steps" on public.work_steps;/i)
        expect(sql).toMatch(/drop policy if exists "Experts can submit own work steps" on public.work_steps;/i)
        expect(sql).toMatch(/drop policy if exists "Clients can review work steps" on public.work_steps;/i)
        expect(sql).not.toMatch(/create policy "Work participants can insert work steps"/i)
        expect(sql).not.toMatch(/create policy "Experts can submit own work steps"/i)
        expect(sql).not.toMatch(/create policy "Clients can review work steps"/i)
    })

    it('keeps the work step mutation guard available for service-role and admin writes', () => {
        const guardMatch = sql.match(/create or replace function public\.guard_work_step_authenticated_update\(\)[\s\S]*?end;\s*\$\$;/i)
        const guardSql = guardMatch?.[0] || ''

        expect(guardSql).toMatch(/new\.work_id is distinct from old\.work_id/i)
        expect(guardSql).toMatch(/new\.step_order is distinct from old\.step_order/i)
        expect(guardSql).toMatch(/new\.title is distinct from old\.title/i)
        expect(guardSql).toMatch(/new\.description is distinct from old\.description/i)
        expect(guardSql).toMatch(/new\.submitted_at is distinct from old\.submitted_at/i)
    })

    it('does not let browser-authenticated users insert or update deliverables directly', () => {
        expect(sql).toMatch(/drop policy if exists "Experts can insert deliverables" on public.deliverables;/i)
        expect(sql).toMatch(/drop policy if exists "Clients can review deliverables" on public.deliverables;/i)
        expect(sql).not.toMatch(/create policy "Experts can insert deliverables"/i)
        expect(sql).not.toMatch(/create policy "Clients can review deliverables"/i)
    })

    it('keeps the deliverable mutation guard available for service-role and admin writes', () => {
        const guardMatch = sql.match(/create or replace function public\.guard_deliverable_authenticated_update\(\)[\s\S]*?end;\s*\$\$;/i)
        const guardSql = guardMatch?.[0] || ''

        expect(guardSql).toMatch(/new\.work_id is distinct from old\.work_id/i)
        expect(guardSql).toMatch(/new\.step_id is distinct from old\.step_id/i)
        expect(guardSql).toMatch(/new\.expert_id is distinct from old\.expert_id/i)
        expect(guardSql).toMatch(/new\.description is distinct from old\.description/i)
        expect(guardSql).toMatch(/new\.external_url is distinct from old\.external_url/i)
        expect(guardSql).toMatch(/new\.file_url is distinct from old\.file_url/i)
    })
})
