import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Workroom from './Workroom'
import type { Deliverable, Work, WorkStep } from '../types'

let currentUserId = 'client-demo-01'

const mockWorkTitle = 'AI 숏폼 영상 1차 제작'

const work: Work = {
    id: 'work-demo-01',
    proposalId: 'proposal-demo-01',
    requestId: 'request-demo-01',
    clientId: 'client-demo-01',
    expertId: 'expert-video-01',
    title: mockWorkTitle,
    progressType: 'milestone',
    status: 'submitted',
    totalPrice: 70000,
    platformFee: 8400,
    expertPayout: 61600,
    settlementStatus: 'held',
    stepIds: ['step-concept'],
}

const step: WorkStep = {
    id: 'step-concept',
    workId: work.id,
    stepOrder: 1,
    title: '콘셉트 확인',
    description: '작업 방향을 확인합니다.',
    status: 'submitted',
}

const deliverable: Deliverable = {
    id: 'deliverable-draft-01',
    workId: work.id,
    stepId: step.id,
    expertId: work.expertId,
    description: '1차 시안 링크',
    externalUrl: 'https://example.com/deliverables/ai-shortform-draft',
    status: 'submitted',
    submittedAt: '2026-06-01T00:00:00.000Z',
}

const revisionWork: Work = {
    ...work,
    id: 'work-revision-01',
    status: 'revision_requested',
}

const revisionStep: WorkStep = {
    ...step,
    workId: revisionWork.id,
    status: 'revision_requested',
}

const revisionDeliverable: Deliverable = {
    ...deliverable,
    workId: revisionWork.id,
    status: 'revision_requested',
}

const saveDeliverable = vi.fn(async (_deliverable: Deliverable) => undefined)
const approveWorkDeliverable = vi.fn(
    async (_workId: string, _deliverableId: string, _requestId?: string, _stepId?: string) => undefined,
)
const requestWorkRevision = vi.fn(async (_workId: string, _deliverableId: string, _stepId?: string) => undefined)
const cancelWork = vi.fn(async (_workId: string) => undefined)
const getWorkMessages = vi.fn(async (_workId: string) => [
    {
        id: 'work-message-01',
        workId: work.id,
        senderId: work.clientId,
        body: 'Workroom message from client',
        attachmentUrls: [],
        createdAt: '2026-06-01T00:00:00.000Z',
    },
])
const saveWorkMessage = vi.fn(async (message: { workId: string; senderId: string; body: string }) => ({
    id: 'work-message-created',
    workId: message.workId,
    senderId: message.senderId,
    body: message.body.trim(),
    attachmentUrls: [],
    createdAt: '2026-06-01T00:00:01.000Z',
}))
const getUserDisplayProfile = vi.fn(async (userId: string) => ({
    name: userId === work.clientId ? 'Client User' : 'Expert User',
    imageUrl: userId === work.clientId ? 'https://example.com/client.png' : 'https://example.com/expert.png',
    isExpert: userId === work.expertId,
}))
const getWorkroomData = vi.fn(
    async (_workId: string): Promise<{ work: Work | null; steps: WorkStep[]; deliverables: Deliverable[] }> => ({
        work,
        steps: [step],
        deliverables: [deliverable],
    }),
)

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: currentUserId, email: `${currentUserId}@example.com` },
        loading: false,
    }),
}))

vi.mock('../lib/storage', () => ({
    approveWorkDeliverable: (workId: string, deliverableId: string, requestId?: string, stepId?: string) =>
        approveWorkDeliverable(workId, deliverableId, requestId, stepId),
    cancelWork: (workId: string) => cancelWork(workId),
    getWorkMessages: (workId: string) => getWorkMessages(workId),
    getWorkroomData: (workId: string) => getWorkroomData(workId),
    requestWorkRevision: (workId: string, deliverableId: string, stepId?: string) =>
        requestWorkRevision(workId, deliverableId, stepId),
    saveDeliverable: (deliverable: Deliverable) => saveDeliverable(deliverable),
    saveWorkMessage: (message: { workId: string; senderId: string; body: string }) => saveWorkMessage(message),
    getUserDisplayProfile: (userId: string) => getUserDisplayProfile(userId),
}))

