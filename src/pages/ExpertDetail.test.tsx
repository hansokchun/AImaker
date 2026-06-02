import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ExpertDetail from './ExpertDetail'
import { mockExpertProducts } from '../data/mockData'
import type { ExpertProduct } from '../types'

const supabaseProduct: ExpertProduct = {
    ...mockExpertProducts[0],
    id: 'product-from-supabase-01',
    title: 'Supabase AI 상품',
    description: '실제 DB 상품 상세 설명입니다.',
    summary: '실제 DB 상품 요약입니다.',
}

const getExpertProducts = vi.fn(async () => [supabaseProduct])
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
        expect(screen.getByRole('link', { name: '패키지로 의뢰하기' })).toHaveAttribute(
            'href',
            `/request/${supabaseProduct.id}`,
        )
    })

    it('loads the expert public page through the expert id from product cards', async () => {
        render(
            <MemoryRouter initialEntries={[`/expert/${supabaseProduct.expertId}`]}>
                <Routes>
                    <Route path="/expert/:id" element={<ExpertDetail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: supabaseProduct.title })).toBeInTheDocument()
        expect(screen.getByText(supabaseProduct.expertName)).toBeInTheDocument()
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

    it('creates a price estimate consultation and opens the selected chat in my work', async () => {
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

        fireEvent.click(screen.getByRole('button', { name: '가격측정 문의하기' }))

        await waitFor(() => expect(createConsultation).toHaveBeenCalledWith({
            clientId: 'client-real-01',
            expertId: supabaseProduct.expertId,
            productId: supabaseProduct.id,
            title: `${supabaseProduct.title} 상담`,
            initialMessage: `${supabaseProduct.title} 작업 범위와 예상 가격을 상담하고 싶습니다.`,
        }))
        await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/my-work?panel=consultations&consultation=consultation-created-01'))
    })
})
