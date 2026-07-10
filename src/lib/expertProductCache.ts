import type { ExpertProduct, ProductPackage } from '../types'

const CACHE_KEY = 'ai_supabase_expert_products_cache'

type ProductPackageRecord = ExpertProduct['packages']

const packageNames = ['Standard', 'Deluxe', 'Premium'] as const

const isObjectRecord = (value: unknown): value is { readonly [key: string]: unknown } =>
    typeof value === 'object' && value !== null

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'string')

const isCategory = (value: unknown): value is ExpertProduct['category'] =>
    value === 'ai-video-shortform'
    || value === 'ai-image-character'
    || value === 'ai-development-automation'

const isPackageName = (value: unknown): value is ProductPackage['name'] =>
    packageNames.some((name) => name === value)

const isStatus = (value: unknown): value is ExpertProduct['status'] =>
    value === 'draft' || value === 'published' || value === 'hidden'

const parsePackage = (value: unknown): ProductPackage | null => {
    if (value === null) return null
    if (!isObjectRecord(value)) return null
    if (!isPackageName(value.name)) return null
    if (typeof value.price !== 'number') return null
    if (typeof value.deliveryDays !== 'number') return null
    if (typeof value.revisionCount !== 'number') return null
    if (!isStringArray(value.included)) return null

    return {
        name: value.name,
        price: value.price,
        deliveryDays: value.deliveryDays,
        revisionCount: value.revisionCount,
        included: value.included,
        optionValues: isObjectRecord(value.optionValues)
            ? Object.fromEntries(
                Object.entries(value.optionValues).filter((entry): entry is [string, string] =>
                    typeof entry[1] === 'string',
                ),
            )
            : undefined,
    }
}

const parsePackages = (value: unknown): ProductPackageRecord | null => {
    if (!isObjectRecord(value)) return null
    const standard = parsePackage(value.standard)
    if (!standard) return null

    return {
        standard,
        deluxe: parsePackage(value.deluxe),
        premium: parsePackage(value.premium),
    }
}

const parseProduct = (value: unknown): ExpertProduct | null => {
    if (!isObjectRecord(value)) return null
    if (typeof value.id !== 'string') return null
    if (typeof value.expertId !== 'string') return null
    if (typeof value.expertName !== 'string') return null
    if (typeof value.title !== 'string') return null
    if (!isCategory(value.category)) return null
    if (typeof value.summary !== 'string') return null
    if (typeof value.description !== 'string') return null
    if (!isStringArray(value.sampleLinks)) return null
    if (typeof value.sampleImageUrl !== 'string') return null
    if (typeof value.startingPrice !== 'number') return null
    if (typeof value.deliveryDays !== 'number') return null
    if (typeof value.revisionCount !== 'number') return null
    if (!isStatus(value.status)) return null

    const packages = parsePackages(value.packages)
    if (!packages) return null

    return {
        id: value.id,
        expertId: value.expertId,
        expertName: value.expertName,
        expertImageUrl: typeof value.expertImageUrl === 'string' ? value.expertImageUrl : undefined,
        title: value.title,
        category: value.category,
        summary: value.summary,
        description: value.description,
        sampleLinks: value.sampleLinks,
        sampleImageUrl: value.sampleImageUrl,
        startingPrice: value.startingPrice,
        deliveryDays: value.deliveryDays,
        revisionCount: value.revisionCount,
        createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
        taxInvoiceAvailable: typeof value.taxInvoiceAvailable === 'boolean' ? value.taxInvoiceAvailable : undefined,
        isFeatured: typeof value.isFeatured === 'boolean' ? value.isFeatured : undefined,
        displayOrder: typeof value.displayOrder === 'number' ? value.displayOrder : undefined,
        packages,
        status: value.status,
    }
}

export const readCachedExpertProducts = (): ExpertProduct[] => {
    try {
        const raw = localStorage.getItem(CACHE_KEY)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed
            .map(parseProduct)
            .filter((product): product is ExpertProduct => Boolean(product))
            .filter((product) => product.status === 'published')
    } catch (error) {
        if (error instanceof Error) console.warn('상품 캐시를 읽을 수 없습니다:', error.message)
        return []
    }
}

export const writeCachedExpertProducts = (products: readonly ExpertProduct[]): void => {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(products.filter((product) => product.status === 'published')))
    } catch (error) {
        if (error instanceof Error) console.warn('상품 캐시를 저장할 수 없습니다:', error.message)
    }
}
