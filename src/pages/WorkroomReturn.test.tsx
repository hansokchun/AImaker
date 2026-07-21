import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Workroom from './Workroom'
import type { Deliverable, Work, WorkStep } from '../types'

const work: Work = {
    id: 'work-return-01',
    proposalId: 'proposal-return-01',
    requestId: 'request-product-client-01',
    clientId: 'user-demo-01',
    expertId: 'expert-demo-01',
    title: 'Return work',
    progressType: 'single',
    status: 'in_progress',
    stepIds: ['step-return-01'],
}

const step: WorkStep = {
    id: 'step-return-01',
    workId: work.id,
    stepOrder: 1,
    title: 'Draft',
    description: 'Draft work',
    status: 'in_progress',
}

const deliverable: Deliverable = {
    id: 'deliverable-return-01',
    workId: work.id,
    stepId: step.id,
    expertId: work.expertId,
    description: 'Draft link',
    externalUrl: 'https://example.com/draft',
    retentionConfirmed: true,
    status: 'submitted',
    submittedAt: '2026-06-01T00:00:00.000Z',
}

vi.mock('../lib/storage', () => ({
    acceptWorkCancellation: vi.fn(async () => undefined),
    approveWorkDeliverable: vi.fn(async () => undefined),
    getAutoPurchaseConfirmAt: vi.fn((submittedAt: string) => submittedAt),
    getCancellationAutoCancelAt: vi.fn((requestedAt: string) => requestedAt),
    getUserDisplayProfile: vi.fn(async (userId: string) => ({
        name: userId === work.clientId ? '의뢰자' : '작업자',
        imageUrl: '',
        isExpert: userId === work.expertId,
    })),
    getStoredProfile: vi.fn(async () => null),
    getWorkMessages: vi.fn(async () => []),
    getWorkroomData: vi.fn(async () => ({ work, steps: [step], deliverables: [deliverable] })),
    requestSettlementWithdrawal: vi.fn(async () => undefined),
    requestWorkCancellation: vi.fn(async () => undefined),
    requestWorkRevision: vi.fn(async () => undefined),
    saveDeliverable: vi.fn(async () => undefined),
    saveWorkMessage: vi.fn(async () => ({
        id: 'work-message-return-01',
        workId: work.id,
        senderId: work.clientId,
        body: 'Message',
        attachmentUrls: [],
        createdAt: '2026-06-01T00:00:00.000Z',
    })),
}))

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-demo-01', email: 'user@example.com' },
        loading: false,
    }),
}))

describe('Workroom return navigation', () => {
    it('returns to the previous my page screen when opened from my page', async () => {
        render(
            <MemoryRouter
                initialEntries={[
                    {
                        pathname: '/workroom/work-return-01',
                        state: { from: { pathname: '/mypage', search: '?panel=client&clientOrder=request-product-client-01' } },
                    },
                ]}
            >
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '작업 진행방' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '내 작업에서 전체 진행 보기' })).toHaveAttribute(
            'href',
            '/my-work?role=client&panel=client&clientOrder=request-product-client-01',
        )
        expect(screen.queryByRole('link', { name: '마이페이지로 돌아가기' })).not.toBeInTheDocument()
    })

    it('keeps the selected work dashboard role when opened from my work', async () => {
        render(
            <MemoryRouter
                initialEntries={[
                    {
                        pathname: '/workroom/work-return-01',
                        state: { from: { pathname: '/my-work', search: '?role=expert&panel=workroom' } },
                    },
                ]}
            >
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '작업 진행방' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '내 작업에서 전체 진행 보기' })).toHaveAttribute(
            'href',
            '/my-work?role=client&panel=client&clientOrder=request-product-client-01',
        )
        expect(screen.queryByRole('link', { name: '마이페이지로 돌아가기' })).not.toBeInTheDocument()
    })
})
