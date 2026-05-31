import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import ProductCard from './ProductCard'
import { mockExpertProducts } from '../data/mockData'

function CurrentPath() {
  const location = useLocation()
  return <div data-testid="current-path">{location.pathname}</div>
}

describe('ProductCard', () => {
  it('shows product price, AI tools, sample info, and opens detail from the whole card', () => {
    const product = mockExpertProducts[0]

    render(
      <MemoryRouter initialEntries={['/category/video']}>
        <ProductCard product={product} />
        <CurrentPath />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: product.title })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: `${product.title} 상세 보기` }))
    expect(screen.getByTestId('current-path')).toHaveTextContent(`/expert/${product.id}`)
    expect(screen.getByText('시작가 30,000원')).toBeInTheDocument()
    expect(screen.getByText('ChatGPT · Runway · Premiere Pro')).toBeInTheDocument()
    expect(screen.getByAltText(`${product.title} 샘플`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: `${product.expertName} 프로필 보기` })).toHaveAttribute(
      'href',
      `/expert/${product.expertId}`,
    )
    expect(screen.queryByRole('link', { name: '패키지로 의뢰하기' })).not.toBeInTheDocument()
  })
})
