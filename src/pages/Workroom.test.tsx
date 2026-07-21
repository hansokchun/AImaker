import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Workroom from './Workroom'
import type { Deliverable, Work, WorkDeadlineExtension, WorkStep } from '../types'

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
    platformFee: 0,
    expertPayout: 70000,
    settlementStatus: 'held',
    revisionLimit: 2,
    revisionUsed: 1,
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
    retentionConfirmed: true,
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

const saveDeliverable = vi.fn(async (savedDeliverable: Deliverable) => savedDeliverable)
const approveWorkDeliverable = vi.fn(
    async (_workId: string, _deliverableId: string, _requestId?: string, _stepId?: string) => undefined,
)
const requestWorkRevision = vi.fn(async (_workId: string, _deliverableId: string, _stepId?: string) => undefined)
const requestWorkDispute = vi.fn(async (_workId: string, _reason: string, _details: string) => undefined)
const requestWorkDeadlineExtension = vi.fn(async (
    workId: string, requesterId: string, currentDueAt: string, proposedDueAt: string, reason: string,
): Promise<WorkDeadlineExtension> => ({
    id: 'deadline-extension-01', workId, requesterId, previousDueAt: currentDueAt,
    proposedDueAt, reason, status: 'pending', createdAt: '2026-07-21T00:00:00.000Z',
}))
const respondWorkDeadlineExtension = vi.fn(async (_extensionId: string, _responderId: string, _accepted: boolean) => undefined)
const requestWorkCancellation = vi.fn(
    async (_workId: string, _requesterId: string, _reason?: 'before_start' | 'mutual_after_start') => undefined,
)
const acceptWorkCancellation = vi.fn(async (_workId: string, _actorId: string) => undefined)
const requestSettlementWithdrawal = vi.fn(async (_workId: string, _expertId: string) => undefined)
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
const getStoredProfile = vi.fn(async (_userId: string) => null)
const getWorkroomData = vi.fn(
    async (_workId: string): Promise<{ work: Work | null; steps: WorkStep[]; deliverables: Deliverable[]; deadlineExtensions?: WorkDeadlineExtension[] }> => ({
        work,
        steps: [step],
        deliverables: [deliverable],
        deadlineExtensions: [],
    }),
)

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: currentUserId, email: `${currentUserId}@example.com` },
        loading: false,
    }),
}))

