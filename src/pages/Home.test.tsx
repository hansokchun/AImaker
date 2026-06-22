import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
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

function CurrentPath() {
  const location = useLocation()
  return <div data-testid="current-path">{location.pathname}{location.search}</div>
}

describe('Home', () => {
  beforeEach(() => {
    vi.mocked(getExpertProducts).mockResolvedValue(mockExpertProducts)
    mockUseAuth.mockReturnValue({ user: null })
  })

  it('keeps the Stitch home structure with image-backed category buttons and focused copy', async () => {
    vi.mocked(getExpertProducts).mockResolvedValue([
      ...mockExpertProducts,
      {
        ...mockExpertProducts[0],
        id: 'home-product-fourth',
        title: '실사 상업용 제품 이미지 20컷',
        expertName: 'Photo-G',
        startingPrice: 45000,
      },
    ])

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /AI로 더 싸고 빠르게,\s*필요한 작업을 의뢰하세요/ })).toBeInTheDocument()
    expect(screen.queryByText('샘플과 가격을 보고 바로 의뢰하세요.')).not.toBeInTheDocument()
    expect(
      screen.queryByText('샘플과 가격을 보고 AI 작업자를 찾아 의뢰할 수 있어요. 전문가의 손길로 AI의 잠재력을 비즈니스에 연결하세요.'),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'AI 전문가 찾기' })).toHaveAttribute('href', '/category')
    expect(screen.queryByRole('link', { name: '상품 둘러보기' })).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'AI 영상' })).toHaveAttribute('href', '/category?category=ai-video-shortform')
    expect(screen.getByRole('link', { name: 'AI 영상' })).toHaveClass('home-minimal-category-card--video')
    expect(screen.getByRole('link', { name: 'AI 이미지' })).toHaveAttribute('href', '/category?category=ai-image-character')
    expect(screen.getByRole('link', { name: 'AI 이미지' })).toHaveClass('home-minimal-category-card--image')
    expect(screen.getByRole('link', { name: 'AI 개발' })).toHaveAttribute('href', '/category?category=ai-development-automation')
    expect(screen.getByRole('link', { name: 'AI 개발' })).toHaveClass('home-minimal-category-card--development')
    expect(screen.queryByText('숏폼, 광고, 유튜브 콘텐츠 제작.')).not.toBeInTheDocument()
    expect(screen.queryByText('캐릭터, 프로필, 브랜드 이미지 제작.')).not.toBeInTheDocument()
    expect(screen.queryByText('챗봇, API 연동, 업무 자동화 구축.')).not.toBeInTheDocument()

    expect(screen.queryByText('상품 탐색')).not.toBeInTheDocument()
    expect(screen.queryByText('주문 전에 단계가 보입니다')).not.toBeInTheDocument()

    expect(screen.queryByText('Curated')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AI 상품' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '전체 상품 보기' })).toHaveAttribute('href', '/category')
    await waitFor(() => expect(screen.getAllByRole('link', { name: /의뢰하기/ })).toHaveLength(4))

    expect(screen.getByRole('heading', { name: 'How it Works' })).toBeInTheDocument()
    expect(screen.getByText('샘플 확인')).toBeInTheDocument()
    expect(screen.getByText('요구사항 작성')).toBeInTheDocument()
    expect(screen.getByText('제안서 확인')).toBeInTheDocument()
    expect(screen.getByText('작업 진행 확인')).toBeInTheDocument()
    expect(screen.getByText('작업물 수령')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'AI를 쓸 줄 안다면? 작업자로 활동해보세요!' })).toBeInTheDocument()
    expect(screen.getByText('당신의 능력을 필요로 합니다!')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '첫 상품 등록하기' })).toHaveAttribute('href', '/products/new')
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
    expect(screen.getByText('88,000원~')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /의뢰하기/ })).toHaveAttribute(
      'href',
      '/request/home-product-real-01',
    )
  })

  it('opens the product detail when a home AI product card is clicked', async () => {
    const product = mockExpertProducts[0]
    vi.mocked(getExpertProducts).mockResolvedValue([product])

    render(
      <MemoryRouter initialEntries={['/']}>
        <Home />
        <CurrentPath />
      </MemoryRouter>,
    )

    const productCard = await screen.findByRole('link', { name: `${product.title} 상품 정보 보기` })
    fireEvent.click(productCard)

    expect(screen.getByTestId('current-path')).toHaveTextContent(`/expert/${product.id}`)
  })

  it('sends the hero search keyword to the category page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Home />
        <CurrentPath />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('상품 검색'), { target: { value: 'AI 숏폼' } })
    fireEvent.click(screen.getByRole('button', { name: '검색' }))

    expect(screen.getByTestId('current-path')).toHaveTextContent('/category?q=AI%20%EC%88%8F%ED%8F%BC')
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
