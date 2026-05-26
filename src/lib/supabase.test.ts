import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.fn(() => ({ from: vi.fn() }))

vi.mock('@supabase/supabase-js', () => ({
    createClient,
}))

describe('supabase client setup', () => {
    beforeEach(() => {
        vi.resetModules()
        createClient.mockClear()
        vi.unstubAllEnvs()
    })

    it('trims Cloudflare environment values before creating the client', async () => {
        vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co\n')
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_test\n')

        await import('./supabase')

        expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'sb_publishable_test')
    })
})
