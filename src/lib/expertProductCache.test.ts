import { afterEach, expect, it } from 'vitest'
import { readCachedExpertProducts } from './expertProductCache'

const cacheKey = 'ai_supabase_expert_products_cache'

afterEach(() => {
    localStorage.removeItem(cacheKey)
})

it('clears cached product data that embeds a media file', () => {
    localStorage.setItem(cacheKey, JSON.stringify([
        { sampleImageUrl: 'data:image/png;base64,large-thumbnail' },
    ]))

    expect(readCachedExpertProducts()).toEqual([])
    expect(localStorage.getItem(cacheKey)).toBeNull()
})