vi.mock('../lib/storage', () => ({
    acceptWorkCancellation: (workId: string, actorId: string) => acceptWorkCancellation(workId, actorId),
    approveWorkDeliverable: (workId: string, deliverableId: string, requestId?: string, stepId?: string) =>
        approveWorkDeliverable(workId, deliverableId, requestId, stepId),
    getAutoPurchaseConfirmAt: (submittedAt: string) => {
        const submittedTime = Date.parse(submittedAt)
        return new Date(submittedTime + 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    getCancellationAutoCancelAt: (requestedAt: string) => {
        const requestedTime = Date.parse(requestedAt)
        return new Date(requestedTime + 24 * 60 * 60 * 1000).toISOString()
    },
    getWorkMessages: (workId: string) => getWorkMessages(workId),
    getWorkroomData: (workId: string) => getWorkroomData(workId),
    requestSettlementWithdrawal: (workId: string, expertId: string) => requestSettlementWithdrawal(workId, expertId),
    requestWorkCancellation: (workId: string, requesterId: string, reason?: 'before_start' | 'mutual_after_start') =>
        requestWorkCancellation(workId, requesterId, reason),
    requestWorkRevision: (workId: string, deliverableId: string, stepId?: string) =>
        requestWorkRevision(workId, deliverableId, stepId),
    requestWorkDispute: (workId: string, reason: string, details: string) => requestWorkDispute(workId, reason, details),
    requestWorkDeadlineExtension: (workId: string, requesterId: string, currentDueAt: string, proposedDueAt: string, reason: string) =>
        requestWorkDeadlineExtension(workId, requesterId, currentDueAt, proposedDueAt, reason),
    respondWorkDeadlineExtension: (extensionId: string, responderId: string, accepted: boolean) =>
        respondWorkDeadlineExtension(extensionId, responderId, accepted),
    saveDeliverable: (deliverable: Deliverable) => saveDeliverable(deliverable),
    saveWorkMessage: (message: { workId: string; senderId: string; body: string }) => saveWorkMessage(message),
    getUserDisplayProfile: (userId: string) => getUserDisplayProfile(userId),
    getStoredProfile: (userId: string) => getStoredProfile(userId),
}))

describe('Workroom', () => {
    beforeEach(() => {
        currentUserId = 'client-demo-01'
        getWorkroomData.mockReset()
        getWorkroomData.mockResolvedValue({ work, steps: [step], deliverables: [deliverable], deadlineExtensions: [] })
        approveWorkDeliverable.mockClear()
        requestWorkRevision.mockClear()
        requestWorkDispute.mockClear()
        requestWorkDeadlineExtension.mockClear()
        respondWorkDeadlineExtension.mockClear()
        saveDeliverable.mockClear()
        requestWorkCancellation.mockClear()
        acceptWorkCancellation.mockClear()
        requestSettlementWithdrawal.mockClear()
        getWorkMessages.mockClear()
        saveWorkMessage.mockClear()
        getUserDisplayProfile.mockClear()
        getStoredProfile.mockClear()
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
        expect(screen.getByText('흐름설계')).toBeInTheDocument()
        expect(screen.getByText('결과물 제출')).toBeInTheDocument()
        expect(screen.getByText('결과물 승인 및 정산')).toBeInTheDocument()
        expect(screen.queryByText('콘셉트 확인')).not.toBeInTheDocument()
        expect(screen.getByLabelText('흐름설계 단계 상태: 완료')).toBeInTheDocument()
        expect(screen.getByLabelText('결과물 제출 단계 상태: 완료')).toBeInTheDocument()
        expect(screen.getByLabelText('결과물 승인 및 정산 단계 상태: 진행 중')).toBeInTheDocument()
        expect(screen.queryByText('1차 시안 링크')).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'https://example.com/deliverables/ai-shortform-draft' })).toHaveAttribute(
            'href',
            'https://example.com/deliverables/ai-shortform-draft',
        )
        expect(screen.getByLabelText('제출됨')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '결제/정산' })).toBeInTheDocument()
        expect(screen.getByText('결제 완료')).toBeInTheDocument()
        expect(screen.getByText('70,000원')).toBeInTheDocument()
        expect(screen.getByText('일픽 수수료 0원')).toBeInTheDocument()
        expect(screen.getByText('전문가 정산 예정 70,000원')).toBeInTheDocument()
        expect(screen.getByText('작업 진행 중 보관')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('제출물 링크'), {
            target: { value: 'https://example.com/new-deliverable' },
        })
        fireEvent.click(screen.getByRole('checkbox', { name: /모든 버전을 정산 완료까지 보관합니다/ }))
        fireEvent.click(screen.getByRole('button', { name: '제출물 링크 등록' }))

        await waitFor(() =>
            expect(saveDeliverable).toHaveBeenCalledWith(
                expect.objectContaining({
                    workId: work.id,
                    expertId: work.expertId,
                    externalUrl: 'https://example.com/new-deliverable',
                    retentionConfirmed: true,
                    status: 'submitted',
                }),
            ),
        )
        expect(screen.getByText('제출물 링크가 등록되었습니다.')).toBeInTheDocument()
    })

    it('uses the persisted deliverable id returned by the save call', async () => {
        currentUserId = 'expert-video-01'
        saveDeliverable.mockResolvedValueOnce({
            ...deliverable,
            id: 'deliverable-db-01',
            externalUrl: 'https://example.com/new-deliverable',
            submittedAt: '2026-07-13T00:00:00.000Z',
        })

        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        await screen.findByRole('heading', { name: '작업 진행방' })
        fireEvent.change(screen.getByLabelText('제출물 링크'), {
            target: { value: 'https://example.com/new-deliverable' },
        })
        fireEvent.click(screen.getByRole('checkbox', { name: /모든 버전을 정산 완료까지 보관합니다/ }))
        fireEvent.click(screen.getByRole('button', { name: '제출물 링크 등록' }))

        await waitFor(() => expect(screen.getByText('https://example.com/new-deliverable')).toBeInTheDocument())
        expect(saveDeliverable).toHaveBeenCalledWith(expect.objectContaining({ id: expect.stringMatching(/^deliverable-/) }))
        expect(screen.getByText('https://example.com/new-deliverable').closest('a')).toHaveAttribute(
            'href',
            'https://example.com/new-deliverable',
        )
    })

    it('blocks unsafe deliverable URL schemes before saving', async () => {
        currentUserId = 'expert-video-01'

        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        await screen.findByRole('heading', { name: '작업 진행방' })
        fireEvent.change(screen.getByLabelText('제출물 링크'), {
            target: { value: 'javascript:alert(1)' },
        })
        fireEvent.click(screen.getByRole('checkbox', { name: /모든 버전을 정산 완료까지 보관합니다/ }))
        fireEvent.click(screen.getByRole('button', { name: '제출물 링크 등록' }))

        expect(screen.getByText('http:// 또는 https://로 시작하는 제출물 링크만 등록할 수 있습니다.')).toBeInTheDocument()
        expect(saveDeliverable).not.toHaveBeenCalled()
    })

    it('requires the expert to confirm version retention before submission', async () => {
        currentUserId = 'expert-video-01'

        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        await screen.findByRole('heading', { name: '작업 진행방' })
        fireEvent.change(screen.getByLabelText('제출물 링크'), {
            target: { value: 'https://example.com/shared-folder' },
        })
        fireEvent.click(screen.getByRole('button', { name: '제출물 링크 등록' }))

        expect(screen.getByText('이전 작업물을 정산 완료까지 보관한다는 확인이 필요합니다.')).toBeInTheDocument()
        expect(saveDeliverable).not.toHaveBeenCalled()
    })

    it('shows previous submissions even when the same folder link is reused', async () => {
        getWorkroomData.mockResolvedValue({
            work,
            steps: [step],
            deliverables: [
                { ...deliverable, id: 'deliverable-v2', submittedAt: '2026-06-02T00:00:00.000Z' },
                { ...deliverable, id: 'deliverable-v1', submittedAt: '2026-06-01T00:00:00.000Z' },
            ],
        })

        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        await screen.findByRole('heading', { name: '이전 제출 이력' })
        expect(screen.getByText('1차 제출')).toBeInTheDocument()
        expect(screen.getAllByRole('link', { name: deliverable.externalUrl }).length).toBe(2)
        expect(screen.getByText('제출됨 · 버전 보관 확인됨')).toBeInTheDocument()
    })

    it('does not render unsafe stored deliverable URLs as links', async () => {
        getWorkroomData.mockResolvedValue({
            work,
            steps: [step],
            deliverables: [{ ...deliverable, externalUrl: 'javascript:alert(1)' }],
        })

        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        await screen.findByRole('heading', { name: '작업 진행방' })

        expect(screen.queryByRole('link', { name: 'javascript:alert(1)' })).not.toBeInTheDocument()
        expect(screen.getByLabelText('제출됨')).toBeInTheDocument()
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
        expect(screen.getByRole('link', { name: '내 작업에서 전체 진행 보기' })).toHaveAttribute(
            'href',
            '/my-work?role=client&panel=client&clientOrder=request-demo-01',
        )
        expect(screen.getByRole('button', { name: '거래 취소 요청' })).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('프로젝트 메시지'), {
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

        fireEvent.click(screen.getByRole('button', { name: '거래 취소 요청' }))
        await waitFor(() => expect(requestWorkCancellation).toHaveBeenCalledWith(work.id, currentUserId, 'mutual_after_start'))
        expect(await screen.findByText('거래 취소 요청을 보냈습니다. 상대방이 수락하거나 24시간 응답이 없으면 취소됩니다.')).toBeInTheDocument()
    })

    it('blocks off-platform payment attempts before sending a workroom message', async () => {
        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        await screen.findByText('Workroom message from client')
        const input = screen.getByLabelText('프로젝트 메시지')
        fireEvent.change(input, {
            target: { value: '수수료 아까우니 계좌이체로 따로 거래해요.' },
        })
        fireEvent.click(screen.getByRole('button', { name: '메시지 보내기' }))

        expect(await screen.findByText('연락처나 외부 결제 유도 문구가 포함되어 있어 메시지를 보낼 수 없습니다.')).toBeInTheDocument()
        expect(saveWorkMessage).not.toHaveBeenCalled()
        expect(input).toHaveValue('수수료 아까우니 계좌이체로 따로 거래해요.')
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
        expect(screen.getByText('수정 요청 1/2회 사용')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '결과물 승인' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '수정 요청' })).toBeInTheDocument()
        expect(screen.getByText('응답이 없으면 2026년 6월 8일 자동 구매확정됩니다. 수정이 필요하면 자동확정 전에 수정 요청을 보내주세요.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '제출물 링크 등록' })).not.toBeInTheDocument()
        expect(screen.queryByText('제출물 링크 등록은 작업자만 할 수 있습니다.')).not.toBeInTheDocument()
    })

    it('disables revision requests when the agreed revision count is exhausted', async () => {
        currentUserId = 'client-demo-01'
        getWorkroomData.mockResolvedValue({
            work: { ...work, revisionLimit: 1, revisionUsed: 1 },
            steps: [step],
            deliverables: [deliverable],
        })

        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByText('수정 요청 1/1회 사용')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '수정 요청' })).toBeDisabled()
        expect(screen.getByText('제안서에 포함된 수정 요청 횟수를 모두 사용했습니다.')).toBeInTheDocument()
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

    it('uses an icon-only empty state when there are no workroom messages', async () => {
        getWorkMessages.mockResolvedValue([])

        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByLabelText('프로젝트 메시지 없음')).toBeInTheDocument()
        expect(screen.queryByText('아직 프로젝트 메시지가 없습니다.')).not.toBeInTheDocument()
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
        expect(screen.getByText('흐름설계')).toBeInTheDocument()
        expect(screen.getByText('결과물 제출')).toBeInTheDocument()
        expect(screen.getByText('결과물 승인 및 정산')).toBeInTheDocument()
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

        expect(await screen.findByText('프로젝트를 찾을 수 없습니다.')).toBeInTheDocument()
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

        expect(
            await screen.findByRole('link', { name: 'https://example.com/deliverables/ai-shortform-draft' }),
        ).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '결과물 승인' }))

        await waitFor(() =>
            expect(approveWorkDeliverable).toHaveBeenCalledWith(work.id, deliverable.id, work.requestId, step.id),
        )
        expect(screen.getByText('결과물을 승인했습니다. 작업이 완료되었습니다.')).toBeInTheDocument()
        expect(screen.getAllByText('완료').length).toBeGreaterThan(0)
        expect(screen.getByText('정산 대기')).toBeInTheDocument()
        expect(screen.getByLabelText('승인됨')).toBeInTheDocument()
    })

    it('requests a revision for the active deliverable and keeps the work open', async () => {
        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(
            await screen.findByRole('link', { name: 'https://example.com/deliverables/ai-shortform-draft' }),
        ).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '수정 요청' }))

        await waitFor(() => expect(requestWorkRevision).toHaveBeenCalledWith(work.id, deliverable.id, step.id))
        expect(screen.getByText('수정 요청을 보냈습니다. 전문가가 다시 제출할 수 있습니다.')).toBeInTheDocument()
        expect(screen.getByText('수정 요청 2/2회 사용')).toBeInTheDocument()
        expect(screen.getAllByText('수정 요청됨').length).toBeGreaterThan(0)
    })

    it('holds settlement and freezes the work when a participant opens a dispute', async () => {
        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes><Route path="/workroom/:workId" element={<Workroom />} /></Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('button', { name: '분쟁 신청' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '분쟁 신청' }))
        fireEvent.change(screen.getByLabelText('합의 내용과 다른 점'), {
            target: { value: '제안서에 적힌 세로 영상 파일이 제출물에 없습니다.' },
        })
        fireEvent.click(screen.getByRole('button', { name: '분쟁 접수하기' }))

        await waitFor(() => expect(requestWorkDispute).toHaveBeenCalledWith(
            work.id,
            'scope_mismatch',
            '제안서에 적힌 세로 영상 파일이 제출물에 없습니다.',
        ))
        expect(screen.getByText(/분쟁을 접수했습니다/)).toBeInTheDocument()
        expect(screen.getByText(/분쟁 처리 중입니다/)).toBeInTheDocument()
        expect(screen.getByText('정산 보류: 분쟁 접수로 정산 보류')).toBeInTheDocument()
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
        fireEvent.click(screen.getByRole('checkbox', { name: /모든 버전을 정산 완료까지 보관합니다/ }))
        fireEvent.click(screen.getByRole('button', { name: '수정본 제출하기' }))

        await waitFor(() =>
            expect(saveDeliverable).toHaveBeenCalledWith(
                expect.objectContaining({
                    workId: revisionWork.id,
                    expertId: revisionWork.expertId,
                    description: '수정본 링크',
                    externalUrl: 'https://example.com/revision-deliverable',
                    retentionConfirmed: true,
                    status: 'submitted',
                }),
            ),
        )
        expect(screen.getByText('수정본 링크가 등록되었습니다. 의뢰자 확인을 기다립니다.')).toBeInTheDocument()
    })

    it('records a deadline extension request without changing the official deadline', async () => {
        const workWithDeadline = { ...work, deliveryDueAt: '2026-08-01T09:00:00.000Z' }
        getWorkroomData.mockResolvedValue({ work: workWithDeadline, steps: [step], deliverables: [deliverable], deadlineExtensions: [] })
        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes><Route path="/workroom/:workId" element={<Workroom />} /></Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByLabelText('납기 연장 합의')).toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('새 납기'), { target: { value: '2026-08-03T18:00' } })
        fireEvent.change(screen.getByLabelText('연장 사유'), { target: { value: '추가 자료 전달이 늦어져 이틀 연장이 필요합니다.' } })
        fireEvent.click(screen.getByRole('button', { name: '납기 연장 요청' }))

        await waitFor(() => expect(requestWorkDeadlineExtension).toHaveBeenCalledWith(
            work.id,
            work.clientId,
            workWithDeadline.deliveryDueAt,
            new Date('2026-08-03T18:00').toISOString(),
            '추가 자료 전달이 늦어져 이틀 연장이 필요합니다.',
        ))
        expect(screen.getByText('연장 요청 대기 중')).toBeInTheDocument()
        expect(screen.getByText(/상대방이 수락해야 공식 납기가 변경됩니다/)).toBeInTheDocument()
    })

    it('lets only the counterpart accept a pending deadline extension', async () => {
        const pendingExtension: WorkDeadlineExtension = {
            id: 'deadline-extension-pending', workId: work.id, requesterId: work.expertId,
            previousDueAt: '2026-08-01T09:00:00.000Z', proposedDueAt: '2026-08-03T09:00:00.000Z',
            reason: '작업 범위가 추가되어 이틀 연장이 필요합니다.', status: 'pending', createdAt: '2026-07-21T00:00:00.000Z',
        }
        getWorkroomData.mockResolvedValue({
            work: { ...work, deliveryDueAt: pendingExtension.previousDueAt },
            steps: [step], deliverables: [deliverable], deadlineExtensions: [pendingExtension],
        })
        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes><Route path="/workroom/:workId" element={<Workroom />} /></Routes>
            </MemoryRouter>,
        )

        expect(await screen.findByRole('button', { name: '수락' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '수락' }))
        await waitFor(() => expect(respondWorkDeadlineExtension).toHaveBeenCalledWith(
            pendingExtension.id, work.clientId, true,
        ))
        expect(screen.getByText('새 납기에 합의했습니다.')).toBeInTheDocument()
        expect(screen.getByText('합의된 납기 연장 1회')).toBeInTheDocument()
    })
})
