import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Report from './Report'
import type { AdminReportSeverity, AdminReportTargetType } from '../lib/adminStorage'

const saveReport = vi.fn(async (_input: {
    readonly reporterId: string;
    readonly targetType: AdminReportTargetType;
    readonly targetId?: string;
    readonly reason: string;
    readonly severity?: AdminReportSeverity;
}) => ({
    id: 'report-user-01',
    reporterId: 'user-demo-01',
    targetType: 'user' as const,
    targetId: 'target-user-01',
    reason: '부적절한 메시지를 받았습니다.',
    status: 'pending' as const,
    severity: 'medium' as const,
    createdAt: '2026-07-06T00:00:00.000Z',
}))

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-demo-01', email: 'demo@example.com' },
        loading: false,
    }),
}))

vi.mock('../lib/storage', () => ({
    saveReport: (input: {
        readonly reporterId: string;
        readonly targetType: AdminReportTargetType;
        readonly targetId?: string;
        readonly reason: string;
        readonly severity?: AdminReportSeverity;
    }) => saveReport(input),
}))

describe('Report', () => {
    beforeEach(() => {
        saveReport.mockClear()
    })

    it('submits a simple report to the admin queue', async () => {
        render(
            <MemoryRouter initialEntries={['/report']}>
                <Routes>
                    <Route path="/report" element={<Report />} />
                </Routes>
            </MemoryRouter>,
        )

        expect(screen.getByRole('heading', { name: '신고하기' })).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('신고 유형'), { target: { value: 'product' } })
        fireEvent.change(screen.getByLabelText('신고 대상 ID'), { target: { value: 'product-01' } })
        fireEvent.change(screen.getByLabelText('신고 내용'), { target: { value: '상품 설명과 다른 결과물을 받았습니다.' } })
        fireEvent.click(screen.getByRole('button', { name: '신고 접수' }))

        await waitFor(() => expect(saveReport).toHaveBeenCalledWith({
            reporterId: 'user-demo-01',
            targetType: 'product',
            targetId: 'product-01',
            reason: '상품 설명과 다른 결과물을 받았습니다.',
            severity: 'medium',
        }))
        expect(await screen.findByText('신고가 접수되었습니다. 관리자가 내용을 확인합니다.')).toBeInTheDocument()
    })
})
