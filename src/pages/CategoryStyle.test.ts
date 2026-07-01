import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const categoryCss = readFileSync('src/pages/Category.css', 'utf8')
const browsePanelCss = readFileSync('src/pages/CategoryBrowsePanel.css', 'utf8')

const getRule = (css: string, selector: string) => {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`))
    return match?.[1] ?? ''
}

describe('category page visual styles', () => {
    it('keeps popular searches on a white marketplace surface', () => {
        expect(getRule(browsePanelCss, '.popular-searches')).toContain('background: var(--surface)')
    })

    it('shows selected categories as chips without an enclosing card surface', () => {
        const selectedCategorySummaryRule = getRule(categoryCss, '.selected-category-summary')

        expect(selectedCategorySummaryRule).toContain('padding: 0')
        expect(selectedCategorySummaryRule).toContain('border: 0')
        expect(selectedCategorySummaryRule).toContain('border-radius: 0')
        expect(selectedCategorySummaryRule).toContain('background: transparent')
    })
})
