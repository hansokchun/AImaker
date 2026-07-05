import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExpertDetail from './ExpertDetail'
import { mockExpertProducts } from '../data/mockData'
import type { ExpertProduct, Review } from '../types'

const supabaseProduct: ExpertProduct = {
    ...mockExpertProducts[0],
    id: 'product-from-supabase-01',
    title: 'Supabase AI 상품',
    description: '실제 DB 상품 상세 설명입니다.',
    summary: '실제 DB 상품 요약입니다.',
    createdAt: '2026-06-10T10:00:00.000Z',
    taxInvoiceAvailable: true,
}

const sellerPortfolioProduct: ExpertProduct = {
    ...mockExpertProducts[1],
    id: 'seller-portfolio-product-01',
    expertId: supabaseProduct.expertId,
    expertName: supabaseProduct.expertName,
    title: '판매자의 다른 AI 영상 상품',
    category: supabaseProduct.category,
}

const sellerPortfolioProductSecond: ExpertProduct = {
    ...mockExpertProducts[2],
    id: 'seller-portfolio-product-02',
    expertId: supabaseProduct.expertId,
    expertName: supabaseProduct.expertName,
    title: '판매자의 자동화 AI 상품',
    category: supabaseProduct.category,
}

const similarProduct: ExpertProduct = {
    ...mockExpertProducts[2],
    id: 'similar-product-01',
    expertId: 'expert-other-01',
    expertName: '다른 전문가',
    title: '비슷한 AI 숏폼 상품',
    category: supabaseProduct.category,
}

const expertReviews: Review[] = [
    {
        id: 'review-public-01',
        workId: 'work-public-01',
        clientId: 'client-review-01',
        clientName: '김민지',
        clientImageUrl: 'https://example.com/client-minji.jpg',
        expertId: supabaseProduct.expertId,
        rating: 5,
        content: '결과물이 깔끔하고 소통이 빨랐습니다.',
        createdAt: '2026-06-01T10:00:00.000Z',
        createdAtLabel: '3일 전',
        priceRangeLabel: '3만 원대',
        workDurationDays: 2,
    },
    {
        id: 'review-public-02',
        workId: 'work-public-02',
        clientId: 'client-review-02',
        clientName: '박서준',
        expertId: supabaseProduct.expertId,
        rating: 4,
        content: '요구사항 반영이 좋았습니다.',
        createdAt: '2026-06-02T10:00:00.000Z',
        priceRangeLabel: '7만 원대',
        workDurationDays: 4,
    },
    {
        id: 'review-public-03',
        workId: 'work-public-03',
        clientId: 'client-review-03',
        clientName: '이하린',
        expertId: supabaseProduct.expertId,
        rating: 5,
        content: '짧은 일정에도 결과물이 안정적이었습니다.',
        createdAt: '2026-06-03T10:00:00.000Z',
        priceRangeLabel: '3만 원대',
        workDurationDays: 2,
    },
]

const getExpertProducts = vi.fn(async () => [supabaseProduct])
const getUserDisplayProfile = vi.fn(async () => ({
    name: '검증된 AI 전문가',
    imageUrl: 'https://example.com/avatar.jpg',
    isExpert: true,
}))
const getStoredProfile = vi.fn(async () => ({
    imageUrl: 'https://example.com/avatar.jpg',
    profession: 'AI video',
    name: '검증된 AI 전문가',
    oneLiner: '브랜드 영상의 기획과 제작 흐름을 함께 설계합니다.',
    greeting: 'AI 영상 제작을 처음 의뢰하는 분도 이해하기 쉽게 진행 과정을 안내합니다.',
    activities: ['브랜드 숏폼 캠페인 30건 제작', 'AI 영상 워크플로우 컨설팅'],
    awards: ['2026 AI 영상 공모전 우수상'],
    aiTools: ['Runway'],
    editTools: ['Premiere Pro'],
    sampleLinks: [],
    contactAvailableTime: '평일 10:00-19:00',
    averageResponseTime: '보통 2시간 이내',
    packages: {
        standard: { price: '', description: '', workDays: '', revisions: '', features: [''] },
        deluxe: { price: '', description: '', workDays: '', revisions: '', features: [''] },
        premium: { price: '', description: '', workDays: '', revisions: '', features: [''] },
    },
}))
const getExpertReviews = vi.fn(async () => expertReviews)
const getUserFavoriteProductIds = vi.fn(async (_userId: string) => [] as string[])
const getFavoriteProductCount = vi.fn(async (_productId: string) => 0)
const toggleFavoriteProduct = vi.fn(async (_userId: string, productId: string) => [productId])
const createConsultation = vi.fn(async () => ({
    id: 'consultation-created-01',
    clientId: 'client-real-01',
    expertId: supabaseProduct.expertId,
    productId: supabaseProduct.id,
    status: 'open' as const,
    title: `${supabaseProduct.title} 상담`,
    lastMessageAt: '2026-06-02T10:00:00.000Z',
    createdAt: '2026-06-02T10:00:00.000Z',
}))

