import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/pages/ExpertDetail.css', 'utf8')
const globalCss = readFileSync('src/index.css', 'utf8')

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
        const contentRule = getRule('.seller-review-content')
        const metaRule = getRule('.seller-review-meta')

        expect(listRule).toContain('gap: var(--space-5)')
        expect(cardRule).toContain('grid-template-columns: 3rem minmax(0, 1fr)')
        expect(cardRule).toContain('column-gap: var(--space-4)')
        expect(cardRule).toContain('row-gap: var(--space-4)')
        expect(cardRule).toContain('padding: var(--space-6)')
        expect(cardRule).toContain('min-height: 9rem')
        expect(cardRule).toContain('border: 1px solid var(--border-color)')
        expect(cardRule).toContain('border-radius: var(--radius-xl)')
        expect(contentRule).toContain('gap: var(--space-3)')
        expect(metaRule).toContain('gap: var(--space-3)')
    })

    it('defines the spacing tokens used by seller review cards', () => {
        expect(globalCss).toContain('--space-2: 8px')
        expect(globalCss).toContain('--space-3: 12px')
        expect(globalCss).toContain('--space-4: 16px')
        expect(globalCss).toContain('--space-5: 20px')
        expect(globalCss).toContain('--space-6: 24px')
    })
})
