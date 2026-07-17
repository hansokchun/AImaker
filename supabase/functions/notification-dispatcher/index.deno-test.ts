import { postProviderWebhook } from './index.ts'

Deno.test('Given a provider network failure, when a webhook is posted, then it returns false', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (): Promise<Response> => {
        throw new TypeError('Network unavailable')
    }

    try {
        const delivered = await postProviderWebhook('https://provider.invalid', {})
        if (delivered) throw new Error('Expected provider network failure to return false')
    } finally {
        globalThis.fetch = originalFetch
    }
})
