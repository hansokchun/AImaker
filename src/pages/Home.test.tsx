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

  it('shows the practical AI marketplace direction without a search-heavy hero', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'AI 작업을 싸고 쉽게 맡기세요' })).toBeInTheDocument()
    expect(screen.getByText(/누구나 저렴하게 의뢰하고/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'AI 작업 둘러보기' })).toHaveAttribute('href', '/category')
    expect(screen.getByRole('link', { name: '작업자로 시작하기' })).toHaveAttribute('href', '/profile')
    expect(screen.queryByPlaceholderText('어떤 AI 작업이 필요하세요?')).not.toBeInTheDocument()

    expect(screen.getByText('AI라서 더 낮은 가격')).toBeInTheDocument()
    expect(screen.getByText('샘플 보고 선택')).toBeInTheDocument()
    expect(screen.getByText('작업방에서 진행 확인')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: '먼저 필요한 AI 작업을 고르세요' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI 영상/숏폼' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI 이미지/캐릭터' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI 개발/자동화' })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: '입문형 AI 상품' })).toBeInTheDocument()
    expect(await screen.findAllByRole('link', { name: /의뢰 시작/ })).toHaveLength(3)
    expect(screen.getAllByRole('link', { name: /상세 보기/ })).toHaveLength(3)
    expect(screen.getByRole('heading', { name: '의뢰 흐름은 단순하게 유지합니다' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI를 다룰 줄 안다면 작업자로 시작하세요' })).toBeInTheDocument()
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
    expect(screen.getByRole('link', { name: /의뢰 시작/ })).toHaveAttribute(
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
