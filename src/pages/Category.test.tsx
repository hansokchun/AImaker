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
