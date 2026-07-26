import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('test environment', () => {
  it('renders React components with jest-dom matchers', () => {
    render(<button type="button">기그온 테스트</button>)

    expect(screen.getByRole('button', { name: '기그온 테스트' })).toBeInTheDocument()
  })
})
