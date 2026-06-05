import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
}

const expertReviews: Review[] = [
    {
        id: 'review-public-01',
        workId: 'work-public-01',
        clientId: 'client-review-01',
        expertId: supabaseProduct.expertId,
        rating: 5,
        content: '결과물이 깔끔하고 소통이 빨랐습니다.',
        createdAt: '2026-06-01T10:00:00.000Z',
    },
    {
        id: 'review-public-02',
        workId: 'work-public-02',
        clientId: 'client-review-02',
        expertId: supabaseProduct.expertId,
        rating: 4,
        content: '요구사항 반영이 좋았습니다.',
        createdAt: '2026-06-02T10:00:00.000Z',
    },
]

const getExpertProducts = vi.fn(async () => [supabaseProduct])
const getUserDisplayProfile = vi.fn(async () => ({
    name: '검증된 AI 전문가',
    imageUrl: 'https://example.com/avatar.jpg',
    isExpert: true,
}))
const getExpertReviews = vi.fn(async () => expertReviews)
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
    getExpertReviews: (expertId: string) => getExpertReviews(expertId),
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
        getExpertProducts.mockResolvedValue([supabaseProduct])
        getUserDisplayProfile.mockResolvedValue({
            name: '검증된 AI 전문가',
            imageUrl: 'https://example.com/avatar.jpg',
            isExpert: true,
        })
        getExpertReviews.mockResolvedValue(expertReviews)
        mockUser = { id: 'client-real-01', email: 'client@example.com' }
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
        expect(screen.getByText('검증된 AI 전문가')).toBeInTheDocument()
        expect(screen.getByText('평점 4.5 · 리뷰 2개')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '판매자 프로필 보기' })).toHaveAttribute(
            'href',
            `/expert/${supabaseProduct.expertId}`,
        )
        expect(screen.getByRole('link', { name: '패키지로 의뢰하기' })).toHaveAttribute(
            'href',
            `/request/${supabaseProduct.id}`,
        )
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
        expect(screen.getByText('평점 4.5 · 리뷰 2개')).toBeInTheDocument()
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
        expect(screen.queryByRole('link', { name: '패키지로 의뢰하기' })).not.toBeInTheDocument()
    })

    it('opens product details even when stored package data is missing', async () => {
        const productWithoutPackages = {
            ...supabaseProduct,
            id: 'product-without-packages',
            packages: undefined,
            sampleLinks: undefined,
            aiTools: undefined,
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
        expect(screen.getByRole('link', { name: '패키지로 의뢰하기' })).toHaveAttribute(
            'href',
            `/request/${productWithoutPackages.id}`,
        )
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
})
