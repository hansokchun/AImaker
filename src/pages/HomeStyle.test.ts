import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/index.css', 'utf8')

const getRule = (selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`))
  return match?.[1] ?? ''
}

describe('home hero visual styles', () => {
  it('lets the hero gradient continue naturally into the category section', () => {
    expect(getRule('.home-page-minimal')).toContain('linear-gradient(180deg')
    expect(getRule('.home-minimal-hero')).not.toContain('linear-gradient(180deg')
    expect(getRule('.home-minimal-categories')).toContain('margin-top: -1.25rem')
    expect(getRule('.home-minimal-popular a')).toContain('border-radius: 999px')
  })

  it('keeps the How it Works process row at a balanced readable width', () => {
    expect(getRule('.home-minimal-process-list')).toContain('max-width: var(--container-max)')
    expect(getRule('.home-minimal-process-list')).toContain('margin: 0 auto')
  })

  it('uses an S-shaped process path that matches the minimal site style', () => {
    expect(getRule('.home-minimal-process-list')).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))')
    expect(getRule('.home-minimal-process-list')).toContain('min-height: 240px')
    expect(getRule('.home-minimal-process-list::before')).toContain('linear-gradient(90deg, transparent, #93c5fd, #1479ff, #93c5fd, transparent)')
    expect(getRule('.home-minimal-process-list::before')).toContain("url(\"data:image/svg+xml")
    expect(getRule('.home-minimal-process-list::before')).toContain('stroke-width=\'4\'')
    expect(getRule('.home-minimal-process-list::after')).toContain('filter: blur(12px)')
    expect(getRule('.home-minimal-process-item:nth-of-type(1)')).toContain('transform: translateY(-18px)')
    expect(getRule('.home-minimal-process-item:nth-of-type(2)')).toContain('transform: translateY(-26px)')
    expect(getRule('.home-minimal-process-item:nth-of-type(3)')).toContain('transform: translateY(18px)')
    expect(getRule('.home-minimal-process-item:nth-of-type(4)')).toContain('transform: translateY(12px)')
    expect(getRule('.home-minimal-process-item > p')).toContain('background: rgba(255, 255, 255, 0.94)')
    expect(getRule('.home-minimal-process-line')).toContain('display: none')
  })
})
