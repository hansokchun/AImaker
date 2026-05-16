import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
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

vi.mock('../lib/storage', () => ({
    saveReview: (...args: unknown[]) => saveReview(...args),
}))

describe('MyPage', () => {
    it('shows client and expert sections with transaction links', () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        expect(screen.getByRole('heading', { name: '마이페이지' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '의뢰자' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '전문가' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '내 의뢰 요청' })).toHaveAttribute('href', '/requests')
        expect(screen.getByRole('link', { name: '받은 제안서' })).toHaveAttribute(
            'href',
            '/proposal/proposal-demo-01',
        )
        expect(screen.getByRole('link', { name: '진행 중인 작업' })).toHaveAttribute(
            'href',
            '/workroom/work-demo-01',
        )
        expect(screen.getByRole('link', { name: '내가 등록한 상품' })).toHaveAttribute('href', '/profile')
        expect(screen.getByRole('link', { name: '받은 요청' })).toHaveAttribute('href', '/requests')
        expect(screen.getByRole('link', { name: '보낸 제안서' })).toHaveAttribute(
            'href',
            '/proposal/proposal-demo-01',
        )
    })

    it('shows review button only on completed work', () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        const completedWork = screen.getByTestId('completed-work')
        const activeWork = screen.getByTestId('active-work')

        expect(within(completedWork).getByRole('button', { name: '리뷰 작성' })).toBeInTheDocument()
        expect(within(activeWork).queryByRole('button', { name: '리뷰 작성' })).not.toBeInTheDocument()
    })

    it('opens and submits a review form for completed work', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(within(screen.getByTestId('completed-work')).getByRole('button', { name: '리뷰 작성' }))

        expect(screen.getByRole('heading', { name: '리뷰 작성하기' })).toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('별점'), { target: { value: '5' } })
        fireEvent.change(screen.getByLabelText('리뷰 내용'), {
            target: { value: '결과물이 목적에 잘 맞고 일정 안내도 명확했습니다.' },
        })
        fireEvent.click(screen.getByRole('button', { name: '리뷰 등록' }))

        await waitFor(() =>
            expect(saveReview).toHaveBeenCalledWith(
                expect.objectContaining({
                    workId: 'work-completed-01',
                    clientId: 'user-demo-01',
                    rating: 5,
                    content: '결과물이 목적에 잘 맞고 일정 안내도 명확했습니다.',
                }),
            ),
        )
        expect(await screen.findByText('리뷰가 등록되었습니다.')).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: '리뷰 작성하기' })).not.toBeInTheDocument()
    })
})
