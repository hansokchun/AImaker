import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RequestBoard from './RequestBoard'
import type { Proposal } from '../types'

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

const saveProposal = vi.fn(async (_proposal: Proposal) => 'proposal-created-01')

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'expert-real-01', email: 'expert@example.com' },
    }),
}))

vi.mock('../lib/storage', () => ({
    getStoredRequests: vi.fn(async () => [request]),
    saveProposal: (proposal: Proposal) => saveProposal(proposal),
}))

describe('RequestBoard', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        saveProposal.mockClear()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('offers request creation from the request board page', async () => {
        render(
            <MemoryRouter>
                <RequestBoard />
            </MemoryRouter>,
        )

        expect(await screen.findByText('QA 요청')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'AI 작업 요청하기' })).toHaveAttribute('href', '/request')
    })

    it('lets an expert submit a proposal for a request', async () => {
        vi.setSystemTime(new Date('2026-05-18T00:00:00.000Z'))

        render(
            <MemoryRouter>
                <RequestBoard />
            </MemoryRouter>,
        )

        expect(await screen.findByText('QA 요청')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '상세보기' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /QA 요청/ }))

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
                    expiresAt: expect.stringMatching(/^2026-05-21T00:00:00\.\d{3}Z$/),
                }),
            ),
        )
        expect(screen.getByText('제안서를 보냈습니다.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '보낸 제안서 보기' })).toHaveAttribute(
            'href',
            '/proposal/proposal-created-01',
        )
    })

    it('blocks external contact details in proposal text', async () => {
        render(
            <MemoryRouter>
                <RequestBoard />
            </MemoryRouter>,
        )

        expect(await screen.findByText('QA 요청')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /QA 요청/ }))

        fireEvent.change(screen.getByLabelText('제안 제목'), {
            target: { value: 'QA 제안서' },
        })
        fireEvent.change(screen.getByLabelText('작업 범위'), {
            target: { value: '카카오톡 ai-maker 또는 010-1234-5678로 연락 주세요' },
        })
        fireEvent.change(screen.getByLabelText('제안 금액'), {
            target: { value: '50000' },
        })
        fireEvent.change(screen.getByLabelText('작업 기간'), {
            target: { value: '3' },
        })
        fireEvent.click(screen.getByRole('button', { name: '제안서 보내기' }))

        await waitFor(() => expect(saveProposal).not.toHaveBeenCalled())
        expect(screen.getByText('외부 연락처는 입력할 수 없습니다. 안전한 거래를 위해 플랫폼 안에서 소통해주세요.')).toBeInTheDocument()
    })

    it('does not expose a private contact field in request details', async () => {
        render(
            <MemoryRouter>
                <RequestBoard />
            </MemoryRouter>,
        )

        expect(await screen.findByText('QA 요청')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /QA 요청/ }))

        expect(screen.queryByText('주문자 연락처')).not.toBeInTheDocument()
        expect(screen.getByText('요청자 정보')).toBeInTheDocument()
        expect(screen.getByText('플랫폼 내부 요청 기록으로 확인합니다.')).toBeInTheDocument()
    })
})
