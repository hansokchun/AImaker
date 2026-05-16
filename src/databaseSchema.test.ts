import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(process.cwd(), 'database.sql'), 'utf8')

describe('database.sql', () => {
    it('defines the transaction tables from SupabasePlan', () => {
        const tables = [
            'profiles',
            'expert_products',
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
})
