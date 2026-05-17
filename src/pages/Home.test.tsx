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

  it('shows the launch hero message, initial categories, product section, and CTAs', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /AI 외주를 더 쉽고\s*저렴하게/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /AI 작업 맡기기/ })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /AI 전문가로 시작하기/ }).length).toBeGreaterThan(0)

    expect(screen.getByRole('heading', { name: 'AI 영상/숏폼' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI 이미지/캐릭터' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI 개발/자동화' })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: '바로 의뢰할 수 있는 AI 작업' })).toBeInTheDocument()
    expect(await screen.findAllByRole('link', { name: /패키지로 의뢰하기/ })).toHaveLength(3)
    expect(screen.getByText('작업이 어디까지 진행됐는지 단계별로 확인하세요.')).toBeInTheDocument()
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
    expect(screen.getByRole('link', { name: /패키지로 의뢰하기/ })).toHaveAttribute(
      'href',
      '/request/home-product-real-01',
    )
  })
})
