import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Workroom from './Workroom'
import type { Deliverable, Work, WorkStep } from '../types'

const work: Work = {
    id: 'work-demo-01',
    proposalId: 'proposal-demo-01',
    requestId: 'request-demo-01',
    clientId: 'client-demo-01',
    expertId: 'expert-video-01',
    title: 'AI 숏폼 영상 1차 제작',
    progressType: 'milestone',
    status: 'submitted',
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

const saveDeliverable = vi.fn(async () => undefined)
const approveWorkDeliverable = vi.fn(async () => undefined)
const getWorkroomData = vi.fn(async () => ({ work, steps: [step], deliverables: [deliverable] }))

vi.mock('../lib/storage', () => ({
    approveWorkDeliverable: (...args: unknown[]) => approveWorkDeliverable(...args),
    getWorkroomData: (...args: unknown[]) => getWorkroomData(...args),
    saveDeliverable: (...args: unknown[]) => saveDeliverable(...args),
}))

describe('Workroom', () => {
    beforeEach(() => {
        getWorkroomData.mockReset()
        getWorkroomData.mockResolvedValue({ work, steps: [step], deliverables: [deliverable] })
        approveWorkDeliverable.mockClear()
        saveDeliverable.mockClear()
    })

    it('loads workroom data and saves deliverable links', async () => {
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

        await waitFor(() => expect(approveWorkDeliverable).toHaveBeenCalledWith(work.id, deliverable.id))
        expect(screen.getByText('결과물을 승인했습니다. 작업이 완료되었습니다.')).toBeInTheDocument()
        expect(screen.getByText('완료')).toBeInTheDocument()
    })
})
