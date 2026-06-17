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

  it('shows a Fiverr-inspired AI marketplace hero with search and quick entry points', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'AI 작업을 싸고 쉽게 맡기세요' })).toBeInTheDocument()
    expect(screen.getByText(/샘플과 시작가를 보고/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('어떤 AI 작업이 필요하세요?')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'AI 작업 찾기' })).toHaveAttribute('href', '/category')
    expect(screen.getByRole('link', { name: '작업자로 시작하기' })).toHaveAttribute('href', '/profile')

    expect(screen.getByRole('link', { name: 'AI 영상/숏폼' })).toHaveAttribute('href', '/category')
    expect(screen.getByRole('link', { name: 'AI 이미지/캐릭터' })).toHaveAttribute('href', '/category')
    expect(screen.getByRole('link', { name: 'AI 개발/자동화' })).toHaveAttribute('href', '/category')
    expect(screen.getByRole('link', { name: '프롬프트/콘텐츠 시안' })).toHaveAttribute('href', '/category')

    expect(screen.getByText('AI 특화')).toBeInTheDocument()
    expect(screen.getByText('샘플 보고 의뢰')).toBeInTheDocument()
    expect(screen.getByText('작업방에서 진행 확인')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'AI 작업 카테고리' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '바로 의뢰할 수 있는 AI 상품' })).toBeInTheDocument()
    expect(await screen.findAllByRole('link', { name: /의뢰 시작/ })).toHaveLength(3)
    expect(screen.getAllByRole('link', { name: /상세 보기/ })).toHaveLength(3)
    expect(screen.getByRole('heading', { name: '작업은 작업방에서 단계별로 확인하세요' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI 도구를 다룰 줄 안다면 작업자로 시작할 수 있어요' })).toBeInTheDocument()
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
