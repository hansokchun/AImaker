import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProposalCreate from './ProposalCreate'
import type { ExpertProduct, Proposal, ServiceRequestData } from '../types'

const request: ServiceRequestData = {
    id: 'request-product-directed-01',
    title: 'AI 숏폼 제작',
    description: '브랜드 홍보 숏폼이 필요합니다.',
    budget: '50000',
    deadline: '2026-06-20',
    categories: ['AI 영상/숏폼'],
    createdAt: '2026-06-01T00:00:00.000Z',
    clientId: 'client-real-01',
    expertId: 'user-demo-01',
    productId: 'product-owned-01',
    selectedPackage: 'standard',
    desiredResult: '브랜드 홍보 숏폼',
    purpose: 'SNS 홍보',
    referenceText: '',
    referenceLinks: [],
    progressType: 'single',
    status: 'pending',
}

const product: ExpertProduct = {
    id: 'product-owned-01',
    expertId: 'user-demo-01',
    expertName: 'Demo expert',
    title: 'Owned AI product',
    category: 'ai-video-shortform',
    summary: 'Owned summary',
    description: 'Owned description',
    aiTools: ['Runway'],
    sampleLinks: [],
    sampleImageUrl: '',
    startingPrice: 50000,
    deliveryDays: 3,
    revisionCount: 1,
    packages: {
        standard: {
            name: 'Standard',
            price: 50000,
            deliveryDays: 3,
            revisionCount: 1,
            included: ['15초 영상 1편'],
        },
        deluxe: null,
        premium: null,
    },
    status: 'published',
}

const getRequestById = vi.fn(async (_requestId: string) => request)
const getExpertProducts = vi.fn(async () => [product])
const getProposal = vi.fn(async (_proposalId: string) => ({
    id: 'proposal-created-01',
    requestId: request.id,
    clientId: request.clientId,
    expertId: request.expertId,
    title: '기존 제안서',
    scope: '기존 작업 범위',
    deliverables: ['기존 제출물'],
    totalPrice: 40000,
    deliveryDays: 2,
    revisionCount: 1,
    progressType: 'single' as const,
    milestones: [],
    commercialUseAllowed: true,
    sourceFileIncluded: false,
    status: 'sent' as const,
    paymentStatus: 'unpaid' as const,
    expiresAt: '2999-01-01T00:00:00.000Z',
}))
const saveProposal = vi.fn(async (_proposal: Proposal) => 'proposal-created-01')
const updateProposal = vi.fn(async (_proposal: Proposal) => undefined)

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-demo-01', email: 'expert@example.com' },
        loading: false,
    }),
}))

vi.mock('../lib/storage', () => ({
    getRequestById: (requestId: string) => getRequestById(requestId),
    getExpertProducts: () => getExpertProducts(),
    getProposal: (proposalId: string) => getProposal(proposalId),
    saveProposal: (proposal: Proposal) => saveProposal(proposal),
    updateProposal: (proposal: Proposal) => updateProposal(proposal),
}))

function LocationProbe() {
    const location = useLocation()
    return <span data-testid="location">{location.pathname}{location.search}</span>
}

describe('ProposalCreate', () => {
    beforeEach(() => {
        getRequestById.mockClear()
        getExpertProducts.mockClear()
        getProposal.mockClear()
        saveProposal.mockClear()
        updateProposal.mockClear()
        getRequestById.mockResolvedValue(request)
        getExpertProducts.mockResolvedValue([product])
        getProposal.mockResolvedValue({
            id: 'proposal-created-01',
            requestId: request.id,
            clientId: request.clientId,
            expertId: request.expertId,
            title: '기존 제안서',
            scope: '기존 작업 범위',
            deliverables: ['기존 제출물'],
            totalPrice: 40000,
            deliveryDays: 2,
            revisionCount: 1,
            progressType: 'single',
            milestones: [],
            commercialUseAllowed: true,
            sourceFileIncluded: false,
            status: 'sent',
            paymentStatus: 'unpaid',
            expiresAt: '2999-01-01T00:00:00.000Z',
        })
        saveProposal.mockResolvedValue('proposal-created-01')
        updateProposal.mockResolvedValue(undefined)
    })

    it('prefills a product-directed request and saves the written proposal', async () => {
        render(
            <MemoryRouter initialEntries={['/proposals/new?requestId=request-product-directed-01']}>
                <Routes>
                    <Route path="/proposals/new" element={<><ProposalCreate /><LocationProbe /></>} />
                    <Route path="/proposal/:proposalId" element={<LocationProbe />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '제안서 작성' })).toBeInTheDocument()
        expect(screen.getByDisplayValue('브랜드 홍보 숏폼 제안서')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('작업 범위'), { target: { value: 'AI 영상 콘셉트와 1차 편집본을 제작합니다.' } })
        fireEvent.click(screen.getByRole('button', { name: '제안서 보내기' }))

        await waitFor(() =>
            expect(saveProposal).toHaveBeenCalledWith(expect.objectContaining({
                requestId: 'request-product-directed-01',
                clientId: 'client-real-01',
                expertId: 'user-demo-01',
                title: '브랜드 홍보 숏폼 제안서',
                totalPrice: 50000,
                deliveryDays: 3,
                revisionCount: 1,
                paymentStatus: 'unpaid',
                status: 'sent',
            })),
        )
        await waitFor(() => {
            expect(screen.getAllByTestId('location').some((item) => item.textContent?.includes('/proposal/proposal-created-01'))).toBe(true)
        })
    })

    it('loads an existing proposal and updates it as a revised proposal', async () => {
        render(
            <MemoryRouter initialEntries={['/proposals/new?proposalId=proposal-created-01']}>
                <Routes>
                    <Route path="/proposals/new" element={<><ProposalCreate /><LocationProbe /></>} />
                    <Route path="/proposal/:proposalId" element={<LocationProbe />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '제안서 수정' })).toBeInTheDocument()
        expect(screen.getByText('처음 제안서를 작성할 때와 같은 양식으로 수정합니다. 저장하면 의뢰자에게 수정 알림이 전달됩니다.')).toBeInTheDocument()
        expect(screen.getByDisplayValue('기존 제안서')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('작업 범위'), { target: { value: '수정된 작업 범위입니다.' } })
        fireEvent.click(screen.getByRole('button', { name: '수정해서 보내기' }))

        await waitFor(() =>
            expect(updateProposal).toHaveBeenCalledWith(expect.objectContaining({
                id: 'proposal-created-01',
                requestId: 'request-product-directed-01',
                scope: '수정된 작업 범위입니다.',
                status: 'revision_requested',
                paymentStatus: 'unpaid',
            })),
        )
        expect(saveProposal).not.toHaveBeenCalled()
        await waitFor(() => {
            expect(screen.getAllByTestId('location').some((item) => item.textContent?.includes('/proposal/proposal-created-01'))).toBe(true)
        })
    })
})
