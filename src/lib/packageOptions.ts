import type { ExpertProduct, PackageTier, ProductPackage } from '../types'

const packageTiers: PackageTier[] = ['standard', 'deluxe', 'premium']

export type PackageOptionRow = {
    label: string
    values: Record<PackageTier, string>
    available: Record<PackageTier, boolean>
}

const quantitySuffixPattern = /^(.*?)(?:\s*)(\d+(?:\.\d+)?\s*(?:안|개|회|종|편|장|건|일|시간|분|초|명|단계|페이지|컷|세트))$/
const explicitValuePattern = /^(.*?)\s*[:：]\s*(.+)$/

export const parsePackageOptionFeature = (feature: string) => {
    const normalized = feature.trim().replace(/\s+/g, ' ')
    if (!normalized) return null

    const explicitValueMatch = normalized.match(explicitValuePattern)
    if (explicitValueMatch?.[1] && explicitValueMatch[2]) {
        return {
            label: explicitValueMatch[1].trim(),
            value: explicitValueMatch[2].trim(),
        }
    }

    const quantityMatch = normalized.match(quantitySuffixPattern)
    if (quantityMatch?.[1] && quantityMatch[2]) {
        return {
            label: quantityMatch[1].trim(),
            value: quantityMatch[2].replace(/\s+/g, ''),
        }
    }

    return {
        label: normalized,
        value: '포함',
    }
}

export const buildOptionValuesFromIncluded = (included: string[] = []) =>
    included.reduce<Record<string, string>>((options, feature) => {
        const parsed = parsePackageOptionFeature(feature)
        if (!parsed) return options
        options[parsed.label] = parsed.value
        return options
    }, {})

export const getPackageOptionRows = (packages: ExpertProduct['packages']): PackageOptionRow[] => {
    const rows = new Map<string, PackageOptionRow>()

    packageTiers.forEach((tier) => {
        const packageInfo = packages?.[tier]
        if (!packageInfo) return

        const values = {
            ...buildOptionValuesFromIncluded(packageInfo.included),
            ...(packageInfo.optionValues || {}),
        }

        Object.entries(values).forEach(([rawLabel, rawValue]) => {
            const label = rawLabel.trim()
            const value = String(rawValue || '포함').trim() || '포함'
            if (!label) return

            if (!rows.has(label)) {
                rows.set(label, {
                    label,
                    values: {
                        standard: '미포함',
                        deluxe: '미포함',
                        premium: '미포함',
                    },
                    available: {
                        standard: false,
                        deluxe: false,
                        premium: false,
                    },
                })
            }

            const row = rows.get(label)
            if (!row) return
            row.values[tier] = value
            row.available[tier] = true
        })
    })

    return Array.from(rows.values())
}

export const attachOptionValuesToPackage = (productPackage: ProductPackage): ProductPackage => ({
    ...productPackage,
    optionValues: buildOptionValuesFromIncluded(productPackage.included),
})
