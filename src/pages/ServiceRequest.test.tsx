import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ServiceRequest from './ServiceRequest'
import { mockExpertProducts } from '../data/mockData'
import { getExpertProducts, getRequestById, saveRequest, updateRequest } from '../lib/storage'
import type { ExpertProduct, ServiceRequestData } from '../types'

const supabaseProduct: ExpertProduct = {
    ...mockExpertProducts[0],
    id: 'product-supabase-01',
    expertId: 'expert-supabase-01',
    title: 'Supabase AI product',
    startingPrice: 45000,
    packages: {
        ...mockExpertProducts[0].packages,
        standard: {
            ...mockExpertProducts[0].packages.standard,
            price: 45000,
            deliveryDays: 5,
        },
    },
}

let mockUser: { id: string; email: string } | null = {
    id: 'client-real-01',
    email: 'client@example.com',
}

vi.mock('../lib/storage', () => ({
    saveRequest: vi.fn().mockResolvedValue(undefined),
    updateRequest: vi.fn().mockResolvedValue(undefined),
    getRequestById: vi.fn().mockResolvedValue(null),
    getCachedExpertProducts: vi.fn(() => mockExpertProducts),
    getExpertProducts: vi.fn(async () => mockExpertProducts),
}))

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: mockUser,
    }),
}))

function LocationProbe() {
    const location = useLocation()
    return <p data-testid="location">{location.pathname}{location.search}</p>
}

