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
})
