import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Proposal from './Proposal'
import type { Proposal as ProposalData } from '../types'

const proposal: ProposalData = {
    id: 'proposal-return-01',
    requestId: 'request-product-client-01',
    clientId: 'user-demo-01',
    expertId: 'expert-demo-01',
    title: 'Return proposal',
    scope: 'Scope',
    deliverables: ['Draft'],
    totalPrice: 30000,
    deliveryDays: 2,
    revisionCount: 1,
    progressType: 'single',
    milestones: [],
    commercialUseAllowed: true,
    sourceFileIncluded: false,
    status: 'sent',
    expiresAt: '2999-01-01T00:00:00.000Z',
}

vi.mock('../lib/storage', () => ({
    getProposal: vi.fn(async () => proposal),
    acceptProposal: vi.fn(async () => 'work-created-01'),
    cancelProposal: vi.fn(async () => undefined),
    requestProposalRevision: vi.fn(async () => undefined),
}))

describe('Proposal return navigation', () => {
    it('returns to the previous my page screen when opened from my page', async () => {
        render(
            <MemoryRouter
                initialEntries={[
                    {
                        pathname: '/proposal/proposal-return-01',
                        state: { from: { pathname: '/mypage', search: '?panel=client&clientOrder=request-product-client-01' } },
                    },
                ]}
            >
                <Routes>
                    <Route path="/proposal/:proposalId" element={<Proposal />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '거래 제안서' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '마이페이지로 돌아가기' })).toHaveAttribute(
            'href',
            '/mypage?panel=client&clientOrder=request-product-client-01',
        )
    })

    it('keeps the selected work dashboard role when opened from my work', async () => {
        render(
            <MemoryRouter
                initialEntries={[
                    {
                        pathname: '/proposal/proposal-return-01',
                        state: { from: { pathname: '/my-work', search: '?role=expert&panel=client&expertRequest=request-product-client-01' } },
                    },
                ]}
            >
                <Routes>
                    <Route path="/proposal/:proposalId" element={<Proposal />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '거래 제안서' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '마이페이지로 돌아가기' })).toHaveAttribute(
            'href',
            '/my-work?role=expert&panel=client&expertRequest=request-product-client-01',
        )
    })
})
