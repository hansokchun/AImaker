import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Proposal } from '../types'

const invoke = vi.fn()

vi.mock('./supabase', () => ({
    supabase: {
        functions: {
            invoke,
        },
    },
}))

const proposal: Proposal = {
    id: 'proposal-timeout-01',
    requestId: 'request-timeout-01',
    clientId: 'client-timeout-01',
    expertId: 'expert-timeout-01',
    title: 'Timeout proposal',
    scope: 'Verify Toss SDK timeout.',
    deliverables: ['timeout check'],
    totalPrice: 1000,
    deliveryDays: 1,
    revisionCount: 0,
    progressType: 'single',
    milestones: [],
    commercialUseAllowed: false,
    sourceFileIncluded: false,
    status: 'sent',
    paymentStatus: 'unpaid',
    expiresAt: '2999-01-01T00:00:00.000Z',
}

describe('startTossProposalPayment', () => {
    beforeEach(() => {
        vi.useRealTimers()
        vi.unstubAllEnvs()
        vi.stubEnv('VITE_TOSS_PAYMENTS_CLIENT_KEY', 'test_ck_timeout')
        invoke.mockReset()
        delete window.TossPayments
        document.head.querySelectorAll('script[src*="tosspayments"]').forEach((script) => script.remove())
    })

    it('times out when the Toss SDK script never finishes loading', async () => {
        vi.useFakeTimers()
        invoke.mockResolvedValue({
            data: {
                orderId: 'order-timeout-01',
                orderName: 'Timeout proposal 결제',
                amount: 1000,
            },
            error: null,
        })

        const { startTossProposalPayment } = await import('./tossPayments')
        const paymentPromise = startTossProposalPayment(proposal, { id: proposal.clientId })
        const rejection = expect(paymentPromise).rejects.toThrow('토스페이먼츠 SDK 로딩 시간이 초과되었습니다.')

        await vi.advanceTimersByTimeAsync(15_000)

        await rejection
        expect(document.head.querySelector('script[src="https://js.tosspayments.com/v2/standard"]')).toBeNull()
    })
})
