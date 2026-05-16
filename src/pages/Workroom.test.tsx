import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Workroom from './Workroom'

describe('Workroom', () => {
    it('shows work step statuses, deliverable submission UI, and client review actions', () => {
        render(
            <MemoryRouter initialEntries={['/workroom/work-demo-01']}>
                <Routes>
                    <Route path="/workroom/:workId" element={<Workroom />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(screen.getByRole('heading', { name: '작업 진행방' })).toBeInTheDocument()
        expect(screen.getByText('콘셉트 확인')).toBeInTheDocument()
        expect(screen.getByText('승인됨')).toBeInTheDocument()
        expect(screen.getByText('1차 영상 시안 제출')).toBeInTheDocument()
        expect(screen.getAllByText('제출됨').length).toBeGreaterThan(0)
        expect(screen.getByText('최종 제출')).toBeInTheDocument()
        expect(screen.getByText('대기')).toBeInTheDocument()
        expect(screen.getByLabelText('제출물 링크')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '제출물 링크 등록' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '결과물 승인' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '수정 요청' })).toBeInTheDocument()
    })
})
