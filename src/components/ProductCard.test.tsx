import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductCard from './ProductCard'
import { mockExpertProducts } from '../data/mockData'

const getUserFavoriteProductIds = vi.fn(async (_userId: string) => [] as string[])
const getFavoriteProductCount = vi.fn(async (_productId: string) => 0)
const toggleFavoriteProduct = vi.fn(async (_userId: string, productId: string) => [productId])

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'client-01', email: 'client@example.com' },
  }),
}))

vi.mock('../lib/storage', () => ({
  getUserFavoriteProductIds: (userId: string) => getUserFavoriteProductIds(userId),
  getFavoriteProductCount: (productId: string) => getFavoriteProductCount(productId),
  toggleFavoriteProduct: (userId: string, productId: string) => toggleFavoriteProduct(userId, productId),
}))

function CurrentPath() {
  const location = useLocation()
  return <div data-testid="current-path">{location.pathname}</div>
}

describe('ProductCard', () => {
  beforeEach(() => {
    getUserFavoriteProductIds.mockClear()
    getFavoriteProductCount.mockClear()
    toggleFavoriteProduct.mockClear()
    getUserFavoriteProductIds.mockResolvedValue([])
    getFavoriteProductCount.mockResolvedValue(0)
    toggleFavoriteProduct.mockImplementation(async (_userId: string, productId: string) => [productId])
  })

  it('shows product info and opens detail from the whole card', () => {
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
    expect(screen.getByAltText(`${product.title} 샘플`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: `${product.expertName} 프로필 보기` })).toHaveAttribute(
      'href',
      `/expert/${product.expertId}`,
    )
    expect(screen.queryByRole('link', { name: '패키지로 의뢰하기' })).not.toBeInTheDocument()
  })

  it('toggles a product as a favorite without opening the detail page', async () => {
    const product = mockExpertProducts[0]

    render(
      <MemoryRouter initialEntries={['/category']}>
        <ProductCard product={product} />
        <CurrentPath />
      </MemoryRouter>,
    )

    const favoriteButton = await screen.findByRole('button', { name: `${product.title} 관심 상품 추가` })
    fireEvent.click(favoriteButton)

    expect(toggleFavoriteProduct).toHaveBeenCalledWith('client-01', product.id)
    expect(screen.getByTestId('current-path')).toHaveTextContent('/category')
    expect(await screen.findByRole('button', { name: `${product.title} 관심 상품 해제` })).toBeInTheDocument()
  })
})
