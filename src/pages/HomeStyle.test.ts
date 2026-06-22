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
    expect(getRule('.home-minimal-categories')).toContain('margin-top: -2rem')
  })

  it('keeps the How it Works process row at a balanced readable width', () => {
    expect(getRule('.home-minimal-process-list')).toContain('max-width: var(--container-max)')
    expect(getRule('.home-minimal-process-list')).toContain('margin: 0 auto')
  })

  it('uses a curved staggered process path instead of a straight line', () => {
    expect(getRule('.home-minimal-process-list')).toContain('grid-template-columns: repeat(5, minmax(0, 1fr))')
    expect(getRule('.home-minimal-process-list::before')).toContain('border-top: 2px solid #c3c6d7')
    expect(getRule('.home-minimal-process-list::before')).toContain('border-radius: 50%')
    expect(getRule('.home-minimal-process-item:nth-of-type(odd)')).toContain('transform: translateY(-18px)')
    expect(getRule('.home-minimal-process-item:nth-of-type(even)')).toContain('transform: translateY(26px)')
    expect(getRule('.home-minimal-process-line')).toContain('display: none')
  })
})
