import { describe, expect, it, vi } from 'vitest'
import type { ExpertProduct } from '../types'

const product: ExpertProduct = {
    id: 'product-test-01',
    expertId: 'expert-test-01',
    expertName: '테스트 전문가',
    title: 'AI 테스트 상품',
    category: 'ai-video-shortform',
    summary: '테스트 요약',
    description: '테스트 설명',
    aiTools: ['ChatGPT', 'Runway'],
    sampleLinks: ['https://example.com/sample'],
    sampleImageUrl: 'https://example.com/sample.jpg',
    startingPrice: 30000,
    deliveryDays: 2,
    revisionCount: 1,
    packages: {
        standard: {
            name: 'Standard',
            price: 30000,
            deliveryDays: 2,
            revisionCount: 1,
            included: ['1차 시안'],
        },
        deluxe: null,
        premium: null,
    },
    status: 'published',
}

describe('expert product storage', () => {
    it('saves expert products to Supabase using expert_products columns', async () => {
        vi.resetModules()
        const upsert = vi.fn().mockResolvedValue({ error: null })
        const from = vi.fn(() => ({ upsert }))

        vi.doMock('./supabase', () => ({
            supabase: { from },
        }))

        const { saveExpertProduct } = await import('./storage')

        await saveExpertProduct(product)

        expect(from).toHaveBeenCalledWith('expert_products')
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                id: product.id,
                expert_id: product.expertId,
                title: product.title,
                category: product.category,
                ai_tools: product.aiTools,
                sample_links: product.sampleLinks,
                sample_file_urls: [product.sampleImageUrl],
                starting_price: product.startingPrice,
                delivery_days: product.deliveryDays,
                packages: product.packages,
                status: 'published',
            }),
        )
    })

    it('loads published expert products from Supabase', async () => {
        vi.resetModules()
        const order = vi.fn().mockResolvedValue({
            data: [
                {
                id: product.id,
                expert_id: product.expertId,
                title: product.title,
                    category: product.category,
                    summary: product.summary,
                    description: product.description,
                    ai_tools: product.aiTools,
                    sample_links: product.sampleLinks,
                    sample_file_urls: product.sampleImageUrl ? [product.sampleImageUrl] : [],
                    starting_price: product.startingPrice,
                    delivery_days: product.deliveryDays,
                    revision_count: product.revisionCount,
                    packages: product.packages,
                    status: product.status,
                },
            ],
            error: null,
        })
        const eq = vi.fn(() => ({ order }))
        const select = vi.fn(() => ({ eq }))
        const from = vi.fn(() => ({ select }))

        vi.doMock('./supabase', () => ({
            supabase: { from },
        }))

        const { getExpertProducts } = await import('./storage')

        await expect(getExpertProducts()).resolves.toEqual([{ ...product, expertName: 'AI 전문가' }])
        expect(from).toHaveBeenCalledWith('expert_products')
        expect(select).toHaveBeenCalledWith('*')
        expect(eq).toHaveBeenCalledWith('status', 'published')
    })
})
