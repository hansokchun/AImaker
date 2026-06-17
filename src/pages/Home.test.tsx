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

  it('shows a Stitch-inspired product-first home without process explanations', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '검증된 AI 전문가를 고르는 가장 조용한 방법' })).toBeInTheDocument()
    expect(screen.getByText('영상, 이미지, 자동화 작업을 상품 단위로 비교하고 바로 시작하세요.')).toBeInTheDocument()
    expect(screen.getByText('검증된 상품')).toBeInTheDocument()
    expect(screen.getByText('상품 기반 의뢰')).toBeInTheDocument()
    expect(screen.getByText('안전한 작업 관리')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'AI 작업 찾기' })).toHaveAttribute('href', '/category')
    expect(screen.getByRole('link', { name: '전문가로 시작하기' })).toHaveAttribute('href', '/profile')

    expect(screen.queryByText('상품 탐색')).not.toBeInTheDocument()
    expect(screen.queryByText('요구사항 작성')).not.toBeInTheDocument()
    expect(screen.queryByText('제안서 확인')).not.toBeInTheDocument()
    expect(screen.queryByText('주문 전에 단계가 보입니다')).not.toBeInTheDocument()

    expect(screen.getByRole('heading', { name: '최근 등록된 AI 상품' })).toBeInTheDocument()
    expect(screen.getByText('Stitch 미니멀 디자인에 맞춰 상품 정보만 선명하게 보여줍니다.')).toBeInTheDocument()
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
