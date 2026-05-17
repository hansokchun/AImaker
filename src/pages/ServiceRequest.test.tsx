import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ServiceRequest from './ServiceRequest'
import { mockExpertProducts } from '../data/mockData'
import { getExpertProducts, saveRequest } from '../lib/storage'
import type { ExpertProduct } from '../types'

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

vi.mock('../lib/storage', () => ({
    saveRequest: vi.fn().mockResolvedValue(undefined),
    getExpertProducts: vi.fn(async () => mockExpertProducts),
}))

describe('ServiceRequest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(getExpertProducts).mockResolvedValue(mockExpertProducts)
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
        expect(screen.getByText('플랫폼 외부 연락처를 주고받지 말고, 진행 안내는 AIConnect 안에서 확인합니다.')).toBeInTheDocument()
    })

    it('submits requirements and moves to the proposal waiting state', async () => {
        const product = mockExpertProducts[0]

        render(
            <MemoryRouter initialEntries={[`/request/${product.id}`]}>
                <Routes>
                    <Route path="/request/:productId" element={<ServiceRequest />} />
                    <Route path="/requests" element={<h1>제안 대기</h1>} />
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
                selectedPackage: 'standard',
                desiredResult: '15초 숏폼 영상 1차 시안',
                purpose: '신제품 SNS 홍보',
                referenceText: 'https://example.com/reference',
                progressType: 'milestone',
                status: 'pending',
            }),
            undefined,
        )
        expect(await screen.findByRole('heading', { name: '제안 대기' })).toBeInTheDocument()
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
                undefined,
            ),
        )
    })
})
