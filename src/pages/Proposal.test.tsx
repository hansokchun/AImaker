import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Proposal from './Proposal'

describe('Proposal', () => {
    it('shows proposal delivery information and actions', () => {
        render(
            <MemoryRouter initialEntries={['/proposal/proposal-demo-01']}>
                <Routes>
                    <Route path="/proposal/:proposalId" element={<Proposal />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(screen.getByRole('heading', { name: '거래 제안서' })).toBeInTheDocument()
        expect(screen.getByText('최종 금액')).toBeInTheDocument()
        expect(screen.getByText('70,000원')).toBeInTheDocument()
        expect(screen.getByText('작업 범위')).toBeInTheDocument()
        expect(screen.getByText('작업 기간')).toBeInTheDocument()
        expect(screen.getByText('제출물')).toBeInTheDocument()
        expect(screen.getByText('수정 횟수')).toBeInTheDocument()
        expect(screen.getByText('제안 유효기간은 발송일로부터 3일입니다.')).toBeInTheDocument()
        expect(screen.getByText('승인 전에는 작업이 시작되지 않습니다.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '승인하기' })).toBeEnabled()
        expect(screen.getByRole('button', { name: '수정 요청' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument()
    })

    it('disables approval for expired proposals', () => {
        render(
            <MemoryRouter initialEntries={['/proposal/proposal-expired-01']}>
                <Routes>
                    <Route path="/proposal/:proposalId" element={<Proposal />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(screen.getByText('만료된 제안서입니다.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '승인하기' })).toBeDisabled()
    })
})
