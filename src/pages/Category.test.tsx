import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Category from './Category'
import { mockExpertProducts } from '../data/mockData'

const getExpertProducts = vi.fn(async () => mockExpertProducts)
const getUserFavoriteProductIds = vi.fn(async (_userId: string) => [] as string[])
const getFavoriteProductCount = vi.fn(async (_productId: string) => 0)
const toggleFavoriteProduct = vi.fn(async (_userId: string, productId: string) => [productId])

vi.mock('../lib/storage', () => ({
  getExpertProducts: () => getExpertProducts(),
  getUserFavoriteProductIds: (userId: string) => getUserFavoriteProductIds(userId),
  getFavoriteProductCount: (productId: string) => getFavoriteProductCount(productId),
  toggleFavoriteProduct: (userId: string, productId: string) => toggleFavoriteProduct(userId, productId),
}))

describe('Category', () => {
  beforeEach(() => {
    getExpertProducts.mockResolvedValue(mockExpertProducts)
  })

  it('renders products instead of expert cards', async () => {
    render(
      <MemoryRouter>
        <Category />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'AI 작업 찾기' })).toBeInTheDocument()
    expect(screen.getByText('AI 영상/숏폼')).toBeInTheDocument()
    expect(screen.getByText('AI 이미지/캐릭터')).toBeInTheDocument()
    expect(screen.getByText('AI 개발/자동화')).toBeInTheDocument()
    expect(await screen.findAllByRole('link', { name: /상세 보기/ })).toHaveLength(3)
    expect(screen.queryByRole('link', { name: '패키지로 의뢰하기' })).not.toBeInTheDocument()
    expect(screen.getByText('시작가 30,000원')).toBeInTheDocument()
    expect(screen.getByText('ChatGPT · Runway · Premiere Pro')).toBeInTheDocument()
  })

  it('shows an empty state without an all-products button when filters remove all products', async () => {
    render(
      <MemoryRouter>
        <Category />
      </MemoryRouter>,
    )

    await screen.findAllByRole('link', { name: /상세 보기/ })
    fireEvent.change(screen.getByLabelText('최대 가격'), { target: { value: '10000' } })

    expect(screen.getByText('아직 등록된 AI 작업이 없습니다.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'AI 작업 요청하기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '전체 상품 보기' })).not.toBeInTheDocument()
  })

  it('keeps all products visible by default even when a saved product has an unknown category', async () => {
    getExpertProducts.mockResolvedValue([
      {
        ...mockExpertProducts[0],
        id: 'product-unknown-category',
        title: '등록 카테고리 불일치 상품',
        category: 'custom-category-from-db' as any,
      },
    ])

    render(
      <MemoryRouter>
        <Category />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '등록 카테고리 불일치 상품' })).toBeInTheDocument()
  })
})
