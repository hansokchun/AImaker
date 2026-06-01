import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyPage from './MyPage'
import type { Proposal, Review, ServiceRequestData } from '../types'

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        session: { user: { id: 'user-demo-01', email: 'demo@example.com' } },
        user: { id: 'user-demo-01', email: 'demo@example.com' },
        loading: false,
        signOut: vi.fn(),
    }),
}))

vi.mock('../lib/supabase', () => ({
    supabase: null,
}))

const saveReview = vi.fn(async (_review: Review) => undefined)
const saveProposal = vi.fn(async (_proposal: Proposal) => 'proposal-product-directed-created')
const getUserReviews = vi.fn(async (_userId: string): Promise<Review[]> => [])
const getUserServiceRequests = vi.fn(async (_userId: string): Promise<ServiceRequestData[]> => [
    {
        id: 'request-product-directed-01',
        title: 'Owned AI product',
        description: '상품 지정 의뢰 상세',
        budget: '30000',
        deadline: '2026-06-01',
        categories: ['AI 영상/숏폼'],
        createdAt: '2026. 6. 1.',
        clientId: 'client-real-01',
        expertId: 'user-demo-01',
        productId: 'product-owned-01',
        selectedPackage: 'standard',
        desiredResult: '상품 지정 요구사항',
        purpose: 'SNS 홍보',
        referenceText: '',
        referenceLinks: [],
        progressType: 'single',
        status: 'pending',
    },
])
const getExpertProducts = vi.fn(async () => [
    {
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
        startingPrice: 30000,
        deliveryDays: 2,
        revisionCount: 1,
        packages: {
            standard: {
                name: 'Standard',
                price: 30000,
                deliveryDays: 2,
                revisionCount: 1,
                included: ['Draft'],
            },
            deluxe: null,
            premium: null,
        },
        status: 'published',
    },
    {
        id: 'product-client-01',
        expertId: 'expert-real-01',
        expertName: 'Client order expert',
        title: 'AI 숏폼 영상 제작',
        category: 'ai-video-shortform',
        summary: 'Client order summary',
        description: 'Client order description',
        aiTools: ['Runway'],
        sampleLinks: [],
        sampleImageUrl: '',
        startingPrice: 30000,
        deliveryDays: 2,
        revisionCount: 1,
        packages: {
            standard: {
                name: 'Standard',
                price: 30000,
                deliveryDays: 2,
                revisionCount: 1,
                included: ['Draft'],
            },
            deluxe: null,
            premium: null,
        },
        status: 'published',
    },
    {
        id: 'product-client-before',
        expertId: 'expert-real-before',
        expertName: 'Before expert',
        title: '작업 전 테스트 상품',
        category: 'ai-video-shortform',
        summary: 'Before summary',
        description: 'Before description',
        aiTools: ['Runway'],
        sampleLinks: [],
        sampleImageUrl: '',
        startingPrice: 40000,
        deliveryDays: 3,
        revisionCount: 1,
        packages: {
            standard: {
                name: 'Standard',
                price: 40000,
                deliveryDays: 3,
                revisionCount: 1,
                included: ['Draft'],
            },
            deluxe: null,
            premium: null,
        },
        status: 'published',
    },
    {
        id: 'product-client-completed',
        expertId: 'expert-real-completed',
        expertName: 'Completed expert',
        title: '작업 완료 테스트 상품',
        category: 'ai-video-shortform',
        summary: 'Completed summary',
        description: 'Completed description',
        aiTools: ['Runway'],
        sampleLinks: [],
        sampleImageUrl: '',
        startingPrice: 60000,
        deliveryDays: 4,
        revisionCount: 1,
        packages: {
            standard: {
                name: 'Standard',
                price: 60000,
                deliveryDays: 4,
                revisionCount: 1,
                included: ['Final'],
            },
            deluxe: null,
            premium: null,
        },
        status: 'published',
    },
    {
        id: 'product-other-01',
        expertId: 'other-user',
        expertName: 'Other expert',
        title: 'Other AI product',
        category: 'ai-image-character',
        summary: 'Other summary',
        description: 'Other description',
        aiTools: ['Midjourney'],
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
                included: ['Draft'],
            },
            deluxe: null,
            premium: null,
        },
        status: 'published',
    },
])
const getUserProposals = vi.fn(async (_userId: string) => [
    {
        id: 'proposal-real-client',
        requestId: 'request-product-client-01',
        clientId: 'user-demo-01',
        expertId: 'expert-real-01',
        title: '받은 실제 제안서',
        scope: '테스트 범위',
        deliverables: ['테스트 결과물'],
        totalPrice: 30000,
        deliveryDays: 2,
        revisionCount: 1,
        progressType: 'single',
        milestones: [],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'sent',
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
    {
        id: 'proposal-real-expert',
        requestId: 'request-expert',
        clientId: 'client-real-01',
        expertId: 'user-demo-01',
        title: '보낸 실제 제안서',
        scope: '테스트 범위',
        deliverables: ['테스트 결과물'],
        totalPrice: 50000,
        deliveryDays: 3,
        revisionCount: 1,
        progressType: 'single',
        milestones: [],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'sent',
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
    {
        id: 'proposal-real-client-expired',
        requestId: 'request-client-expired',
        clientId: 'user-demo-01',
        expertId: 'expert-real-02',
        title: 'Expired client proposal',
        scope: 'Expired scope',
        deliverables: ['Expired deliverable'],
        totalPrice: 90000,
        deliveryDays: 5,
        revisionCount: 1,
        progressType: 'single',
        milestones: [],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'expired',
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
    {
        id: 'proposal-real-expert-second',
        requestId: 'request-expert-second',
        clientId: 'client-real-02',
        expertId: 'user-demo-01',
        title: 'Second sent proposal',
        scope: 'Second scope',
        deliverables: ['Second deliverable'],
        totalPrice: 120000,
        deliveryDays: 7,
        revisionCount: 2,
        progressType: 'milestone',
        milestones: ['Step 1'],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'revision_requested',
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
])
const getUserWorks = vi.fn(async (_userId: string) => [
    {
        id: 'work-real-active',
        proposalId: 'proposal-active',
        requestId: 'request-product-client-01',
        clientId: 'user-demo-01',
        expertId: 'expert-real-01',
        title: '진행 중인 실제 작업',
        progressType: 'single',
        status: 'in_progress',
        stepIds: [],
    },
    {
        id: 'work-real-completed',
        proposalId: 'proposal-completed',
        requestId: 'request-completed',
        clientId: 'user-demo-01',
        expertId: 'expert-real-02',
        title: '완료된 실제 작업',
        progressType: 'single',
        status: 'completed',
        stepIds: [],
    },
    {
        id: 'work-real-submitted',
        proposalId: 'proposal-submitted',
        requestId: 'request-submitted',
        clientId: 'user-demo-01',
        expertId: 'expert-real-03',
        title: 'Submitted work',
        progressType: 'milestone',
        status: 'submitted',
        stepIds: [],
    },
    {
        id: 'work-real-completed-second',
        proposalId: 'proposal-completed-second',
        requestId: 'request-completed-second',
        clientId: 'user-demo-01',
        expertId: 'expert-real-04',
        title: 'Second completed work',
        progressType: 'single',
        status: 'completed',
        stepIds: [],
    },
])

const defaultProposals = () => [
    {
        id: 'proposal-real-client',
        requestId: 'request-product-client-01',
        clientId: 'user-demo-01',
        expertId: 'expert-real-01',
        title: '받은 실제 제안서',
        scope: '테스트 범위',
        deliverables: ['테스트 결과물'],
        totalPrice: 30000,
        deliveryDays: 2,
        revisionCount: 1,
        progressType: 'single' as const,
        milestones: [],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'sent' as const,
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
    {
        id: 'proposal-real-expert',
        requestId: 'request-expert',
        clientId: 'client-real-01',
        expertId: 'user-demo-01',
        title: '보낸 실제 제안서',
        scope: '테스트 범위',
        deliverables: ['테스트 결과물'],
        totalPrice: 50000,
        deliveryDays: 3,
        revisionCount: 1,
        progressType: 'single' as const,
        milestones: [],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'sent' as const,
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
    {
        id: 'proposal-real-client-expired',
        requestId: 'request-client-expired',
        clientId: 'user-demo-01',
        expertId: 'expert-real-02',
        title: 'Expired client proposal',
        scope: 'Expired scope',
        deliverables: ['Expired deliverable'],
        totalPrice: 90000,
        deliveryDays: 5,
        revisionCount: 1,
        progressType: 'single' as const,
        milestones: [],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'expired' as const,
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
    {
        id: 'proposal-real-expert-second',
        requestId: 'request-expert-second',
        clientId: 'client-real-02',
        expertId: 'user-demo-01',
        title: 'Second sent proposal',
        scope: 'Second scope',
        deliverables: ['Second deliverable'],
        totalPrice: 120000,
        deliveryDays: 7,
        revisionCount: 2,
        progressType: 'milestone' as const,
        milestones: ['Step 1'],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'revision_requested' as const,
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
]

const defaultWorks = () => [
    {
        id: 'work-real-active',
        proposalId: 'proposal-active',
        requestId: 'request-product-client-01',
        clientId: 'user-demo-01',
        expertId: 'expert-real-01',
        title: '진행 중인 실제 작업',
        progressType: 'single' as const,
        status: 'in_progress' as const,
        stepIds: [],
    },
    {
        id: 'work-real-completed',
        proposalId: 'proposal-completed',
        requestId: 'request-completed',
        clientId: 'user-demo-01',
        expertId: 'expert-real-02',
        title: '완료된 실제 작업',
        progressType: 'single' as const,
        status: 'completed' as const,
        stepIds: [],
    },
    {
        id: 'work-real-submitted',
        proposalId: 'proposal-submitted',
        requestId: 'request-submitted',
        clientId: 'user-demo-01',
        expertId: 'expert-real-03',
        title: 'Submitted work',
        progressType: 'milestone' as const,
        status: 'submitted' as const,
        stepIds: [],
    },
    {
        id: 'work-real-completed-second',
        proposalId: 'proposal-completed-second',
        requestId: 'request-completed-second',
        clientId: 'user-demo-01',
        expertId: 'expert-real-04',
        title: 'Second completed work',
        progressType: 'single' as const,
        status: 'completed' as const,
        stepIds: [],
    },
    {
        id: 'work-client-completed-order',
        proposalId: 'proposal-client-completed-order',
        requestId: 'request-product-client-completed',
        clientId: 'user-demo-01',
        expertId: 'expert-real-completed',
        title: '작업 완료 테스트 상품',
        progressType: 'single' as const,
        status: 'completed' as const,
        stepIds: [],
    },
    {
        id: 'work-expert-active-order',
        proposalId: 'proposal-expert-active-order',
        requestId: 'request-product-directed-active',
        clientId: 'client-real-active',
        expertId: 'user-demo-01',
        title: '전문가 진행 중 상품',
        progressType: 'single' as const,
        status: 'in_progress' as const,
        stepIds: [],
    },
    {
        id: 'work-expert-completed-order',
        proposalId: 'proposal-expert-completed-order',
        requestId: 'request-product-directed-completed',
        clientId: 'client-real-completed',
        expertId: 'user-demo-01',
        title: '전문가 완료 상품',
        progressType: 'single' as const,
        status: 'completed' as const,
        stepIds: [],
    },
]

vi.mock('../lib/storage', () => ({
    getExpertProducts: () => getExpertProducts(),
    getUserProposals: (userId: string) => getUserProposals(userId),
    getUserReviews: (userId: string) => getUserReviews(userId),
    getUserServiceRequests: (userId: string) => getUserServiceRequests(userId),
    getUserWorks: (userId: string) => getUserWorks(userId),
    saveProposal: (proposal: Proposal) => saveProposal(proposal),
    saveReview: (review: Review) => saveReview(review),
}))

describe('MyPage', () => {
    beforeEach(() => {
        saveReview.mockClear()
        saveProposal.mockClear()
        getExpertProducts.mockClear()
        getUserProposals.mockReset()
        getUserProposals.mockResolvedValue(defaultProposals())
        getUserReviews.mockReset()
        getUserReviews.mockResolvedValue([])
        getUserServiceRequests.mockReset()
        getUserServiceRequests.mockResolvedValue([
            {
                id: 'request-product-client-01',
                title: 'AI 숏폼 상품 주문',
                description: '의뢰자가 주문한 상품 상세',
                budget: '30000',
                deadline: '2026-06-01',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'user-demo-01',
                expertId: 'expert-real-01',
                productId: 'product-client-01',
                selectedPackage: 'standard',
                desiredResult: '제품 홍보 숏폼',
                purpose: '신제품 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'in_progress',
            },
            {
                id: 'request-product-client-before',
                title: '작업 전 상품 주문',
                description: '아직 작업방이 없는 주문',
                budget: '40000',
                deadline: '2026-06-05',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'user-demo-01',
                expertId: 'expert-real-before',
                productId: 'product-client-before',
                selectedPackage: 'standard',
                desiredResult: '작업 전 요구사항',
                purpose: '런칭 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'pending',
            },
            {
                id: 'request-product-client-completed',
                title: '작업 완료 상품 주문',
                description: '작업이 끝난 주문',
                budget: '60000',
                deadline: '2026-06-10',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'user-demo-01',
                expertId: 'expert-real-completed',
                productId: 'product-client-completed',
                selectedPackage: 'standard',
                desiredResult: '작업 완료 요구사항',
                purpose: '성과 보고',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'completed',
            },
            {
                id: 'request-product-directed-01',
                title: 'Owned AI product',
                description: '상품 지정 의뢰 상세',
                budget: '30000',
                deadline: '2026-06-01',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'client-real-01',
                expertId: 'user-demo-01',
                productId: 'product-owned-01',
                selectedPackage: 'standard',
                desiredResult: '상품 지정 요구사항',
                purpose: 'SNS 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'pending',
            },
            {
                id: 'request-product-directed-active',
                title: '전문가 진행 중 상품 의뢰',
                description: '전문가가 진행 중인 상품 지정 의뢰',
                budget: '50000',
                deadline: '2026-06-08',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'client-real-active',
                expertId: 'user-demo-01',
                productId: 'product-owned-01',
                selectedPackage: 'standard',
                desiredResult: '전문가 진행 중 요구사항',
                purpose: 'SNS 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'in_progress',
            },
            {
                id: 'request-product-directed-completed',
                title: '전문가 완료 상품 의뢰',
                description: '전문가가 완료한 상품 지정 의뢰',
                budget: '70000',
                deadline: '2026-06-09',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'client-real-completed',
                expertId: 'user-demo-01',
                productId: 'product-owned-01',
                selectedPackage: 'standard',
                desiredResult: '전문가 완료 요구사항',
                purpose: 'SNS 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'completed',
            },
        ])
        getUserWorks.mockReset()
        getUserWorks.mockResolvedValue(defaultWorks())
    })

    it('shows client and expert sections with transaction links', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        expect(screen.getByRole('heading', { name: '마이페이지' })).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: '마이페이지 메뉴' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '개요' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('heading', { name: '전체 현황' })).toBeInTheDocument()
        expect(screen.getByText('의뢰자 영역은 내가 맡긴 일을 관리하는 곳입니다.')).toBeInTheDocument()
        expect(screen.getByText('전문가 영역은 내가 받거나 제안한 일을 관리하는 곳입니다.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '의뢰자 홈' }))
        expect(screen.getByText('내가 맡긴 일')).toBeInTheDocument()
        expect(screen.getByText('상품을 주문한 경우 상품 단위로 들어가 진행 단계를 확인합니다.')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '상품 주문 관리' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '공개 요청 보기' })).toHaveAttribute('href', '/requests')
        expect(await screen.findByRole('link', { name: '제안서 보기' })).toHaveAttribute(
            'href',
            '/proposal/proposal-real-client',
        )
        expect(await screen.findByRole('link', { name: '작업방 열기' })).toHaveAttribute(
            'href',
            '/workroom/work-real-active',
        )

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))
        expect(screen.getByText('내가 수행할 일')).toBeInTheDocument()
        expect(screen.getByText('내 상품으로 들어온 의뢰와 내가 보낸 제안서를 확인합니다.')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '받은 일 관리' })).toBeInTheDocument()
        expect(screen.getByText('받은 의뢰를 작업 전, 작업 중, 작업 완료로 나눠 관리합니다.')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '전문가 응답 필요' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '내가 등록한 상품' })).toHaveAttribute('href', '/profile')
        expect(screen.getByRole('link', { name: '공개 요청 게시판 보기' })).toHaveAttribute('href', '/requests')
        expect(await screen.findByText('받은 상품 의뢰')).toBeInTheDocument()
        expect(screen.getAllByText('상품 지정 요구사항').length).toBeGreaterThan(0)
        expect(await screen.findByRole('link', { name: '공개 상품 보기' })).toHaveAttribute(
            'href',
            '/expert/product-owned-01',
        )
        expect(await screen.findByRole('link', { name: '보낸 제안서 보기' })).toHaveAttribute(
            'href',
            '/proposal/proposal-real-expert',
        )
    })

    it('lets clients open a product order and manage its related stages together', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '의뢰자 홈' }))

        expect(await screen.findByRole('heading', { name: '상품 주문 관리' })).toBeInTheDocument()
        expect(screen.getByText('상품별로 요구사항, 제안서, 작업방 단계를 한 곳에서 확인합니다.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /AI 숏폼 영상 제작/ }))

        expect(screen.getByRole('heading', { name: 'AI 숏폼 영상 제작' })).toBeInTheDocument()
        expect(screen.getByText('현재 단계: 작업 중')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '전체 과정' })).toBeInTheDocument()
        expect(screen.getAllByText('작업 전').length).toBeGreaterThan(0)
        expect(screen.getByText('의뢰서 작성/요구사항')).toBeInTheDocument()
        expect(screen.getAllByText('제품 홍보 숏폼').length).toBeGreaterThan(0)
        expect(screen.getByRole('link', { name: '의뢰서 보기/수정' })).toHaveAttribute('href', '/request/product-client-01')
        expect(screen.getByText('제안서 검토')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '제안서 보기' })).toHaveAttribute('href', '/proposal/proposal-real-client')
        expect(screen.getAllByText('작업 중').length).toBeGreaterThan(0)
        expect(screen.getByText('작업방 진행')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '작업방 열기' })).toHaveAttribute('href', '/workroom/work-real-active')
        expect(screen.getByText('작업 후')).toBeInTheDocument()
        expect(screen.getByText('완료 확인/리뷰')).toBeInTheDocument()

        expect(within(screen.getByLabelText('의뢰서 작성/요구사항 단계 상태: 완료됨')).getByText('완료됨')).toBeInTheDocument()
        expect(within(screen.getByLabelText('제안서 검토 단계 상태: 완료됨')).getByText('완료됨')).toBeInTheDocument()
        expect(within(screen.getByLabelText('작업방 진행 단계 상태: 진행 중')).getAllByText('진행 중').length).toBeGreaterThan(0)
        const pendingReviewStage = screen.getByLabelText('완료 확인/리뷰 단계 상태: 대기')
        expect(within(pendingReviewStage).getByText('대기')).toBeInTheDocument()
        expect(within(pendingReviewStage).getByText('완료 확인/리뷰')).toHaveAttribute('data-stage-muted', 'true')
        expect(within(pendingReviewStage).getByText('작업이 완료되면 결과 확인과 리뷰 작성이 가능합니다.')).toHaveAttribute('data-stage-muted', 'true')
    })

    it('groups client product orders by before, active, and completed work states', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '의뢰자 홈' }))

        const groups = await screen.findByLabelText('의뢰자 주문 상태 그룹')
        expect(within(groups).getByRole('heading', { name: '작업 전' })).toBeInTheDocument()
        expect(within(groups).getByRole('heading', { name: '작업 중' })).toBeInTheDocument()
        expect(within(groups).getByRole('heading', { name: '작업 완료' })).toBeInTheDocument()

        expect(within(groups).getByRole('button', { name: /작업 전 테스트 상품/ })).toBeInTheDocument()
        expect(within(groups).getByRole('button', { name: /AI 숏폼 영상 제작/ })).toBeInTheDocument()
        expect(within(groups).getByRole('button', { name: /작업 완료 테스트 상품/ })).toBeInTheDocument()
    })

    it('groups expert received product work by before, active, and completed states', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))

        const groups = await screen.findByLabelText('전문가 받은 일 상태 그룹')
        expect(within(groups).getByRole('heading', { name: '작업 전' })).toBeInTheDocument()
        expect(within(groups).getByRole('heading', { name: '작업 중' })).toBeInTheDocument()
        expect(within(groups).getByRole('heading', { name: '작업 완료' })).toBeInTheDocument()

        expect(within(groups).getByRole('button', { name: /상품 지정 요구사항/ })).toBeInTheDocument()
        expect(within(groups).getByRole('button', { name: /전문가 진행 중 요구사항/ })).toBeInTheDocument()
        expect(within(groups).getByRole('button', { name: /전문가 완료 요구사항/ })).toBeInTheDocument()

        fireEvent.click(within(groups).getByRole('button', { name: /전문가 진행 중 요구사항/ }))
        expect(screen.getByRole('heading', { name: '전문가 진행 중 요구사항' })).toBeInTheDocument()
        expect(screen.getByText('현재 단계: 작업 중')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '전체 과정' })).toBeInTheDocument()
        expect(screen.getByText('받은 의뢰')).toBeInTheDocument()
        expect(screen.getByText('제안서 작성/수정')).toBeInTheDocument()
        expect(screen.getByText('작업 진행')).toBeInTheDocument()
        expect(screen.getAllByText('작업 완료').length).toBeGreaterThan(0)

        expect(within(screen.getByLabelText('받은 의뢰 단계 상태: 완료됨')).getByText('완료됨')).toBeInTheDocument()
        expect(within(screen.getByLabelText('제안서 작성/수정 단계 상태: 대기')).getByText('대기')).toBeInTheDocument()
        expect(within(screen.getByLabelText('작업 진행 단계 상태: 진행 중')).getAllByText('진행 중').length).toBeGreaterThan(0)
        const pendingCompleteStage = screen.getByLabelText('작업 완료 단계 상태: 대기')
        expect(within(pendingCompleteStage).getByText('대기')).toBeInTheDocument()
        expect(within(pendingCompleteStage).getAllByText('작업 완료').some((element) => element.getAttribute('data-stage-muted') === 'true')).toBe(true)
        expect(within(pendingCompleteStage).getByText('결과물을 제출하고 의뢰자 확인을 기다립니다.')).toHaveAttribute('data-stage-muted', 'true')
    })

    it('lets experts send a proposal from a product-directed request in my page', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))

        const groups = await screen.findByLabelText('전문가 받은 일 상태 그룹')
        fireEvent.click(within(groups).getByRole('button', { name: /상품 지정 요구사항/ }))
        fireEvent.click(screen.getByRole('button', { name: '제안서 보내기' }))

        await waitFor(() => expect(saveProposal).toHaveBeenCalledWith(
            expect.objectContaining({
                requestId: 'request-product-directed-01',
                clientId: 'client-real-01',
                expertId: 'user-demo-01',
                title: expect.stringContaining('상품 지정 요구사항'),
                status: 'sent',
            }),
        ))
        expect(screen.getByText('제안서를 보냈습니다.')).toBeInTheDocument()
        expect(
            screen
                .getAllByRole('link', { name: '보낸 제안서 보기' })
                .some((link) => link.getAttribute('href') === '/proposal/proposal-product-directed-created'),
        ).toBe(true)
    })

    it('does not link to demo proposal or workroom pages when there is no user data', async () => {
        getUserProposals.mockResolvedValue([])
        getUserWorks.mockResolvedValue([])
        getUserServiceRequests.mockResolvedValue([])

        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '의뢰자 홈' }))
        expect(await screen.findByText('아직 상품 주문 내역이 없습니다.')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '제안서 보기' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '작업방 열기' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))
        expect(screen.queryByRole('link', { name: '보낸 제안서 보기' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /proposal-demo-01/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /work-demo-01/i })).not.toBeInTheDocument()
    })

    it('shows review button only on completed work', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '완료 / 리뷰' }))
        const completedWork = (await screen.findAllByTestId('completed-work'))[0]
        expect(within(completedWork).getByRole('button', { name: '리뷰 작성' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '작업방' }))
        const activeWork = (await screen.findAllByTestId('active-work'))[0]

        expect(within(activeWork).queryByRole('button', { name: '리뷰 작성' })).not.toBeInTheDocument()
    })

    it('shows every received and sent proposal as proposal cards', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '의뢰자 홈' }))
        expect(await screen.findByText('제안서 검토')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '제안서 보기' })).toHaveAttribute('href', '/proposal/proposal-real-client')

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))
        expect(await screen.findByText('Second sent proposal')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Second sent proposal' })).toHaveAttribute(
            'href',
            '/proposal/proposal-real-expert-second',
        )
        expect(screen.getByText('수정 요청')).toBeInTheDocument()
    })

    it('shows every active and completed work as workroom cards', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '작업방' }))
        expect(await screen.findByRole('link', { name: 'Submitted work' })).toHaveAttribute(
            'href',
            '/workroom/work-real-submitted',
        )
        fireEvent.click(screen.getByRole('button', { name: '완료 / 리뷰' }))
        expect(await screen.findByRole('link', { name: 'Second completed work' })).toHaveAttribute(
            'href',
            '/workroom/work-real-completed-second',
        )
        expect(screen.getAllByRole('button', { name: '리뷰 작성' })).toHaveLength(3)
    })

    it('does not offer another review for work already reviewed by the client', async () => {
        getUserReviews.mockResolvedValue([
            {
                id: 'review-existing-01',
                workId: 'work-real-completed',
                clientId: 'user-demo-01',
                expertId: 'expert-real-02',
                rating: 5,
                content: 'Already reviewed',
                createdAt: '2026-06-02T00:00:00.000Z',
            },
        ])

        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '완료 / 리뷰' }))
        const completedWorks = await screen.findAllByTestId('completed-work')

        expect(within(completedWorks[0]).queryByRole('button', { name: '리뷰 작성' })).not.toBeInTheDocument()
        expect(within(completedWorks[0]).getByText('리뷰 등록 완료')).toBeInTheDocument()
        expect(within(completedWorks[1]).getByRole('button', { name: '리뷰 작성' })).toBeInTheDocument()
    })

    it('shows only products registered by the current expert', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))
        expect(await screen.findByRole('link', { name: 'Owned AI product' })).toHaveAttribute(
            'href',
            '/expert/product-owned-01',
        )
        expect(screen.queryByText('Other AI product')).not.toBeInTheDocument()
    })

    it('opens and submits a review form for completed work', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '완료 / 리뷰' }))
        fireEvent.click(within((await screen.findAllByTestId('completed-work'))[0]).getByRole('button', { name: '리뷰 작성' }))

        expect(screen.getByRole('heading', { name: '리뷰 작성하기' })).toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('별점'), { target: { value: '5' } })
        fireEvent.change(screen.getByLabelText('리뷰 내용'), {
            target: { value: '결과물이 목적에 잘 맞고 일정 안내도 명확했습니다.' },
        })
        fireEvent.click(screen.getByRole('button', { name: '리뷰 등록' }))

        await waitFor(() =>
            expect(saveReview).toHaveBeenCalledWith(
                expect.objectContaining({
                    workId: 'work-real-completed',
                    clientId: 'user-demo-01',
                    expertId: 'expert-real-02',
                    rating: 5,
                    content: '결과물이 목적에 잘 맞고 일정 안내도 명확했습니다.',
                }),
            ),
        )
        expect(await screen.findByText('리뷰가 등록되었습니다.')).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: '리뷰 작성하기' })).not.toBeInTheDocument()
    })
})