let mockUser: { id: string; email: string } | null = {
    id: 'client-real-01',
    email: 'client@example.com',
}

vi.mock('../lib/storage', () => ({
    getExpertProducts: () => getExpertProducts(),
    getUserDisplayProfile: (userId: string) => getUserDisplayProfile(userId),
    getStoredProfile: (userId: string) => getStoredProfile(userId),
    getExpertReviews: (expertId: string) => getExpertReviews(expertId),
    getUserFavoriteProductIds: (userId: string) => getUserFavoriteProductIds(userId),
    getFavoriteProductCount: (productId: string) => getFavoriteProductCount(productId),
    toggleFavoriteProduct: (userId: string, productId: string) => toggleFavoriteProduct(userId, productId),
    createConsultation: (input: unknown) => createConsultation(input),
}))

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({ user: mockUser }),
}))

function LocationProbe() {
    const location = useLocation()
    return <span data-testid="location">{`${location.pathname}${location.search}`}</span>
}

describe('ExpertDetail', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getExpertProducts.mockResolvedValue([supabaseProduct, sellerPortfolioProduct, sellerPortfolioProductSecond, similarProduct])
        getUserDisplayProfile.mockResolvedValue({
            name: '검증된 AI 전문가',
            imageUrl: 'https://example.com/avatar.jpg',
            isExpert: true,
        })
        getStoredProfile.mockResolvedValue({
            imageUrl: 'https://example.com/avatar.jpg',
            profession: 'AI video',
            name: '검증된 AI 전문가',
            oneLiner: '브랜드 영상의 기획과 제작 흐름을 함께 설계합니다.',
            greeting: 'AI 영상 제작을 처음 의뢰하는 분도 이해하기 쉽게 진행 과정을 안내합니다.',
            activities: ['브랜드 숏폼 캠페인 30건 제작', 'AI 영상 워크플로우 컨설팅'],
            awards: ['2026 AI 영상 공모전 우수상'],
            aiTools: ['Runway'],
            editTools: ['Premiere Pro'],
            sampleLinks: [],
            contactAvailableTime: '평일 10:00-19:00',
            averageResponseTime: '보통 2시간 이내',
            packages: {
                standard: { price: '', description: '', workDays: '', revisions: '', features: [''] },
                deluxe: { price: '', description: '', workDays: '', revisions: '', features: [''] },
                premium: { price: '', description: '', workDays: '', revisions: '', features: [''] },
            },
        })
        getExpertReviews.mockResolvedValue(expertReviews)
        getUserFavoriteProductIds.mockResolvedValue([])
        getFavoriteProductCount.mockResolvedValue(0)
        toggleFavoriteProduct.mockImplementation(async (_userId: string, productId: string) => [productId])
        mockUser = { id: 'client-real-01', email: 'client@example.com' }
    })

    it('hides favorite counts and shows launch metadata on the product detail page', async () => {
        getFavoriteProductCount.mockResolvedValue(3)

        render(
            <MemoryRouter initialEntries={[`/expert/${supabaseProduct.id}`]}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: supabaseProduct.title })).toBeInTheDocument()
        expect(screen.queryByText('3명 관심')).not.toBeInTheDocument()
        expect(screen.queryByText('0명 관심')).not.toBeInTheDocument()
        expect(screen.getByText('등록일 2026. 6. 10.')).toBeInTheDocument()
        expect(screen.getByLabelText('연락 가능 시간 평일 10:00-19:00')).toBeInTheDocument()
        expect(screen.getByText('세금계산서 발행 가능')).toBeInTheDocument()
        await waitFor(() => expect(getFavoriteProductCount).toHaveBeenCalledWith(supabaseProduct.id))
    })

    it('loads product details from the shared product storage', async () => {
        render(
            <MemoryRouter initialEntries={[`/expert/${supabaseProduct.id}`]}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: supabaseProduct.title })).toBeInTheDocument()
        expect(screen.getByText(supabaseProduct.description)).toBeInTheDocument()
        expect(screen.getByText(supabaseProduct.summary)).toBeInTheDocument()
        expect(getUserDisplayProfile).toHaveBeenCalledWith(supabaseProduct.expertId)
        expect(getExpertReviews).toHaveBeenCalledWith(supabaseProduct.expertId)
        expect(screen.getByRole('heading', { name: '판매자 정보' })).toBeInTheDocument()
        expect(screen.getAllByText('검증된 AI 전문가').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('평점 4.7 · 리뷰 3개').length).toBeGreaterThanOrEqual(1)
        expect(screen.getByRole('link', { name: '판매자 프로필 보기' })).toHaveAttribute(
            'href',
            `/expert/${supabaseProduct.expertId}`,
        )
        expect(screen.getByRole('button', { name: '상품 구매하기' })).toBeInTheDocument()
    })

    it('renders product details as one ordered content flow with a package sidebar', async () => {
        render(
            <MemoryRouter initialEntries={[`/expert/${supabaseProduct.id}`]}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: supabaseProduct.title })).toBeInTheDocument()

        const flow = screen.getByTestId('product-detail-flow')
        const sidebar = screen.getByTestId('product-package-sidebar')
        const header = screen.getByTestId('product-detail-header')
        const gallery = screen.getByTestId('product-detail-gallery')
        const description = screen.getByTestId('product-service-description')
        const portfolio = screen.getByTestId('product-portfolio')
        const pricing = screen.getByTestId('product-price-comparison')
        const seller = screen.getByTestId('product-detail-seller')
        const reviews = screen.getByTestId('product-detail-reviews')

        expect(flow).toContainElement(header)
        expect(flow).toContainElement(gallery)
        expect(flow).toContainElement(description)
        expect(flow).toContainElement(portfolio)
        expect(flow).toContainElement(pricing)
        expect(flow).toContainElement(seller)
        expect(flow).toContainElement(reviews)
        expect(sidebar.querySelector('.package-card')).toBeInTheDocument()
        expect(header.compareDocumentPosition(gallery) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(gallery.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(description.compareDocumentPosition(portfolio) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(portfolio.compareDocumentPosition(pricing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(pricing.compareDocumentPosition(seller) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(seller.compareDocumentPosition(reviews) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('shows marketplace breadcrumbs and package actions above the package tabs', async () => {
        render(
            <MemoryRouter initialEntries={[`/expert/${supabaseProduct.id}`]}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: supabaseProduct.title })).toBeInTheDocument()

        const breadcrumbs = screen.getByTestId('product-detail-breadcrumbs')
        expect(within(breadcrumbs).getByRole('link', { name: '홈' })).toHaveAttribute('href', '/')
        expect(within(breadcrumbs).getByRole('link', { name: 'AI 작업 찾기' })).toHaveAttribute('href', '/category')
        expect(within(breadcrumbs).getByRole('link', { name: 'AI 영상/숏폼' })).toHaveAttribute(
            'href',
            '/category?category=ai-video-shortform',
        )
        expect(within(breadcrumbs).getByRole('link', { name: supabaseProduct.title })).toHaveAttribute(
            'href',
            `/expert/${supabaseProduct.id}`,
        )
        expect(breadcrumbs.compareDocumentPosition(screen.getByRole('heading', { name: supabaseProduct.title })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(document.querySelector('.product-detail-hero .product-detail-category')).toBeNull()

        const sidebar = screen.getByTestId('product-package-sidebar')
        const actions = within(sidebar).getByTestId('product-package-actions')
        const tabs = sidebar.querySelector('.package-tabs')
        expect(actions.compareDocumentPosition(tabs as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(within(actions).getByRole('button', { name: '상품 공유' })).toBeInTheDocument()
        expect(within(actions).getByRole('button', { name: '더보기' })).toBeInTheDocument()
    })

    it('opens a public seller profile with products and received reviews through the expert id', async () => {
        render(
            <MemoryRouter initialEntries={[`/expert/${supabaseProduct.expertId}`]}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '검증된 AI 전문가' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '등록한 상품' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '받은 리뷰' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: supabaseProduct.title })).toHaveAttribute('href', `/expert/${supabaseProduct.id}`)
        expect(screen.getByText('AIConnect 전문가')).toBeInTheDocument()
        expect(screen.getByText('평점 4.7 · 리뷰 3개')).toBeInTheDocument()
        expect(screen.getByText('결과물이 깔끔하고 소통이 빨랐습니다.')).toBeInTheDocument()
    })

    it('shows a not found state without demo product content for unknown product ids', async () => {
        getExpertProducts.mockResolvedValue([supabaseProduct])

        render(
            <MemoryRouter initialEntries={['/expert/unknown-product-id']}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '상품을 찾을 수 없습니다' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'AI 작업 찾기로 돌아가기' })).toHaveAttribute('href', '/category')
        expect(screen.queryByText(supabaseProduct.title)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '상품 구매하기' })).not.toBeInTheDocument()
    })

    it('opens product details even when stored package data is missing', async () => {
        const productWithoutPackages = {
            ...supabaseProduct,
            id: 'product-without-packages',
            packages: undefined,
            sampleLinks: undefined,
        } as unknown as ExpertProduct
        getExpertProducts.mockResolvedValue([productWithoutPackages])

        render(
            <MemoryRouter initialEntries={[`/expert/${productWithoutPackages.id}`]}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: productWithoutPackages.title })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '상품 구매하기' })).toBeInTheDocument()
        expect(screen.queryByText('문제가 발생했습니다')).not.toBeInTheDocument()
    })

    it('creates a consultation from expert inquiry and opens the selected chat in my work', async () => {
        render(
            <MemoryRouter initialEntries={[`/expert/${supabaseProduct.id}`]}>
                <Routes>
                    <Route
                        path="/expert/:id"
                        element={
                            <>
                                <ExpertDetail />
                                <LocationProbe />
                            </>
                        }
                    />
                    <Route path="/my-work" element={<LocationProbe />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: supabaseProduct.title })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '전문가에게 문의하기' }))

        await waitFor(() => expect(createConsultation).toHaveBeenCalledWith({
            clientId: 'client-real-01',
            expertId: supabaseProduct.expertId,
            productId: supabaseProduct.id,
            title: `${supabaseProduct.title} 상담`,
            initialMessage: `${supabaseProduct.title} 작업 범위를 상담하고 싶습니다.`,
        }))
        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/my-work?panel=consultations&consultation=consultation-created-01'))
    })

    it('shows product editing for the product owner instead of profile editing', async () => {
        mockUser = { id: supabaseProduct.expertId, email: 'expert@example.com' }

        render(
            <MemoryRouter initialEntries={[`/expert/${supabaseProduct.id}`]}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: supabaseProduct.title })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '상품 수정하기' })).toHaveAttribute(
            'href',
            `/products/${supabaseProduct.id}/edit`,
        )
        expect(screen.queryByRole('button', { name: '프로필 수정하기' })).not.toBeInTheDocument()
    })

    it('shows a Fiverr-style service description, portfolio, and price comparison flow', async () => {
        render(
            <MemoryRouter initialEntries={[`/expert/${supabaseProduct.id}`]}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: supabaseProduct.title })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '서비스 설명' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '포트폴리오' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '가격 비교' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: '사용 AI 도구' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '샘플 링크 보기' })).not.toBeInTheDocument()
    })

    it('shows detailed seller profile, seller portfolio products, review context, and similar recommendations', async () => {
        render(
            <MemoryRouter initialEntries={[`/expert/${supabaseProduct.id}`]}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: supabaseProduct.title })).toBeInTheDocument()

        const sellerDetail = screen.getByTestId('product-detail-seller')
        expect(within(sellerDetail).getByRole('heading', { name: '판매자 정보' })).toBeInTheDocument()
        expect(within(sellerDetail).getByRole('button', { name: '판매자에게 문의하기' })).toBeInTheDocument()

        const sellerSummary = screen.getByTestId('seller-info-summary')
        expect(within(sellerSummary).queryByLabelText('연락 가능 시간 평일 10:00-19:00')).not.toBeInTheDocument()
        expect(within(sellerSummary).queryByLabelText('평균 응답 시간 보통 2시간 이내')).not.toBeInTheDocument()
        expect(within(sellerSummary).queryByLabelText('등록 상품 3개')).not.toBeInTheDocument()
        expect(within(sellerSummary).queryByLabelText('받은 리뷰 3개')).not.toBeInTheDocument()

        const sellerIntro = screen.getByTestId('seller-profile-overview')
        expect(within(sellerIntro).getByLabelText('연락 가능 시간 평일 10:00-19:00')).toBeInTheDocument()
        expect(within(sellerIntro).getByLabelText('평균 응답 시간 보통 2시간 이내')).toBeInTheDocument()
        expect(within(sellerIntro).getByLabelText('등록 상품 3개')).toBeInTheDocument()
        expect(within(sellerIntro).getByLabelText('받은 리뷰 3개')).toBeInTheDocument()
        expect(within(sellerDetail).getByText('브랜드 영상의 기획과 제작 흐름을 함께 설계합니다.')).toBeInTheDocument()
        expect(within(sellerDetail).getByText('AI 영상 제작을 처음 의뢰하는 분도 이해하기 쉽게 진행 과정을 안내합니다.')).toBeInTheDocument()
        expect(within(sellerDetail).queryByText('Runway')).not.toBeInTheDocument()
        expect(within(sellerDetail).queryByText('Premiere Pro')).not.toBeInTheDocument()
        expect(within(sellerDetail).getByText('브랜드 숏폼 캠페인 30건 제작')).toBeInTheDocument()
        expect(within(sellerDetail).getByText('2026 AI 영상 공모전 우수상')).toBeInTheDocument()

        const sellerPortfolio = screen.getByTestId('seller-portfolio-products')
        expect(within(sellerPortfolio).getByRole('heading', { name: '마이 포트폴리오' })).toBeInTheDocument()
        expect(within(sellerPortfolio).getByRole('link', { name: sellerPortfolioProduct.title })).toHaveAttribute('href', `/expert/${sellerPortfolioProduct.id}`)
        expect(within(sellerPortfolio).queryByRole('link', { name: supabaseProduct.title })).not.toBeInTheDocument()

        const reviews = screen.getByTestId('product-detail-reviews')
        const reviewCard = within(reviews).getByLabelText('김민지 의뢰자의 리뷰')
        expect(within(reviewCard).getByRole('img', { name: '김민지 프로필' })).toHaveAttribute('src', 'https://example.com/client-minji.jpg')
        expect(within(reviewCard).getByText('김민지')).toBeInTheDocument()
        expect(within(reviewCard).getByLabelText('별점 5.0 · 3일 전')).toBeInTheDocument()
        expect(within(reviewCard).getByText('3일 전')).toBeInTheDocument()
        expect(within(reviewCard).getByText('결과물이 깔끔하고 소통이 빨랐습니다.')).toBeInTheDocument()
        expect(within(reviewCard).queryByText(/이용 상품/)).not.toBeInTheDocument()
        expect(within(reviewCard).queryByText(/가격대/)).not.toBeInTheDocument()
        expect(within(reviewCard).getByText('3만 원대')).toBeInTheDocument()
        expect(within(reviewCard).getByText('가격')).toBeInTheDocument()
        expect(within(reviewCard).getByText('2일')).toBeInTheDocument()
        expect(within(reviewCard).getByText('작업 기간')).toBeInTheDocument()
        expect(within(reviews).queryByText(/client-review-01/)).not.toBeInTheDocument()

        const similar = screen.getByTestId('similar-product-recommendations')
        expect(within(similar).getByRole('heading', { name: '이 서비스를 본 사람들이 함께 본 AI 상품' })).toBeInTheDocument()
        expect(within(similar).getByRole('link', { name: similarProduct.title })).toHaveAttribute('href', `/expert/${similarProduct.id}`)
        expect(within(similar).queryByRole('link', { name: supabaseProduct.title })).not.toBeInTheDocument()
    })

    it('shows one uncropped gallery image at a time and slides through multiple images', async () => {
        render(
            <MemoryRouter initialEntries={[`/expert/${supabaseProduct.id}`]}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: supabaseProduct.title })).toBeInTheDocument()

        const imageSection = screen.getByTestId('product-detail-gallery')
        expect(within(imageSection).getByText('1 / 2')).toBeInTheDocument()
        expect(within(imageSection).getByRole('img')).toHaveAttribute(`src`, supabaseProduct.sampleImageUrl)

        fireEvent.click(within(imageSection).getByRole('button', { name: '다음 미디어' }))

        expect(within(imageSection).getByText('2 / 2')).toBeInTheDocument()
        expect(within(imageSection).getByRole('img')).toHaveAttribute(`src`, supabaseProduct.sampleLinks[0])
        expect(within(imageSection).queryByText('메인 이미지')).not.toBeInTheDocument()
        expect(within(imageSection).queryByText('상세 이미지 1')).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: '상세 이미지' })).not.toBeInTheDocument()
    })

    it('renders videos in the media gallery without a detail image heading', async () => {
        getExpertProducts.mockResolvedValue([
            {
                ...supabaseProduct,
                sampleLinks: ['https://cdn.example.com/demo-video.mp4'],
            },
        ])

        render(
            <MemoryRouter initialEntries={[`/expert/${supabaseProduct.id}`]}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: supabaseProduct.title })).toBeInTheDocument()
        const gallery = screen.getByTestId('product-detail-gallery')

        fireEvent.click(within(gallery).getByRole('button', { name: '다음 미디어' }))

        expect(within(gallery).getByTestId('product-gallery-video')).toHaveAttribute('src', 'https://cdn.example.com/demo-video.mp4')
        expect(screen.queryByRole('heading', { name: '상세 이미지' })).not.toBeInTheDocument()
    })
})
