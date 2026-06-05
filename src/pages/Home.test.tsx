import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockExpertProducts } from '../data/mockData'
import { getExpertProducts } from '../lib/storage'
import Home from './Home'

const mockUseAuth = vi.fn()
const mockGetUserDisplayProfile = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../lib/storage', () => ({
  getExpertProducts: vi.fn(async () => mockExpertProducts),
  getUserDisplayProfile: (userId: string) => mockGetUserDisplayProfile(userId),
}))

describe('Home', () => {
  beforeEach(() => {
    vi.mocked(getExpertProducts).mockResolvedValue(mockExpertProducts)
    mockUseAuth.mockReturnValue({ user: null })
    mockGetUserDisplayProfile.mockResolvedValue(null)
  })

  it('shows a minimal Apple-like product-first home without process explanations', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'AI 작업, 더 간단하게.' })).toBeInTheDocument()
    expect(screen.getByText('원하는 상품을 고르고 바로 주문하세요.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '상품 둘러보기' })).toHaveAttribute('href', '/category')
    expect(screen.getByRole('link', { name: '전문가로 시작하기' })).toHaveAttribute('href', '/profile')

    expect(screen.queryByText('상품 탐색')).not.toBeInTheDocument()
    expect(screen.queryByText('요구사항 작성')).not.toBeInTheDocument()
    expect(screen.queryByText('제안서 확인')).not.toBeInTheDocument()
    expect(screen.queryByText('주문 후에도 단계가 보입니다')).not.toBeInTheDocument()

    expect(screen.getByRole('heading', { name: '추천 AI 상품' })).toBeInTheDocument()
    expect(await screen.findAllByRole('link', { name: /주문 시작/ })).toHaveLength(3)
    expect(screen.getAllByRole('link', { name: /자세히 보기/ })).toHaveLength(3)
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

  it('shows the logged-in user profile image on the home page', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-demo-01', user_metadata: {} },
    })
    mockGetUserDisplayProfile.mockResolvedValue({
      imageUrl: 'https://example.com/home-avatar.jpg',
    })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('img', { name: '내 프로필 이미지' })).toHaveAttribute(
      'src',
      'https://example.com/home-avatar.jpg',
    )
    expect(screen.getByRole('link', { name: /내 프로필/ })).toHaveAttribute('href', '/mypage?panel=profile')
  })
})
