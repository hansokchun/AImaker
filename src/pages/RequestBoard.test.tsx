import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import RequestBoard from './RequestBoard'

const request = {
    id: 'request-real-01',
    clientId: 'client-real-01',
    title: 'QA 요청',
    description: 'QA 요청 상세',
    budget: '30000',
    deadline: '2026-06-01',
    categories: ['AI 영상/숏폼'],
    createdAt: '2026. 5. 17.',
    status: 'pending',
}

const saveProposal = vi.fn(async () => undefined)

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'expert-real-01', email: 'expert@example.com' },
    }),
}))

vi.mock('../lib/storage', () => ({
    getStoredRequests: vi.fn(async () => [request]),
    saveProposal: (...args: unknown[]) => saveProposal(...args),
}))

describe('RequestBoard', () => {
    it('lets an expert submit a proposal for a request', async () => {
        render(
            <MemoryRouter>
                <RequestBoard />
            </MemoryRouter>,
        )

        expect(await screen.findByText('QA 요청')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '상세보기' }))

        fireEvent.change(screen.getByLabelText('제안 제목'), {
            target: { value: 'QA 제안서' },
        })
        fireEvent.change(screen.getByLabelText('작업 범위'), {
            target: { value: 'QA 범위 제안' },
        })
        fireEvent.change(screen.getByLabelText('제안 금액'), {
            target: { value: '50000' },
        })
        fireEvent.change(screen.getByLabelText('작업 기간'), {
            target: { value: '3' },
        })
        fireEvent.click(screen.getByRole('button', { name: '제안서 보내기' }))

        await waitFor(() =>
            expect(saveProposal).toHaveBeenCalledWith(
                expect.objectContaining({
                    requestId: request.id,
                    clientId: request.clientId,
                    expertId: 'expert-real-01',
                    title: 'QA 제안서',
                    scope: 'QA 범위 제안',
                    totalPrice: 50000,
                    deliveryDays: 3,
                    status: 'sent',
                }),
            ),
        )
        expect(screen.getByText('제안서를 보냈습니다.')).toBeInTheDocument()
    })
})
