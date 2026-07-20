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
    it('scopes the ilpick palette to the product detail preview', () => {
        const previewRule = getRule('.ilpick-product-detail')

        expect(previewRule).toContain('--primary: #1479ff')
        expect(previewRule).toContain('--ilpick-navy: #071a3d')
        expect(previewRule).toContain('--ilpick-blue-soft: #e5f0ff')
    })

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
        const headerRule = getRule('.seller-review-header')
        const dividerRule = getRule('.seller-review-divider')
        const bodyRule = getRule('.seller-review-body')
        const metaRule = getRule('.seller-review-meta')

        expect(listRule).toContain('gap: var(--space-5)')
        expect(cardRule).toContain('gap: var(--space-5)')
        expect(cardRule).toContain('padding: var(--space-6)')
        expect(cardRule).toContain('border: 1px solid var(--border-color)')
        expect(cardRule).toContain('border-radius: var(--radius-xl)')
        expect(headerRule).toContain('display: flex')
        expect(headerRule).toContain('gap: var(--space-4)')
        expect(dividerRule).toContain('height: 1px')
        expect(dividerRule).toContain('background: var(--border-color)')
        expect(bodyRule).toContain('font-size: 1rem')
        expect(bodyRule).toContain('color: var(--text-primary)')
        expect(metaRule).toContain('display: grid')
        expect(metaRule).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
        expect(metaRule).toContain('column-gap: var(--space-8)')
    })

    it('defines the spacing tokens used by seller review cards', () => {
        expect(globalCss).toContain('--space-2: 8px')
        expect(globalCss).toContain('--space-3: 12px')
        expect(globalCss).toContain('--space-4: 16px')
        expect(globalCss).toContain('--space-5: 20px')
        expect(globalCss).toContain('--space-6: 24px')
    })
})