describe('ServiceRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUser = { id: 'client-real-01', email: 'client@example.com' }
        vi.mocked(getExpertProducts).mockResolvedValue(mockExpertProducts)
        vi.mocked(getRequestById).mockResolvedValue(null)
        vi.spyOn(window, 'alert').mockImplementation(() => {})
    })

    it('shows selected package summary and requirement-focused fields without contact input', () => {
        const product = mockExpertProducts[0]

        render(
            <MemoryRouter initialEntries={[`/request/${product.id}`]}>
                <Routes>
                    <Route path="/request/:productId" element={<ServiceRequest />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(screen.getByRole('heading', { name: '요구사항 작성' })).toBeInTheDocument()
        expect(screen.getByText('선택한 패키지')).toBeInTheDocument()
        expect(screen.getByText(product.title)).toBeInTheDocument()
        expect(screen.getByText('Standard')).toBeInTheDocument()
        expect(screen.getByText('30,000원')).toBeInTheDocument()
        expect(screen.getByLabelText('원하는 결과물')).toBeInTheDocument()
        expect(screen.getByLabelText('작업 목적')).toBeInTheDocument()
        expect(screen.getByLabelText('참고자료')).toBeInTheDocument()
        expect(screen.getByLabelText('마감 희망일')).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: '단일 진행' })).toBeChecked()
        expect(screen.getByRole('radio', { name: '단계별 진행' })).toBeInTheDocument()
        expect(screen.queryByLabelText(/이메일|연락처|주문자/)).not.toBeInTheDocument()
        expect(screen.getByText('플랫폼 외부 연락처를 주고받지 말고, 진행 안내는 기그온 안에서 확인합니다.')).toBeInTheDocument()
    })

    it('submits product requirements to the selected expert without opening the request board', async () => {
        const product = mockExpertProducts[0]

        render(
            <MemoryRouter initialEntries={[`/request/${product.id}`]}>
                <Routes>
                    <Route path="/request/:productId" element={<ServiceRequest />} />
                    <Route path="/my-work" element={<><h1>거래관리</h1><LocationProbe /></>} />
                </Routes>
            </MemoryRouter>,
        )

        fireEvent.change(screen.getByLabelText('원하는 결과물'), {
            target: { value: '15초 숏폼 영상 1차 시안' },
        })
        fireEvent.change(screen.getByLabelText('작업 목적'), {
            target: { value: '신제품 SNS 홍보' },
        })
        fireEvent.change(screen.getByLabelText('참고자료'), {
            target: { value: 'https://example.com/reference' },
        })
        fireEvent.change(screen.getByLabelText('마감 희망일'), {
            target: { value: '2026-06-01' },
        })
        fireEvent.click(screen.getByRole('radio', { name: '단계별 진행' }))
        fireEvent.click(screen.getByRole('button', { name: '요구사항 제출하기' }))

        await waitFor(() => expect(saveRequest).toHaveBeenCalledTimes(1))
        expect(saveRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                productId: product.id,
                expertId: product.expertId,
                selectedPackage: 'standard',
                desiredResult: '15초 숏폼 영상 1차 시안',
                purpose: '신제품 SNS 홍보',
                referenceText: 'https://example.com/reference',
                progressType: 'milestone',
                status: 'pending',
            }),
            mockUser?.id,
        )
        expect(window.alert).toHaveBeenCalledWith('요구사항이 상품 등록 전문가에게 전달되었습니다. 제안서를 기다려주세요.')
        const savedRequest = vi.mocked(saveRequest).mock.calls[0][0] as ServiceRequestData
        expect(await screen.findByRole('heading', { name: '거래관리' })).toBeInTheDocument()
        expect(screen.getByTestId('location')).toHaveTextContent(`/my-work?panel=client&clientOrder=${savedRequest.id}`)
    })

    it('loads and updates an existing product request from my page', async () => {
        const product = mockExpertProducts[0]
        const existingRequest: ServiceRequestData = {
            id: 'request-edit-01',
            title: product.title,
            description: '기존 작업 목적',
            budget: '30000',
            deadline: '2026-06-10',
            categories: ['AI 영상/숏폼'],
            createdAt: '2026-06-01T12:00:00.000Z',
            ordererEmail: '',
            status: 'pending',
            productId: product.id,
            expertId: product.expertId,
            selectedPackage: 'standard',
            desiredResult: '기존 결과물',
            purpose: '기존 작업 목적',
            referenceText: 'https://example.com/old',
            referenceLinks: ['https://example.com/old'],
            progressType: 'single',
        }
        vi.mocked(getRequestById).mockResolvedValue(existingRequest)

        render(
            <MemoryRouter initialEntries={[`/request/${product.id}?requestId=${existingRequest.id}`]}>
                <Routes>
                    <Route path="/request/:productId" element={<ServiceRequest />} />
                    <Route path="/mypage" element={<h1>마이페이지</h1>} />
                    <Route path="/my-work" element={<h1>거래관리</h1>} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByDisplayValue('기존 결과물')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '의뢰서 수정' })).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('원하는 결과물'), {
            target: { value: '수정된 결과물' },
        })
        fireEvent.click(screen.getByRole('button', { name: '의뢰서 수정하기' }))

        await waitFor(() => expect(updateRequest).toHaveBeenCalledTimes(1))
        expect(updateRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                id: existingRequest.id,
                productId: product.id,
                desiredResult: '수정된 결과물',
                purpose: '기존 작업 목적',
            }),
            mockUser?.id,
        )
        expect(saveRequest).not.toHaveBeenCalled()
        expect(window.alert).toHaveBeenCalledWith('의뢰서를 수정했습니다. 전문가가 수정된 내용을 확인할 수 있습니다.')
    })

    it('shows a received request as read-only when the signed-in user is the expert', async () => {
        const product = mockExpertProducts[0]
        const existingRequest: ServiceRequestData = {
            id: 'request-readonly-01',
            title: product.title,
            description: '전문가가 확인할 의뢰 목적',
            budget: '30000',
            deadline: '2026-06-10',
            categories: ['AI 영상/숏폼'],
            createdAt: '2026-06-01T12:00:00.000Z',
            ordererEmail: '',
            clientId: 'client-real-01',
            expertId: 'expert-real-01',
            status: 'pending',
            productId: product.id,
            selectedPackage: 'standard',
            desiredResult: '전문가가 받은 의뢰서',
            purpose: '전문가가 확인할 의뢰 목적',
            referenceText: 'https://example.com/readonly',
            referenceLinks: ['https://example.com/readonly'],
            progressType: 'single',
        }
        mockUser = { id: 'expert-real-01', email: 'expert@example.com' }
        vi.mocked(getRequestById).mockResolvedValue(existingRequest)

        render(
            <MemoryRouter initialEntries={[`/request/${product.id}?requestId=${existingRequest.id}`]}>
                <Routes>
                    <Route path="/request/:productId" element={<ServiceRequest />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '받은 의뢰서 확인' })).toBeInTheDocument()
        expect(screen.getByText('전문가가 받은 의뢰서')).toBeInTheDocument()
        expect(screen.getByText('전문가가 확인할 의뢰 목적')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /수정/ })).not.toBeInTheDocument()
        expect(screen.queryByLabelText('원하는 결과물')).not.toBeInTheDocument()
    })

    it('requires login before saving requirements to Supabase', async () => {
        mockUser = null
        const product = mockExpertProducts[0]

        const { container } = render(
            <MemoryRouter initialEntries={[`/request/${product.id}`]}>
                <Routes>
                    <Route path="/request/:productId" element={<ServiceRequest />} />
                </Routes>
            </MemoryRouter>,
        )

        fireEvent.change(container.querySelector('#desired-result') as HTMLTextAreaElement, {
            target: { value: 'QA Test Request' },
        })
        fireEvent.change(container.querySelector('#purpose') as HTMLTextAreaElement, {
            target: { value: '다른 전문가 계정에서 보여야 합니다.' },
        })
        fireEvent.change(container.querySelector('#deadline') as HTMLInputElement, {
            target: { value: '2026-06-01' },
        })
        fireEvent.click(container.querySelector('button[type="submit"]') as HTMLButtonElement)

        expect(saveRequest).not.toHaveBeenCalled()
        expect(window.alert).toHaveBeenCalled()
    })

    it('blocks external contact details in requirement fields', async () => {
        const product = mockExpertProducts[0]

        render(
            <MemoryRouter initialEntries={[`/request/${product.id}`]}>
                <Routes>
                    <Route path="/request/:productId" element={<ServiceRequest />} />
                </Routes>
            </MemoryRouter>,
        )

        fireEvent.change(screen.getByLabelText('원하는 결과물'), {
            target: { value: '15초 숏폼 영상, 카카오톡 ai-maker로 연락 주세요' },
        })
        fireEvent.change(screen.getByLabelText('작업 목적'), {
            target: { value: '신제품 SNS 홍보' },
        })
        fireEvent.change(screen.getByLabelText('마감 희망일'), {
            target: { value: '2026-06-01' },
        })
        fireEvent.click(screen.getByRole('button', { name: '요구사항 제출하기' }))

        expect(saveRequest).not.toHaveBeenCalled()
        expect(window.alert).toHaveBeenCalledWith(
            '외부 연락처는 입력할 수 없습니다. 안전한 거래를 위해 플랫폼 안에서 소통해주세요.',
        )
    })

    it('loads selected package summary from stored expert products', async () => {
        vi.mocked(getExpertProducts).mockResolvedValue([supabaseProduct])

        render(
            <MemoryRouter initialEntries={[`/request/${supabaseProduct.id}`]}>
                <Routes>
                    <Route path="/request/:productId" element={<ServiceRequest />} />
                    <Route path="/requests" element={<h1>제안 대기</h1>} />
                    <Route path="/my-work" element={<h1>거래관리</h1>} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByText(supabaseProduct.title)).toBeInTheDocument()
        expect(screen.getByText('45,000원')).toBeInTheDocument()
        expect(screen.getByText('5일')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('원하는 결과물'), {
            target: { value: 'Supabase product request' },
        })
        fireEvent.change(screen.getByLabelText('작업 목적'), {
            target: { value: 'Real product flow QA' },
        })
        fireEvent.change(screen.getByLabelText('마감 희망일'), {
            target: { value: '2026-06-01' },
        })
        fireEvent.click(screen.getByRole('button', { name: '요구사항 제출하기' }))

        await waitFor(() =>
            expect(saveRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    productId: supabaseProduct.id,
                    budget: '45000',
                    selectedPackage: 'standard',
                }),
                mockUser?.id,
            ),
        )
    })

    it('shows a not found state instead of a generic request form for unknown product ids', async () => {
        vi.mocked(getExpertProducts).mockResolvedValue([supabaseProduct])

        render(
            <MemoryRouter initialEntries={['/request/unknown-product-id']}>
                <Routes>
                    <Route path="/request/:productId" element={<ServiceRequest />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '상품을 찾을 수 없습니다' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'AI 작업 찾기로 돌아가기' })).toHaveAttribute('href', '/category')
        expect(screen.queryByRole('button', { name: '요구사항 제출하기' })).not.toBeInTheDocument()
        expect(screen.queryByText('카테고리 선택')).not.toBeInTheDocument()
    })
})
