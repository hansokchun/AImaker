import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyPage from './MyPage'

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

const saveReview = vi.fn(async () => undefined)
const getUserProposals = vi.fn(async () => [
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
])
const getUserWorks = vi.fn(async () => [
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
])

vi.mock('../lib/storage', () => ({
    getUserProposals: (...args: unknown[]) => getUserProposals(...args),
    getUserWorks: (...args: unknown[]) => getUserWorks(...args),
    saveReview: (...args: unknown[]) => saveReview(...args),
}))

describe('MyPage', () => {
    beforeEach(() => {
        saveReview.mockClear()
        getUserProposals.mockClear()
        getUserWorks.mockClear()
    })

    it('shows client and expert sections with transaction links', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        expect(screen.getByRole('heading', { name: '마이페이지' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '의뢰자' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '전문가' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '내 의뢰 요청' })).toHaveAttribute('href', '/requests')
        expect(await screen.findByRole('link', { name: '받은 제안서' })).toHaveAttribute(
            'href',
            '/proposal/proposal-real-client',
        )
        expect(await screen.findByRole('link', { name: '진행 중인 작업' })).toHaveAttribute(
            'href',
            '/workroom/work-real-active',
        )
        expect(screen.getByRole('link', { name: '내가 등록한 상품' })).toHaveAttribute('href', '/profile')
        expect(screen.getByRole('link', { name: '받은 요청' })).toHaveAttribute('href', '/requests')
        expect(await screen.findByRole('link', { name: '보낸 제안서' })).toHaveAttribute(
            'href',
            '/proposal/proposal-real-expert',
        )
    })

    it('shows review button only on completed work', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        const completedWork = await screen.findByTestId('completed-work')
        const activeWork = await screen.findByTestId('active-work')

        expect(within(completedWork).getByRole('button', { name: '리뷰 작성' })).toBeInTheDocument()
        expect(within(activeWork).queryByRole('button', { name: '리뷰 작성' })).not.toBeInTheDocument()
    })

    it('opens and submits a review form for completed work', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(within(await screen.findByTestId('completed-work')).getByRole('button', { name: '리뷰 작성' }))

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
