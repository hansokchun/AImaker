import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/pages/ExpertDetail.css', 'utf8')

const getRule = (selector: string) => {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`))
    return match?.[1] || ''
}

describe('ExpertDetail gallery styles', () => {
    it('keeps the gallery stage size fixed while media changes', () => {
        const stageRule = getRule('.product-gallery-stage')
        const imageRule = getRule('.product-gallery-image')

        expect(stageRule).toContain('aspect-ratio: 16 / 9')
        expect(stageRule).toContain('min-height: 0')
        expect(imageRule).toContain('max-width: 100%')
        expect(imageRule).toContain('max-height: 100%')
    })

    it('wraps seller reviews in roomy bordered cards', () => {
        const listRule = getRule('.seller-review-list')
        const cardRule = getRule('.seller-review-card')
        const metaRule = getRule('.seller-review-meta')

        expect(listRule).toContain('gap: var(--space-4)')
        expect(cardRule).toContain('gap: var(--space-4)')
        expect(cardRule).toContain('padding: var(--space-5)')
        expect(cardRule).toContain('border: 1px solid var(--border-color)')
        expect(cardRule).toContain('border-radius: var(--radius-xl)')
        expect(metaRule).toContain('gap: var(--space-3)')
    })
})