describe('Workroom', () => {
    beforeEach(() => {
        currentUserId = 'client-demo-01'
        getWorkroomData.mockReset()
        getWorkroomData.mockResolvedValue({ work, steps: [step], deliverables: [deliverable] })
        approveWorkDeliverable.mockClear()
        requestWorkRevision.mockClear()
        saveDeliverable.mockClear()
        cancelWork.mockClear()
        getWorkMessages.mockClear()
        saveWorkMessage.mockClear()
        getUserDisplayProfile.mockClear()
    })

    it('loads workroom data and saves deliverable links', async () => {
        currentUserId = 'expert-video-01'

        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '작업 진행방' })).toBeInTheDocument()
        expect(screen.getByText('콘셉트 확인')).toBeInTheDocument()
        expect(screen.getByText('1차 시안 링크')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '결제/정산' })).toBeInTheDocument()
        expect(screen.getByText('결제 완료')).toBeInTheDocument()
        expect(screen.getByText('70,000원')).toBeInTheDocument()
        expect(screen.getByText('AIConnect 수수료 8,400원')).toBeInTheDocument()
        expect(screen.getByText('전문가 정산 예정 61,600원')).toBeInTheDocument()
        expect(screen.getByText('작업 진행 중 보관')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('제출물 링크'), {
            target: { value: 'https://example.com/new-deliverable' },
        })
        fireEvent.click(screen.getByRole('button', { name: '제출물 링크 등록' }))

        await waitFor(() =>
            expect(saveDeliverable).toHaveBeenCalledWith(
                expect.objectContaining({
                    workId: work.id,
                    expertId: work.expertId,
                    externalUrl: 'https://example.com/new-deliverable',
                    status: 'submitted',
                }),
            ),
        )
        expect(screen.getByText('제출물 링크가 등록되었습니다.')).toBeInTheDocument()
    })

    it('shows the proposal link, workroom chat, and stop action inside the workroom', async () => {
        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByText('Workroom message from client')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '제안서 보기' })).toHaveAttribute('href', '/proposal/proposal-demo-01')
        expect(screen.getByRole('link', { name: '거래 단계 보기' })).toHaveAttribute(
            'href',
            '/my-work?role=client&panel=client&clientOrder=request-demo-01',
        )
        expect(screen.getByRole('button', { name: '거래 중단 요청' })).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('작업방 메시지'), {
            target: { value: 'Please check the updated draft.' },
        })
        fireEvent.click(screen.getByRole('button', { name: '메시지 보내기' }))

        await waitFor(() =>
            expect(saveWorkMessage).toHaveBeenCalledWith({
                workId: work.id,
                senderId: currentUserId,
                body: 'Please check the updated draft.',
            }),
        )
        expect(screen.getByText('Please check the updated draft.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '거래 중단 요청' }))
        await waitFor(() => expect(cancelWork).toHaveBeenCalledWith(work.id))
    })

    it('shows participants and keeps deliverable submission expert-only', async () => {
        currentUserId = 'client-demo-01'

        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByText('Client User')).toBeInTheDocument()
        expect(screen.getByText('Expert User')).toBeInTheDocument()
        expect(screen.getByAltText('Client User 프로필 이미지')).toHaveAttribute('src', 'https://example.com/client.png')
        expect(screen.getByAltText('Expert User 프로필 이미지')).toHaveAttribute('src', 'https://example.com/expert.png')
        expect(screen.getByRole('button', { name: '결과물 승인' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '수정 요청' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '제출물 링크 등록' })).not.toBeInTheDocument()
    })

    it('keeps the workroom chat in sync by polling for new messages', async () => {
        vi.useFakeTimers()
        getWorkMessages
            .mockResolvedValueOnce([
                {
                    id: 'work-message-01',
                    workId: work.id,
                    senderId: work.clientId,
                    body: 'Workroom message from client',
                    attachmentUrls: [],
                    createdAt: '2026-06-01T00:00:00.000Z',
                },
            ])
            .mockResolvedValueOnce([
                {
                    id: 'work-message-01',
                    workId: work.id,
                    senderId: work.clientId,
                    body: 'Workroom message from client',
                    attachmentUrls: [],
                    createdAt: '2026-06-01T00:00:00.000Z',
                },
                {
                    id: 'work-message-02',
                    workId: work.id,
                    senderId: work.expertId,
                    body: 'Expert replied from another browser',
                    attachmentUrls: [],
                    createdAt: '2026-06-01T00:00:05.000Z',
                },
            ])

        try {
            render(
                <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                    <Routes>
                        <Route path="/workroom/:workId" element={<Workroom />} />
                    </Routes>
                </MemoryRouter>,
            )

            await act(async () => {
                await Promise.resolve()
                await Promise.resolve()
            })
            expect(screen.getByText('Workroom message from client')).toBeInTheDocument()

            await act(async () => {
                await vi.advanceTimersByTimeAsync(5000)
                await Promise.resolve()
            })

            expect(screen.getByText('Expert replied from another browser')).toBeInTheDocument()
            expect(getWorkMessages).toHaveBeenCalledTimes(2)
        } finally {
            vi.useRealTimers()
        }
    })

    it('keeps review actions client-only and deliverable submission expert-only', async () => {
        currentUserId = 'expert-video-01'

        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('button', { name: '제출물 링크 등록' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '결과물 승인' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '수정 요청' })).not.toBeInTheDocument()
    })

    it('does not show demo deliverables when a real work has no deliverables yet', async () => {
        getWorkroomData.mockResolvedValue({ work, steps: [step], deliverables: [] })

        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '작업 진행방' })).toBeInTheDocument()
        expect(screen.queryByText('1차 AI 숏폼 영상 시안 링크')).not.toBeInTheDocument()
        expect(screen.getByText('등록된 제출물이 없습니다.')).toBeInTheDocument()
    })

    it('does not show demo steps when a real work has no steps yet', async () => {
        getWorkroomData.mockResolvedValue({ work, steps: [], deliverables: [] })

        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: '작업 진행방' })).toBeInTheDocument()
        expect(screen.queryByText('콘셉트 확인')).not.toBeInTheDocument()
        expect(screen.getByText('등록된 진행 단계가 없습니다.')).toBeInTheDocument()
    })

    it('shows an empty state instead of demo workroom content when work is not found', async () => {
        getWorkroomData.mockResolvedValue({ work: null, steps: [], deliverables: [] })

        render(
            <MemoryRouter initialEntries={['/workroom/unknown-work-id']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByText('작업방을 찾을 수 없습니다.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '마이페이지로 돌아가기' })).toHaveAttribute('href', '/mypage')
        expect(screen.queryByText(mockWorkTitle)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '결과물 승인' })).not.toBeInTheDocument()
    })

    it('approves the active deliverable and marks the work as completed', async () => {
        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByText('1차 시안 링크')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '결과물 승인' }))

        await waitFor(() =>
            expect(approveWorkDeliverable).toHaveBeenCalledWith(work.id, deliverable.id, work.requestId, step.id),
        )
        expect(screen.getByText('결과물을 승인했습니다. 작업이 완료되었습니다.')).toBeInTheDocument()
        expect(screen.getByText('완료')).toBeInTheDocument()
        expect(screen.getByText('정산 대기')).toBeInTheDocument()
        expect(screen.getAllByText('승인됨').length).toBeGreaterThan(0)
    })

    it('requests a revision for the active deliverable and keeps the work open', async () => {
        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByText('1차 시안 링크')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '수정 요청' }))

        await waitFor(() => expect(requestWorkRevision).toHaveBeenCalledWith(work.id, deliverable.id, step.id))
        expect(screen.getByText('수정 요청을 보냈습니다. 전문가가 다시 제출할 수 있습니다.')).toBeInTheDocument()
        expect(screen.getAllByText('수정 요청됨').length).toBeGreaterThan(0)
    })

    it('shows revision copy when experts resubmit after a revision request', async () => {
        currentUserId = 'expert-video-01'
        getWorkroomData.mockResolvedValue({
            work: revisionWork,
            steps: [revisionStep],
            deliverables: [revisionDeliverable],
        })

        render(
            <MemoryRouter initialEntries={['/workroom/work-revision-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        await waitFor(() => expect(screen.getAllByText('수정 요청됨').length).toBeGreaterThan(0))
        expect(screen.getByText('의뢰자가 수정 요청을 보냈습니다. 수정본을 다시 제출해 주세요.')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('수정본 링크'), {
            target: { value: 'https://example.com/revision-deliverable' },
        })
        fireEvent.click(screen.getByRole('button', { name: '수정본 제출하기' }))

        await waitFor(() =>
            expect(saveDeliverable).toHaveBeenCalledWith(
                expect.objectContaining({
                    workId: revisionWork.id,
                    expertId: revisionWork.expertId,
                    description: '수정본 링크',
                    externalUrl: 'https://example.com/revision-deliverable',
                    status: 'submitted',
                }),
            ),
        )
        expect(screen.getByText('수정본 링크가 등록되었습니다. 의뢰자 확인을 기다립니다.')).toBeInTheDocument()
    })
})
