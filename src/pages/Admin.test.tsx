import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminSnapshot, saveAdminAction } from '../lib/adminStorage';
import Admin from './Admin';
import { adminSnapshot } from './adminTestFixtures';

const mockUseAuth = vi.fn();
const mockNavigate = vi.fn();

const renderAdmin = async () => {
    render(<MemoryRouter><Admin /></MemoryRouter>);
    await waitFor(() => expect(getAdminSnapshot).toHaveBeenCalled());
};

const clickAdminTab = (index: number) => {
    fireEvent.click(screen.getAllByRole('button')[index]);
};

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

vi.mock('../lib/adminStorage', async () => {
    const actual = await vi.importActual<typeof import('../lib/adminStorage')>('../lib/adminStorage');
    return {
        ...actual,
        getAdminSnapshot: vi.fn(),
        saveAdminAction: vi.fn(),
    };
});

describe('Admin', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockUseAuth.mockReturnValue({
            loading: false,
            session: { user: { id: 'user-admin-01' } },
            user: { id: 'user-admin-01', email: 'benet9827@gmail.com' },
        });
        vi.mocked(getAdminSnapshot).mockClear();
        vi.mocked(getAdminSnapshot).mockResolvedValue(adminSnapshot);
        vi.mocked(saveAdminAction).mockClear();
        vi.mocked(saveAdminAction).mockImplementation(async (input) => ({
            id: 'admin-action-test-01',
            adminId: input.adminId,
            targetType: input.targetType,
            targetId: input.targetId,
            actionType: input.actionType,
            reason: input.reason,
            createdAt: '2026-07-01T00:30:00.000Z',
        }));
    });

    it('renders admin data panels for an admin account', async () => {
        await renderAdmin();

        clickAdminTab(2);
        expect(screen.getByText('AI 영상 제작')).toBeInTheDocument();
        expect(screen.getByText('50,000원')).toBeInTheDocument();

        clickAdminTab(5);
        expect(screen.getByText('숏폼 작업방')).toBeInTheDocument();
        expect(screen.getByText('Draft delivery is ready.')).toBeInTheDocument();

        clickAdminTab(6);
        expect(screen.getByText('좋았습니다.')).toBeInTheDocument();
    });

    it('filters admin records by search query and status', async () => {
        await renderAdmin();

        fireEvent.change(screen.getByLabelText('관리자 검색'), { target: { value: 'price estimate' } });
        clickAdminTab(4);

        expect(screen.getByText('Need price estimate for shortform.')).toBeInTheDocument();
        clickAdminTab(2);
        expect(screen.queryByText('AI 영상 제작')).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('관리자 검색'), { target: { value: '' } });
        fireEvent.change(screen.getByLabelText('상태 필터'), { target: { value: 'in_progress' } });
        clickAdminTab(5);

        expect(screen.getByText('숏폼 작업방')).toBeInTheDocument();
        clickAdminTab(2);
        expect(screen.queryByText('AI 영상 제작')).not.toBeInTheDocument();
    });

    it('blocks non-admin accounts from the admin screen', async () => {
        mockUseAuth.mockReturnValue({
            loading: false,
            session: { user: { id: 'user-normal-01' } },
            user: { id: 'user-normal-01', email: 'normal@example.com' },
        });

        render(<MemoryRouter><Admin /></MemoryRouter>);

        await waitFor(() => expect(getAdminSnapshot).not.toHaveBeenCalled());
    });

    it('records member, product, report, and work moderation actions', async () => {
        await renderAdmin();

        clickAdminTab(1);
        fireEvent.click(screen.getByRole('button', { name: '경고 기록' }));
        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'user',
            targetId: 'user-admin-01',
            actionType: 'warn',
            reason: '관리자가 회원 경고를 기록했습니다.',
        }));

        clickAdminTab(2);
        fireEvent.click(screen.getByRole('button', { name: '상품 숨김 처리' }));
        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'product',
            targetId: 'product-admin-01',
            actionType: 'hide_product',
            reason: '관리자가 상품 숨김 처리를 실행했습니다.',
        }));

        clickAdminTab(7);
        fireEvent.click(screen.getByRole('button', { name: '검토 완료' }));
        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'report',
            targetId: 'report-admin-01',
            actionType: 'resolve_report',
            reason: '관리자가 신고 항목을 검토 완료 처리했습니다.',
        }));

        clickAdminTab(5);
        fireEvent.click(screen.getByRole('button', { name: '거래 중단 처리' }));
        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'work',
            targetId: 'work-admin-01',
            actionType: 'cancel_trade',
            reason: '관리자가 작업방 거래 중단 처리를 실행했습니다.',
        }));
    });

    it('hides and restores reviews from the admin review panel', async () => {
        await renderAdmin();

        clickAdminTab(6);
        fireEvent.click(screen.getByRole('button', { name: '리뷰 숨김 처리' }));

        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'review',
            targetId: 'review-admin-01',
            actionType: 'hide_review',
            reason: '관리자가 리뷰를 숨김 처리했습니다.',
        }));
        await waitFor(() => expect(screen.getAllByText('숨김').length).toBeGreaterThan(0));

        fireEvent.click(screen.getByRole('button', { name: '리뷰 공개 복구' }));

        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'review',
            targetId: 'review-admin-01',
            actionType: 'restore_review',
            reason: '관리자가 숨김 리뷰를 공개 복구했습니다.',
        }));
    });

    it('runs settlement, refund, and dispute actions from the admin workroom panel', async () => {
        await renderAdmin();

        clickAdminTab(5);
        fireEvent.click(screen.getByRole('button', { name: '정산 대기 처리' }));
        fireEvent.click(screen.getByRole('button', { name: '분쟁 열기' }));
        fireEvent.click(screen.getByRole('button', { name: '환불 대기 처리' }));

        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'work',
            targetId: 'work-admin-01',
            actionType: 'mark_settlement_pending',
            reason: '관리자가 작업방을 정산 대기 상태로 변경했습니다.',
        }));
        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'work',
            targetId: 'work-admin-01',
            actionType: 'open_dispute',
            reason: '관리자가 작업방 분쟁 관리를 시작했습니다.',
        }));
        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'work',
            targetId: 'work-admin-01',
            actionType: 'mark_refund_pending',
            reason: '관리자가 수수료 제외 환불 대기 상태로 변경했습니다.',
        }));
    });

    it('surfaces policy violating messages and records a sender warning', async () => {
        await renderAdmin();

        clickAdminTab(7);

        expect(screen.getByText('Please contact me at client@example.com outside the platform.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '작성자 경고' }));

        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'user',
            targetId: 'client-admin-01',
            actionType: 'warn',
            reason: '관리자가 외부 연락처 공유 의심 메시지에 대해 작성자 경고를 기록했습니다.',
        }));
    });
});
