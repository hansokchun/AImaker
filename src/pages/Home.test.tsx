import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Home from './Home'
import { mockExpertProducts } from '../data/mockData'
import { getExpertProducts } from '../lib/storage'

vi.mock('../lib/storage', () => ({
  getExpertProducts: vi.fn(async () => mockExpertProducts),
}))

describe('Home', () => {
  beforeEach(() => {
    vi.mocked(getExpertProducts).mockResolvedValue(mockExpertProducts)
  })

  it('shows the upgraded product-first home page', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /AI 작업을 고르고 바로 주문하세요/ })).toBeInTheDocument()
    expect(screen.getByText('상품 탐색')).toBeInTheDocument()
    expect(screen.getByText('요구사항 작성')).toBeInTheDocument()
    expect(screen.getByText('제안서 확인')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /AI 작업 둘러보기/ })).toHaveAttribute('href', '/category')
    expect(screen.getByRole('link', { name: /전문가 상품 등록/ })).toHaveAttribute('href', '/profile')

    expect(screen.getByRole('heading', { name: '필요한 작업을 빠르게 좁혀보세요' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '바로 주문 가능한 AI 상품' })).toBeInTheDocument()
    expect(await screen.findAllByRole('link', { name: /상품 자세히 보기/ })).toHaveLength(3)
    expect(screen.getByText('주문 후에도 단계가 보입니다')).toBeInTheDocument()
  })

  it('shows recommended products from shared product storage', async () => {
    vi.mocked(getExpertProducts).mockResolvedValue([
      {
        ...mockExpertProducts[0],
        id: 'home-product-real-01',
        title: 'Home real product',
        summary: 'Real product summary',
        startingPrice: 88000,
        deliveryDays: 6,
      },
    ])

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Home real product' })).toBeInTheDocument()
    expect(screen.getByText('Real product summary')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /주문 시작/ })).toHaveAttribute(
      'href',
      '/request/home-product-real-01',
    )
  })
})
