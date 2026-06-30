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
    expect(screen.getByText(product.expertName)).toBeInTheDocument()
    expect(screen.queryByText('작업 등록 전문가')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '상품 구매하기' })).not.toBeInTheDocument()
  })

  it('presents the compact listing details clients need for browsing', () => {
    const product = {
      ...mockExpertProducts[0],
      taxInvoiceAvailable: true,
    }

    const { container } = render(
      <MemoryRouter>
        <ProductCard product={product} />
      </MemoryRouter>,
    )

    expect(container.querySelector('.product-card-avatar')?.tagName).toBe('IMG')
    expect(screen.getByText(product.expertName)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: product.title })).toBeInTheDocument()
    expect(screen.getByText(product.summary)).toBeInTheDocument()
    expect(screen.getByText(`${currencyForTest(product.startingPrice)}원부터`)).toBeInTheDocument()
    expect(screen.queryByText('AI 영상/숏폼')).not.toBeInTheDocument()
    expect(screen.queryByText('평점 신규')).not.toBeInTheDocument()
    expect(screen.queryByText(`${product.deliveryDays}일 납기`)).not.toBeInTheDocument()
    expect(screen.queryByText(`수정 ${product.revisionCount}회`)).not.toBeInTheDocument()
    expect(screen.queryByText('세금계산서 가능')).not.toBeInTheDocument()
    expect(screen.queryByText(product.aiTools[0])).not.toBeInTheDocument()
  })

  it('uses the expert profile image instead of a text initial when provided', () => {
    const product = {
      ...mockExpertProducts[0],
      expertImageUrl: 'https://example.com/expert-profile.jpg',
    }

    const { container } = render(
      <MemoryRouter>
        <ProductCard product={product} />
      </MemoryRouter>,
    )

    const avatar = container.querySelector('.product-card-avatar')
    expect(avatar?.tagName).toBe('IMG')
    expect(avatar).toHaveAttribute('src', product.expertImageUrl)
    expect(screen.getByText(product.expertName)).toBeInTheDocument()
  })

  it('keeps the favorite action as a thumbnail overlay icon', async () => {
    const product = mockExpertProducts[0]

    const { container } = render(
      <MemoryRouter initialEntries={['/category']}>
        <ProductCard product={product} />
      </MemoryRouter>,
    )

    const imageArea = container.querySelector('.product-card-image')
    const favoriteButton = await screen.findByRole('button', { name: new RegExp(product.title) })

    expect(imageArea).toContainElement(favoriteButton)
    expect(favoriteButton).toHaveClass('product-card-favorite')
    expect(favoriteButton).toHaveClass('is-icon')
    expect(favoriteButton).not.toHaveTextContent('관심 추가')
    expect(favoriteButton.querySelector('svg')).toBeInTheDocument()
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

  it('shows a placeholder instead of an empty product image', () => {
    const product = { ...mockExpertProducts[0], sampleImageUrl: '' }

    render(
      <MemoryRouter>
        <ProductCard product={product} />
      </MemoryRouter>,
    )

    expect(screen.queryByAltText(`${product.title} 샘플`)).not.toBeInTheDocument()
    expect(screen.getByText('이미지 준비 중')).toBeInTheDocument()
  })

  it('falls back to a placeholder when the product image fails to load', async () => {
    const product = { ...mockExpertProducts[0], sampleImageUrl: 'https://example.invalid/missing.jpg' }

    render(
      <MemoryRouter>
        <ProductCard product={product} />
      </MemoryRouter>,
    )

    fireEvent.error(screen.getByAltText(`${product.title} 샘플`))

    expect(await screen.findByText('이미지 준비 중')).toBeInTheDocument()
    expect(screen.queryByAltText(`${product.title} 샘플`)).not.toBeInTheDocument()
  })
})

const currencyForTest = (value: number) => new Intl.NumberFormat('ko-KR').format(value)
