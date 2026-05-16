import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
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

vi.mock('../lib/storage', () => ({
    getWorkroomData: vi.fn(async () => ({ work, steps: [step], deliverables: [deliverable] })),
    saveDeliverable: (...args: unknown[]) => saveDeliverable(...args),
}))

describe('Workroom', () => {
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
})
