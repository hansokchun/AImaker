import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Category from './Category'
import { AI_CATEGORIES } from '../constants/categories'
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
    getUserFavoriteProductIds.mockClear()
    getFavoriteProductCount.mockClear()
    toggleFavoriteProduct.mockClear()
  })

  it('renders products instead of expert cards', async () => {
    render(
      <MemoryRouter>
        <Category />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: mockExpertProducts[0].title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: mockExpertProducts[1].title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: mockExpertProducts[2].title })).toBeInTheDocument()
  })

  it('shows an empty state when filters remove all products', async () => {
    const { container } = render(
      <MemoryRouter>
        <Category />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: mockExpertProducts[0].title })

    const maxPriceInput = container.querySelector<HTMLInputElement>('#max-price')
    expect(maxPriceInput).not.toBeNull()
    fireEvent.change(maxPriceInput!, { target: { value: '10000' } })

    expect(screen.queryByRole('heading', { name: mockExpertProducts[0].title })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: mockExpertProducts[1].title })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: mockExpertProducts[2].title })).not.toBeInTheDocument()
  })

  it('keeps all products visible by default even when a saved product has an unknown category', async () => {
    const unknownCategoryProduct = {
      ...mockExpertProducts[0],
      id: 'product-unknown-category',
      title: 'Unknown category product',
      category: 'custom-category-from-db' as any,
    }
    getExpertProducts.mockResolvedValue([unknownCategoryProduct])

    render(
      <MemoryRouter>
        <Category />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: unknownCategoryProduct.title })).toBeInTheDocument()
  })

  it('shows default products immediately while stored products are loading', () => {
    getExpertProducts.mockReturnValue(new Promise(() => undefined))

    render(
      <MemoryRouter>
        <Category />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: mockExpertProducts[0].title })).toBeInTheDocument()
    expect(screen.getByText(`총 ${mockExpertProducts.length}개의 AI 작업`)).toBeInTheDocument()
  })

  it('filters to the clicked category from the initial all-selected state', async () => {
    render(
      <MemoryRouter>
        <Category />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: mockExpertProducts[0].title })

    fireEvent.click(screen.getByLabelText(AI_CATEGORIES[1].name))

    expect(screen.getByRole('heading', { name: mockExpertProducts[1].title })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: mockExpertProducts[0].title })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: mockExpertProducts[2].title })).not.toBeInTheDocument()
  })

  it('opens with the category from the URL selected and filtered', async () => {
    render(
      <MemoryRouter initialEntries={['/category?category=ai-image-character']}>
        <Category />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: mockExpertProducts[1].title })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: mockExpertProducts[0].title })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: mockExpertProducts[2].title })).not.toBeInTheDocument()

    expect(screen.getByLabelText(AI_CATEGORIES[0].name)).not.toBeChecked()
    expect(screen.getByLabelText(AI_CATEGORIES[1].name)).toBeChecked()
    expect(screen.getByLabelText(AI_CATEGORIES[2].name)).not.toBeChecked()
  })

  it('filters products by the search keyword from the URL and search input', async () => {
    render(
      <MemoryRouter initialEntries={[`/category?q=${encodeURIComponent(mockExpertProducts[1].title)}`]}>
        <Category />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: mockExpertProducts[1].title })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: mockExpertProducts[0].title })).not.toBeInTheDocument()
    expect(screen.getByLabelText('상품 검색')).toHaveValue(mockExpertProducts[1].title)

    fireEvent.change(screen.getByLabelText('상품 검색'), { target: { value: mockExpertProducts[0].title } })

    expect(screen.getByRole('heading', { name: mockExpertProducts[0].title })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: mockExpertProducts[1].title })).not.toBeInTheDocument()
  })

  it('searches product summaries, descriptions, experts, and tools as well as titles', async () => {
    const products = [
      {
        ...mockExpertProducts[0],
        id: 'search-description-product',
        title: '제목에는 없는 상품',
        summary: '브랜드 릴스와 랜딩 이미지를 함께 구성합니다',
        description: '스마트스토어 상세페이지와 전환용 배너를 제작합니다',
        expertName: '전환디자인랩',
        aiTools: ['Midjourney', 'Runway'],
      },
      {
        ...mockExpertProducts[1],
        id: 'search-other-product',
        title: '다른 상품',
        summary: '다른 요약',
        description: '다른 설명',
        expertName: '다른 전문가',
        aiTools: ['ChatGPT'],
      },
    ]
    getExpertProducts.mockResolvedValue(products)

    render(
      <MemoryRouter initialEntries={['/category?q=상세페이지']}>
        <Category />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '제목에는 없는 상품' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '다른 상품' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('상품 검색'), { target: { value: '전환디자인랩' } })
    expect(screen.getByRole('heading', { name: '제목에는 없는 상품' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('상품 검색'), { target: { value: 'Runway' } })
    expect(screen.getByRole('heading', { name: '제목에는 없는 상품' })).toBeInTheDocument()
  })

  it('deselects a category when the selected category is clicked again', async () => {
    render(
      <MemoryRouter>
        <Category />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: mockExpertProducts[0].title })

    const categoryCheckbox = screen.getByLabelText(AI_CATEGORIES[1].name) as HTMLInputElement
    fireEvent.click(categoryCheckbox)
    expect(categoryCheckbox.checked).toBe(true)

    fireEvent.click(categoryCheckbox)

    expect(categoryCheckbox.checked).toBe(false)
    expect(screen.getByRole('heading', { name: mockExpertProducts[0].title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: mockExpertProducts[1].title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: mockExpertProducts[2].title })).toBeInTheDocument()
  })
})
