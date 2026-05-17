import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Proposal from './Proposal'
import type { Proposal as ProposalData } from '../types'

const activeProposal: ProposalData = {
    id: 'proposal-demo-01',
    requestId: 'request-demo-01',
    clientId: 'client-demo-01',
    expertId: 'expert-video-01',
    title: 'AI 숏폼 영상 1차 제작 제안',
    scope: '15초 숏폼 영상 콘셉트와 1차 시안을 제작합니다.',
    deliverables: ['15초 AI 숏폼 영상 시안', '기획 콘셉트 요약'],
    totalPrice: 70000,
    deliveryDays: 4,
    revisionCount: 2,
    progressType: 'milestone',
    milestones: ['콘셉트 확인', '1차 영상 시안 제출'],
    commercialUseAllowed: true,
    sourceFileIncluded: false,
    status: 'sent',
    expiresAt: '2999-01-01T00:00:00.000Z',
}

const expiredProposal: ProposalData = {
    ...activeProposal,
    id: 'proposal-expired-01',
    title: '만료된 AI 숏폼 제작 제안',
    status: 'expired',
    expiresAt: '2000-01-01T00:00:00.000Z',
}

const acceptProposal = vi.fn(async () => 'work-created-01')
const requestProposalRevision = vi.fn(async () => undefined)
const cancelProposal = vi.fn(async () => undefined)

vi.mock('../lib/storage', () => ({
    getProposal: vi.fn(async (id: string) => (id === expiredProposal.id ? expiredProposal : activeProposal)),
    acceptProposal: (...args: unknown[]) => acceptProposal(...args),
    cancelProposal: (...args: unknown[]) => cancelProposal(...args),
    requestProposalRevision: (...args: unknown[]) => requestProposalRevision(...args),
}))

describe('Proposal', () => {
    it('shows proposal delivery information and accepts active proposals', async () => {
        render(
            <MemoryRouter initialEntries={['/proposal/proposal-demo-01']}>
                <Routes>
                    <Route path="/proposal/:proposalId" element={<Proposal />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '거래 제안서' })).toBeInTheDocument()
        expect(screen.getByText('최종 금액')).toBeInTheDocument()
        expect(screen.getByText('70,000원')).toBeInTheDocument()
        expect(screen.getByText(activeProposal.scope)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '승인하기' }))

        await waitFor(() => expect(acceptProposal).toHaveBeenCalledWith(activeProposal))
        expect(screen.getByText('제안서를 승인했습니다. 작업 진행방이 열렸습니다.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '작업방으로 이동' })).toHaveAttribute(
            'href',
            '/workroom/work-created-01',
        )
    })

    it('requests proposal revision and cancels proposals', async () => {
        render(
            <MemoryRouter initialEntries={['/proposal/proposal-demo-01']}>
                <Routes>
                    <Route path="/proposal/:proposalId" element={<Proposal />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '거래 제안서' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '수정 요청' }))
        await waitFor(() => expect(requestProposalRevision).toHaveBeenCalledWith(activeProposal.id))
        expect(screen.getByText('수정 요청을 보냈습니다.')).toBeInTheDocument()
        expect(screen.getByText('수정 요청됨')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '취소' }))
        await waitFor(() => expect(cancelProposal).toHaveBeenCalledWith(activeProposal.id))
        expect(screen.getByText('제안서를 취소했습니다.')).toBeInTheDocument()
        expect(screen.getByText('취소됨')).toBeInTheDocument()
    })

    it('disables approval for expired proposals', async () => {
        render(
            <MemoryRouter initialEntries={['/proposal/proposal-expired-01']}>
                <Routes>
                    <Route path="/proposal/:proposalId" element={<Proposal />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByText('만료된 제안서입니다.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '승인하기' })).toBeDisabled()
    })
})
