import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

describe('test environment', () => {
  it('renders React components with jest-dom matchers', () => {
    render(<button type="button">AIConnect 테스트</button>)

    expect(screen.getByRole('button', { name: 'AIConnect 테스트' })).toBeInTheDocument()
  })
})
