import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockExpertProducts } from '../data/mockData'
import { getExpertProducts } from '../lib/storage'
import Home from './Home'

const mockUseAuth = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../lib/storage', () => ({
  getExpertProducts: vi.fn(async () => mockExpertProducts),
}))

describe('Home', () => {
  beforeEach(() => {
    vi.mocked(getExpertProducts).mockResolvedValue(mockExpertProducts)
    mockUseAuth.mockReturnValue({ user: null })
  })

  it('shows a clean buyer-first AI marketplace home', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', {
        name: 'AI 영상, 이미지, 자동화 작업을 더 저렴하게 맡기세요',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/샘플과 가격을 보고 AI 작업자를 찾아 의뢰할 수 있어요/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'AI 전문가 찾기' })).toHaveAttribute('href', '/category')
    expect(screen.getByRole('link', { name: '상품 둘러보기' })).toHaveAttribute('href', '/category')
    expect(screen.queryByRole('link', { name: '전문가로 시작하기' })).not.toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'AI 영상/숏폼' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI 이미지/캐릭터' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI 개발/자동화' })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: '입문형 AI 상품' })).toBeInTheDocument()
    expect(await screen.findAllByRole('link', { name: /의뢰하기/ })).toHaveLength(3)
    expect(screen.getAllByRole('link', { name: /전문가 보기/ })).toHaveLength(3)

    expect(screen.getByText('샘플 확인 · 요구사항 작성 · 작업방에서 진행 확인')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'AI 도구를 다룰 줄 안다면 작업자로 시작하세요' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '첫 상품 등록하기' })).toHaveAttribute('href', '/profile')
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
    expect(screen.getByRole('link', { name: /의뢰하기/ })).toHaveAttribute(
      'href',
      '/request/home-product-real-01',
    )
  })

  it('keeps a visible product thumbnail when the external image fails', async () => {
    vi.mocked(getExpertProducts).mockResolvedValue([
      {
        ...mockExpertProducts[0],
        id: 'home-product-broken-image',
        title: 'Broken image product',
        sampleImageUrl: 'https://example.com/missing-image.jpg',
      },
    ])

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    const thumbnail = await screen.findByRole('img', { name: 'Broken image product 썸네일' })
    const image = screen.getByTestId('home-product-image-home-product-broken-image')

    fireEvent.error(image)

    expect(thumbnail).toBeInTheDocument()
    expect(screen.getByText('Broken image product')).toBeInTheDocument()
    expect(image).not.toBeInTheDocument()
  })

  it('shows a direct my work shortcut in the home hero after login', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-demo-01', user_metadata: {} },
    })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: '내 작업 보기' })).toHaveAttribute('href', '/my-work')
  })
})
