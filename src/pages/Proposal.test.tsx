import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Proposal from './Proposal'
import type { Proposal as ProposalData, Work } from '../types'

let currentUserId = 'client-demo-01'

const activeProposal: ProposalData = {
    id: 'proposal-demo-01',
    requestId: 'request-demo-01',
    clientId: 'client-demo-01',
    expertId: 'expert-video-01',
    title: 'AI shortform proposal',
    scope: 'Create a first AI shortform video concept and draft.',
    deliverables: ['15s AI video draft', 'Concept summary'],
    totalPrice: 70000,
    deliveryDays: 4,
    revisionCount: 2,
    progressType: 'milestone',
    milestones: ['Concept check', 'Draft delivery'],
    commercialUseAllowed: true,
    sourceFileIncluded: false,
    status: 'sent',
    paymentStatus: 'unpaid',
    expiresAt: '2999-01-01T00:00:00.000Z',
}

const expiredProposal: ProposalData = {
    ...activeProposal,
    id: 'proposal-expired-01',
    status: 'expired',
    expiresAt: '2000-01-01T00:00:00.000Z',
}

const existingWork: Work = {
    id: 'work-existing-01',
    proposalId: activeProposal.id,
    requestId: activeProposal.requestId,
    clientId: activeProposal.clientId,
    expertId: activeProposal.expertId,
    title: activeProposal.title,
    progressType: activeProposal.progressType,
    status: 'in_progress',
    stepIds: [],
}

const acceptProposal = vi.fn(async (_proposal: ProposalData) => 'work-created-01')
const getWorkByProposal = vi.fn(async (_proposalId: string): Promise<Work | null> => null)
const getProposal = vi.fn(async (id: string): Promise<ProposalData | null> =>
    id === expiredProposal.id ? expiredProposal : activeProposal,
)

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: currentUserId, email: `${currentUserId}@example.com` },
        loading: false,
    }),
}))

vi.mock('../lib/storage', () => ({
    getProposal: (proposalId: string) => getProposal(proposalId),
    getWorkByProposal: (proposalId: string) => getWorkByProposal(proposalId),
    acceptProposal: (proposal: ProposalData) => acceptProposal(proposal),
}))

function renderProposal(path = '/proposal/proposal-demo-01') {
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/proposal/:proposalId" element={<Proposal />} />
            </Routes>
        </MemoryRouter>,
    )
}

const linkHrefs = () => screen.queryAllByRole('link').map((link) => link.getAttribute('href'))

describe('Proposal', () => {
    beforeEach(() => {
        currentUserId = 'client-demo-01'
        getProposal.mockReset()
        getProposal.mockImplementation(async (id: string) => (id === expiredProposal.id ? expiredProposal : activeProposal))
        acceptProposal.mockClear()
        getWorkByProposal.mockReset()
        getWorkByProposal.mockResolvedValue(null)
    })

    it('only lets the expert edit a sent unpaid proposal', async () => {
        currentUserId = 'expert-video-01'

        renderProposal()

        expect(await screen.findByText(activeProposal.scope)).toBeInTheDocument()
        expect(linkHrefs()).toContain('/proposals/new?proposalId=proposal-demo-01')
        expect(screen.queryAllByRole('button')).toHaveLength(0)
    })

    it('lets clients accept active proposals without revision, reject, or cancel actions', async () => {
        renderProposal()

        expect(await screen.findByText(activeProposal.scope)).toBeInTheDocument()
        expect(screen.getAllByRole('button')).toHaveLength(1)

        fireEvent.click(screen.getAllByRole('button')[0])

        await waitFor(() => expect(acceptProposal).toHaveBeenCalledWith(activeProposal))
        expect(linkHrefs()).toContain('/workroom/work-created-01')
    })

    it('blocks expert editing when reopening a paid accepted proposal', async () => {
        currentUserId = 'expert-video-01'
        getProposal.mockResolvedValue({
            ...activeProposal,
            status: 'accepted',
            paymentStatus: 'paid',
        })
        getWorkByProposal.mockResolvedValue(existingWork)

        renderProposal()

        expect(await screen.findByText(activeProposal.scope)).toBeInTheDocument()
        await waitFor(() => expect(getWorkByProposal).toHaveBeenCalledWith(activeProposal.id))
        expect(linkHrefs()).not.toContain('/proposals/new?proposalId=proposal-demo-01')
        expect(linkHrefs()).toContain('/workroom/work-existing-01')
        expect(screen.queryAllByRole('button')).toHaveLength(0)
    })

    it('disables approval for expired proposals', async () => {
        renderProposal('/proposal/proposal-expired-01')

        expect(await screen.findByText(expiredProposal.scope)).toBeInTheDocument()
        expect(screen.getAllByRole('button')).toHaveLength(1)
        expect(screen.getAllByRole('button')[0]).toBeDisabled()
    })

    it('shows an empty state instead of demo proposal content when proposal is not found', async () => {
        getProposal.mockResolvedValue(null)

        renderProposal('/proposal/unknown-proposal-id')

        await waitFor(() => expect(getProposal).toHaveBeenCalledWith('unknown-proposal-id'))
        expect(screen.queryByText(activeProposal.scope)).not.toBeInTheDocument()
        expect(screen.queryAllByRole('button')).toHaveLength(0)
    })
})
