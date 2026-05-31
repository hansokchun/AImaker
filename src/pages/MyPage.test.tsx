import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyPage from './MyPage'
import type { Review, ServiceRequestData } from '../types'

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
        requestId: 'request-client',
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
        requestId: 'request-active',
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
        requestId: 'request-client',
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
        requestId: 'request-active',
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
]

vi.mock('../lib/storage', () => ({
    getExpertProducts: () => getExpertProducts(),
    getUserProposals: (userId: string) => getUserProposals(userId),
    getUserReviews: (userId: string) => getUserReviews(userId),
    getUserServiceRequests: (userId: string) => getUserServiceRequests(userId),
    getUserWorks: (userId: string) => getUserWorks(userId),
    saveReview: (review: Review) => saveReview(review),
}))

describe('MyPage', () => {
    beforeEach(() => {
        saveReview.mockClear()
        getExpertProducts.mockClear()
        getUserProposals.mockReset()
        getUserProposals.mockResolvedValue(defaultProposals())
        getUserReviews.mockReset()
        getUserReviews.mockResolvedValue([])
        getUserServiceRequests.mockReset()
        getUserServiceRequests.mockResolvedValue([
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
        expect(screen.getByRole('heading', { name: '의뢰자 홈' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '전문가 홈' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '제안 단계' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '작업방' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '전문가 응답 필요' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '공개 요청 보기' })).toHaveAttribute('href', '/requests')
        expect(await screen.findByRole('link', { name: '제안서 검토하기' })).toHaveAttribute(
            'href',
            '/proposal/proposal-real-client',
        )
        expect(await screen.findByRole('link', { name: '작업방 들어가기' })).toHaveAttribute(
            'href',
            '/workroom/work-real-active',
        )
        expect(screen.getByRole('link', { name: '내가 등록한 상품' })).toHaveAttribute('href', '/profile')
        expect(screen.getByRole('link', { name: '공개 요청 게시판 보기' })).toHaveAttribute('href', '/requests')
        expect(await screen.findByText('받은 상품 의뢰')).toBeInTheDocument()
        expect(screen.getByText('상품 지정 요구사항')).toBeInTheDocument()
        expect(await screen.findByRole('link', { name: '공개 상품 보기' })).toHaveAttribute(
            'href',
            '/expert/product-owned-01',
        )
        expect(await screen.findByRole('link', { name: '보낸 제안서 보기' })).toHaveAttribute(
            'href',
            '/proposal/proposal-real-expert',
        )
    })

    it('does not link to demo proposal or workroom pages when there is no user data', async () => {
        getUserProposals.mockResolvedValue([])
        getUserWorks.mockResolvedValue([])

        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        expect(await screen.findByText('아직 받은 제안서가 없습니다.')).toBeInTheDocument()
        expect(screen.getByText('진행 중인 작업이 없습니다.')).toBeInTheDocument()
        expect(screen.getByText('완료된 작업이 없습니다.')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '제안서 검토하기' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '작업방 들어가기' })).not.toBeInTheDocument()
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

        const completedWork = (await screen.findAllByTestId('completed-work'))[0]
        const activeWork = (await screen.findAllByTestId('active-work'))[0]

        expect(within(completedWork).getByRole('button', { name: '리뷰 작성' })).toBeInTheDocument()
        expect(within(activeWork).queryByRole('button', { name: '리뷰 작성' })).not.toBeInTheDocument()
    })

    it('shows every received and sent proposal as proposal cards', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        expect(await screen.findByText('Expired client proposal')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Expired client proposal' })).toHaveAttribute(
            'href',
            '/proposal/proposal-real-client-expired',
        )
        expect(await screen.findByText('Second sent proposal')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Second sent proposal' })).toHaveAttribute(
            'href',
            '/proposal/proposal-real-expert-second',
        )
        expect(screen.getByText('만료')).toBeInTheDocument()
        expect(screen.getByText('수정 요청')).toBeInTheDocument()
    })

    it('shows every active and completed work as workroom cards', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        expect(await screen.findByRole('link', { name: 'Submitted work' })).toHaveAttribute(
            'href',
            '/workroom/work-real-submitted',
        )
        expect(await screen.findByRole('link', { name: 'Second completed work' })).toHaveAttribute(
            'href',
            '/workroom/work-real-completed-second',
        )
        expect(screen.getAllByRole('button', { name: '리뷰 작성' })).toHaveLength(2)
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
