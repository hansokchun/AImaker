import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TossPaymentFail from './TossPaymentFail'
import TossPaymentSuccess from './TossPaymentSuccess'
import type { Proposal, Work } from '../types'

const paidProposal: Proposal = {
    id: 'proposal-paid-01',
    requestId: 'request-paid-01',
    clientId: 'client-demo-01',
    expertId: 'expert-video-01',
    title: 'AI image proposal',
    scope: 'Create a production image.',
    deliverables: ['Image'],
    totalPrice: 50000,
    deliveryDays: 3,
    revisionCount: 1,
    progressType: 'single',
    milestones: [],
    commercialUseAllowed: true,
    sourceFileIncluded: false,
    status: 'accepted',
    paymentStatus: 'paid',
    expiresAt: '2999-01-01T00:00:00.000Z',
}

const work: Work = {
    id: 'work-paid-01',
    proposalId: paidProposal.id,
    requestId: paidProposal.requestId,
    clientId: paidProposal.clientId,
    expertId: paidProposal.expertId,
    title: paidProposal.title,
    progressType: paidProposal.progressType,
    status: 'in_progress',
    stepIds: [],
}

const confirmTossProposalPayment = vi.fn(async () => ({ proposalId: paidProposal.id, workId: work.id }))
const reportTossProposalPaymentFailure = vi.fn(async () => ({ status: 'failed' as const }))
const getProposal = vi.fn(async () => paidProposal)
const acceptProposal = vi.fn(async () => work.id)

vi.mock('../lib/tossPayments', () => ({
    confirmTossProposalPayment: (input: { readonly paymentKey: string; readonly orderId: string; readonly amount: number }) =>
        confirmTossProposalPayment(input),
    reportTossProposalPaymentFailure: (input: { readonly orderId: string; readonly code?: string; readonly message?: string }) =>
        reportTossProposalPaymentFailure(input),
}))

vi.mock('../lib/storage', () => ({
    getProposal: (proposalId: string) => getProposal(proposalId),
    acceptProposal: (proposal: Proposal) => acceptProposal(proposal),
}))

describe('Toss payment result pages', () => {
    beforeEach(() => {
        confirmTossProposalPayment.mockClear()
        reportTossProposalPaymentFailure.mockClear()
        getProposal.mockClear()
        acceptProposal.mockClear()
    })

    it('confirms payment and opens the server-created workroom on the success redirect', async () => {
        render(
            <MemoryRouter initialEntries={['/payments/toss/success?paymentKey=pay_123&orderId=order_123&amount=50000']}>
                <Routes>
                    <Route path="/payments/toss/success" element={<TossPaymentSuccess />} />
                </Routes>
            </MemoryRouter>,
        )

        await waitFor(() =>
            expect(confirmTossProposalPayment).toHaveBeenCalledWith({
                paymentKey: 'pay_123',
                orderId: 'order_123',
                amount: 50000,
            }),
        )
        expect(acceptProposal).not.toHaveBeenCalled()
        expect(await screen.findByRole('link', { name: '프로젝트로 이동' })).toHaveAttribute('href', '/workroom/work-paid-01')
    })

    it('falls back to creating a workroom when the confirm response has no work id', async () => {
        confirmTossProposalPayment.mockResolvedValueOnce({ proposalId: paidProposal.id })

        render(
            <MemoryRouter initialEntries={['/payments/toss/success?paymentKey=pay_123&orderId=order_123&amount=50000']}>
                <Routes>
                    <Route path="/payments/toss/success" element={<TossPaymentSuccess />} />
                </Routes>
            </MemoryRouter>,
        )

        await waitFor(() => expect(acceptProposal).toHaveBeenCalledWith({
            ...paidProposal,
            status: 'accepted',
            paymentStatus: 'paid',
        }))
        expect(await screen.findByRole('link', { name: '프로젝트로 이동' })).toHaveAttribute('href', '/workroom/work-paid-01')
    })

    it('shows Toss fail reason from redirect parameters', () => {
        render(
            <MemoryRouter initialEntries={['/payments/toss/fail?code=USER_CANCEL&message=사용자가 결제를 취소했습니다']}>
                <Routes>
                    <Route path="/payments/toss/fail" element={<TossPaymentFail />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(screen.getByText('결제가 완료되지 않았습니다.')).toBeInTheDocument()
        expect(screen.getByText('USER_CANCEL')).toBeInTheDocument()
        expect(screen.getByText('사용자가 결제를 취소했습니다')).toBeInTheDocument()
    })

    it('reports a failed Toss redirect to the server when the order id is available', async () => {
        render(
            <MemoryRouter initialEntries={['/payments/toss/fail?code=USER_CANCEL&message=cancelled&orderId=order_cancel_01']}>
                <Routes>
                    <Route path="/payments/toss/fail" element={<TossPaymentFail />} />
                </Routes>
            </MemoryRouter>,
        )

        await waitFor(() =>
            expect(reportTossProposalPaymentFailure).toHaveBeenCalledWith({
                orderId: 'order_cancel_01',
                code: 'USER_CANCEL',
                message: 'cancelled',
            }),
        )
        expect(await screen.findByText('결제 실패 상태를 저장했습니다.')).toBeInTheDocument()
    })
})
