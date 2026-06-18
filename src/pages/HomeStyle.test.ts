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
})
