import type { AiCategoryId, ExpertProduct, ProductPackage } from '../types'
import { getExpertProducts } from './storage'
import { supabase } from './supabase'

const marketplaceProductRpc = 'get_marketplace_product_summaries'

type MarketplaceProductRow = {
    readonly id: string
    readonly expert_id: string
    readonly expert_name: string
    readonly expert_image_url: string
    readonly title: string
    readonly category: AiCategoryId
    readonly summary: string
    readonly sample_image_url: string
    readonly starting_price: number
    readonly delivery_days: number
    readonly revision_count: number
    readonly created_at: string
    readonly tax_invoice_available: boolean
    readonly is_featured: boolean
    readonly display_order: number
    readonly status: 'published'
}

const categories: readonly AiCategoryId[] = [
    'ai-video-shortform',
    'ai-image-character',
    'ai-development-automation',
]

const isCategory = (value: unknown): value is AiCategoryId =>
    typeof value === 'string' && categories.some((category) => category === value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

const isMarketplaceProductRow = (value: unknown): value is MarketplaceProductRow => {
    if (!isRecord(value)) return false

    return typeof value.id === 'string'
        && typeof value.expert_id === 'string'
        && typeof value.expert_name === 'string'
        && typeof value.expert_image_url === 'string'
        && typeof value.title === 'string'
        && isCategory(value.category)
        && typeof value.summary === 'string'
        && typeof value.sample_image_url === 'string'
        && typeof value.starting_price === 'number'
        && typeof value.delivery_days === 'number'
        && typeof value.revision_count === 'number'
        && typeof value.created_at === 'string'
        && typeof value.tax_invoice_available === 'boolean'
        && typeof value.is_featured === 'boolean'
        && typeof value.display_order === 'number'
        && value.status === 'published'
}

const summaryPackage = (row: MarketplaceProductRow): ProductPackage => ({
    name: 'Standard',
    price: row.starting_price,
    deliveryDays: row.delivery_days,
    revisionCount: row.revision_count,
    included: [],
})

const toMarketplaceProduct = (row: MarketplaceProductRow): ExpertProduct => ({
    id: row.id,
    expertId: row.expert_id,
    expertName: row.expert_name,
    expertImageUrl: row.expert_image_url,
    title: row.title,
    category: row.category,
    summary: row.summary,
    description: '',
    sampleLinks: [],
    sampleImageUrl: row.sample_image_url,
    startingPrice: row.starting_price,
    deliveryDays: row.delivery_days,
    revisionCount: row.revision_count,
    createdAt: row.created_at,
    taxInvoiceAvailable: row.tax_invoice_available,
    isFeatured: row.is_featured,
    displayOrder: row.display_order,
    packages: {
        standard: summaryPackage(row),
        deluxe: null,
        premium: null,
    },
    status: 'published',
})

export const getMarketplaceProductSummaries = async (): Promise<ExpertProduct[]> => {
    if (!supabase) return getExpertProducts()

    const { data, error } = await supabase.rpc(marketplaceProductRpc)
    if (error || !Array.isArray(data)) {
        console.error('상품 목록 요약 로딩 실패:', error)
        return getExpertProducts()
    }

    return data
        .filter(isMarketplaceProductRow)
        .map(toMarketplaceProduct)
}
