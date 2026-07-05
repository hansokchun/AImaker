import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
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
    if (maxPriceInput === null) throw new Error('max price input missing')
    fireEvent.change(maxPriceInput, { target: { value: '10000' } })

    expect(screen.queryByRole('heading', { name: mockExpertProducts[0].title })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: mockExpertProducts[1].title })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: mockExpertProducts[2].title })).not.toBeInTheDocument()
  })

  it('keeps all products visible by default even when a saved product has an unknown category', async () => {
    const unknownCategoryProduct = {
      ...mockExpertProducts[0],
      id: 'product-unknown-category',
      title: 'Unknown category product',
      category: 'custom-category-from-db',
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
    expect(screen.queryByText(`총 ${mockExpertProducts.length}개의 AI 작업`)).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '상품 정렬' })).toHaveValue('추천순')
  })

  it('renders breadcrumb navigation and popular searches without the category card panel', async () => {
    render(
      <MemoryRouter>
        <Category />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: mockExpertProducts[0].title })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '현재 위치' })).toHaveTextContent('홈/AI 작업 찾기')
    expect(screen.queryByText('AIConnect Marketplace')).not.toBeInTheDocument()
    expect(screen.queryByText('상품 검색')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'AI 작업을 카테고리별로 탐색하세요' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `${AI_CATEGORIES[0].name} 카테고리 보기` })).not.toBeInTheDocument()
    expect(screen.queryByText('샘플, 판매자, 가격, 납기를 한 번에 비교하고 마음에 드는 AI 상품을 바로 확인하세요.')).not.toBeInTheDocument()
    expect(screen.queryByText('필터')).not.toBeInTheDocument()
    expect(screen.getByText('자주 찾는 AI 작업')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '숏폼 영상 검색' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '업무 자동화 검색' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: '사용 AI 도구' })).not.toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: '상품 검색어' })).not.toBeInTheDocument()
    expect(screen.queryByText(/^총 \d+개의 AI 작업$/)).not.toBeInTheDocument()
    expect(screen.queryByText('favorite_border')).not.toBeInTheDocument()

    const selectedCategoryStatus = screen.getByRole('status', { name: '선택된 카테고리' })
    expect([...selectedCategoryStatus.querySelectorAll('.selected-category-chip')].map((chip) => chip.textContent)).toEqual(
      AI_CATEGORIES.map((category) => category.name),
    )
  })

  it('uses the URL keyword as the category hero search result title', async () => {
    render(
      <MemoryRouter initialEntries={['/category?q=쿠팡']}>
        <Category />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: "'쿠팡'에 대한 검색결과" })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'AI 작업 찾기' })).not.toBeInTheDocument()
    expect(screen.queryByText('샘플, 판매자, 가격, 납기를 한 번에 비교하고 마음에 드는 AI 상품을 바로 확인하세요.')).not.toBeInTheDocument()
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
    const { container } = render(
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

    const selectedCategoryStatus = screen.getByRole('status', { name: '선택된 카테고리' })
    const filterSidebar = screen.getByRole('complementary', { name: '상품 필터' })
    const productListMain = container.querySelector('.product-list-main')
    const filterColumn = container.querySelector('.category-filter-column')
    expect(selectedCategoryStatus).toHaveTextContent(AI_CATEGORIES[1].name)
    expect(selectedCategoryStatus.querySelector('.selected-category-chip')).toHaveTextContent(AI_CATEGORIES[1].name)
    expect(productListMain).toContainElement(selectedCategoryStatus)
    expect(productListMain?.firstElementChild).toBe(selectedCategoryStatus)
    expect(filterSidebar).not.toContainElement(selectedCategoryStatus)
    expect(filterColumn).not.toBeInTheDocument()
    expect(screen.queryByText('선택 카테고리')).not.toBeInTheDocument()
    expect(container.querySelector('.filter-sidebar-head')).not.toBeInTheDocument()
  })

  it('filters products by the search keyword from the URL and popular search buttons', async () => {
    render(
      <MemoryRouter initialEntries={[`/category?q=${encodeURIComponent(mockExpertProducts[1].title)}`]}>
        <Category />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: mockExpertProducts[1].title })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: mockExpertProducts[0].title })).not.toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: '상품 검색어' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '숏폼 영상 검색' }))

    expect(screen.getByRole('heading', { name: mockExpertProducts[0].title })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: mockExpertProducts[1].title })).not.toBeInTheDocument()
  })

  it('updates the product results when the URL search query changes on the category route', async () => {
    render(
      <MemoryRouter initialEntries={[`/category?q=${encodeURIComponent(mockExpertProducts[1].title)}`]}>
        <Routes>
          <Route
            path="/category"
            element={(
              <>
                <Link to={`/category?q=${encodeURIComponent(mockExpertProducts[0].title)}`}>숏폼으로 다시 검색</Link>
                <Category />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: mockExpertProducts[1].title })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: '숏폼으로 다시 검색' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: mockExpertProducts[0].title })).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: mockExpertProducts[1].title })).not.toBeInTheDocument()
  })

  it('searches product summaries, descriptions, and experts as well as titles', async () => {
    const products = [
      {
        ...mockExpertProducts[0],
        id: 'search-description-product',
        title: '제목에는 없는 상품',
        summary: '브랜드 릴스와 랜딩 이미지를 함께 구성합니다',
        description: '스마트스토어 상세페이지와 전환용 배너를 제작합니다',
        expertName: '전환디자인랩',
      },
      {
        ...mockExpertProducts[1],
        id: 'search-other-product',
        title: '다른 상품',
        summary: '다른 요약',
        description: '다른 설명',
        expertName: '다른 전문가',
      },
    ]
    getExpertProducts.mockResolvedValue(products)

    render(
      <MemoryRouter initialEntries={['/category?q=상세페이지']}>
        <Routes>
          <Route
            path="/category"
            element={(
              <>
                <Link to="/category?q=전환디자인랩">전문가명으로 검색</Link>
                <Link to="/category?q=Runway">도구명으로 검색</Link>
                <Category />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '제목에는 없는 상품' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '다른 상품' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: '전문가명으로 검색' }))
    expect(screen.getByRole('heading', { name: '제목에는 없는 상품' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: '도구명으로 검색' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: '제목에는 없는 상품' })).not.toBeInTheDocument())
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
