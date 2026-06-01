import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(process.cwd(), 'database.sql'), 'utf8')

describe('database.sql', () => {
    it('defines the transaction tables from SupabasePlan', () => {
        const tables = [
            'profiles',
            'expert_products',
            'consultations',
            'consultation_messages',
            'service_requests',
            'proposals',
            'works',
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

    it('drops policies and triggers before recreating them for safe reruns', () => {
        expect(sql).toMatch(/drop policy if exists "Users can view own profile" on public\.profiles;/i)
        expect(sql).toMatch(/drop trigger if exists set_work_steps_updated_at on public\.work_steps;/i)
        expect(sql).toMatch(/drop policy if exists "Public can read product samples" on storage\.objects;/i)
    })

    it('keeps profile email private by limiting profiles select to the owner', () => {
        expect(sql).not.toMatch(/create policy "Public profiles are viewable by everyone"[\s\S]*?using \(true\);/i)
        expect(sql).toMatch(/create policy "Users can view own profile"[\s\S]*?on public\.profiles for select[\s\S]*?using \(auth\.uid\(\) = id\);/i)
    })

    it('allows authenticated experts to read submitted service requests for the request board', () => {
        const policyMatch = sql.match(
            /create policy "Authenticated users can view submitted requests"[\s\S]*?on public\.service_requests for select[\s\S]*?using \(([\s\S]*?)\);/i,
        )

        expect(policyMatch?.[1]).toContain("auth.role() = 'authenticated'")
        expect(policyMatch?.[1]).toMatch(/status in \('submitted', 'pending'\)/i)
        expect(policyMatch?.[1]).toMatch(/product_id is null/i)
        expect(policyMatch?.[1]).toMatch(/expert_id is null/i)
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
        expect(policySql).toMatch(/service_requests\.expert_id is null/i)
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
        expect(sql).toMatch(/platform_fee_rate numeric\(5,4\) not null default 0\.12/i)
        expect(sql).toMatch(/paid_at timestamptz/i)
        expect(sql).toMatch(/total_price integer not null default 0/i)
        expect(sql).toMatch(/platform_fee integer not null default 0/i)
        expect(sql).toMatch(/expert_payout integer not null default 0/i)
        expect(sql).toMatch(/settlement_status text not null default 'held'/i)
        expect(sql).toMatch(/add column if not exists payment_status/i)
        expect(sql).toMatch(/add column if not exists settlement_status/i)
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

    it('does not allow review updates in the initial launch policy', () => {
        expect(sql).not.toMatch(/on public\.reviews for update/i)
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
