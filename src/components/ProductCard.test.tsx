import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ProductCard from './ProductCard'
import { mockExpertProducts } from '../data/mockData'

describe('ProductCard', () => {
  it('shows product price, AI tools, sample info, and request CTA', () => {
    const product = mockExpertProducts[0]

    render(
      <MemoryRouter>
        <ProductCard product={product} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: product.title })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: product.title })).toHaveAttribute('href', `/expert/${product.id}`)
    expect(screen.getByText('시작가 30,000원')).toBeInTheDocument()
    expect(screen.getByText('ChatGPT · Runway · Premiere Pro')).toBeInTheDocument()
    expect(screen.getByAltText(`${product.title} 샘플`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '패키지로 의뢰하기' })).toBeInTheDocument()
  })
})
