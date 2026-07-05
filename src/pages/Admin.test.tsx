import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminSnapshot, saveAdminAction } from '../lib/adminStorage';
import Admin from './Admin';
import { adminSnapshot } from './adminTestFixtures';

const mockUseAuth = vi.fn();
const mockNavigate = vi.fn();

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

    it('renders an operation dashboard for an admin account', async () => {
        render(<MemoryRouter><Admin /></MemoryRouter>);

        expect(await screen.findByRole('heading', { name: '운영 관리자' })).toBeInTheDocument();
        expect(screen.getByText('전체 회원')).toBeInTheDocument();
        expect(screen.getByText('공개 상품')).toBeInTheDocument();
        expect(screen.getByText('진행 중 작업')).toBeInTheDocument();
        expect(screen.getByText('데이터: 로컬/데모')).toBeInTheDocument();
        expect(screen.getByLabelText('관리자 검색')).toBeInTheDocument();
    });

    it('shows product, trade, workroom, and review data from the admin snapshot', async () => {
        render(<MemoryRouter><Admin /></MemoryRouter>);
        await screen.findByRole('heading', { name: '운영 관리자' });

        clickAdminTab(2);
        expect(screen.getByText('AI 영상 제작')).toBeInTheDocument();
        expect(screen.getByText('50,000원')).toBeInTheDocument();

        clickAdminTab(3);
        expect(screen.getByText('의뢰서 · 숏폼 의뢰')).toBeInTheDocument();
        expect(screen.getByText('제안서 · 숏폼 제안서')).toBeInTheDocument();

        clickAdminTab(5);
        expect(screen.getByText('숏폼 작업방')).toBeInTheDocument();

        clickAdminTab(6);
        expect(screen.getByText('좋았습니다.')).toBeInTheDocument();
    });

    it('filters admin records by search query and status', async () => {
        render(<MemoryRouter><Admin /></MemoryRouter>);
        await screen.findByRole('heading', { name: '운영 관리자' });

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

        expect(screen.getByRole('heading', { name: '관리자 권한이 필요합니다' })).toBeInTheDocument();
        await waitFor(() => expect(getAdminSnapshot).not.toHaveBeenCalled());
    });

    it('shows consultation and workroom message contents to admins', async () => {
        render(<MemoryRouter><Admin /></MemoryRouter>);
        await screen.findByRole('heading', { name: '운영 관리자' });

        clickAdminTab(4);
        expect(screen.getByText('Need price estimate for shortform.')).toBeInTheDocument();

        clickAdminTab(5);
        expect(screen.getByText('Draft delivery is ready.')).toBeInTheDocument();
    });

    it('records moderation actions from the admin screen', async () => {
        render(<MemoryRouter><Admin /></MemoryRouter>);
        await screen.findByRole('heading', { name: '운영 관리자' });

        clickAdminTab(1);
        fireEvent.click(screen.getByRole('button', { name: '경고 기록' }));

        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'user',
            targetId: 'user-admin-01',
            actionType: 'warn',
            reason: '관리자가 회원 경고를 기록했습니다.',
        }));
        expect(await screen.findByText('운영 조치가 처리되었습니다.')).toBeInTheDocument();
    });

    it('runs product hiding from the admin product panel', async () => {
        render(<MemoryRouter><Admin /></MemoryRouter>);
        await screen.findByRole('heading', { name: '운영 관리자' });

        clickAdminTab(2);
        fireEvent.click(screen.getByRole('button', { name: '상품 숨김 처리' }));

        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'product',
            targetId: 'product-admin-01',
            actionType: 'hide_product',
            reason: '관리자가 상품 숨김 처리를 실행했습니다.',
        }));
    });

    it('runs product restore, featuring, and placement actions from the admin product panel', async () => {
        render(<MemoryRouter><Admin /></MemoryRouter>);
        await screen.findByRole('heading', { name: '운영 관리자' });

        clickAdminTab(2);
        fireEvent.click(screen.getByRole('button', { name: '상품 공개 복구' }));

        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'product',
            targetId: 'product-admin-02',
            actionType: 'restore_product',
            reason: '관리자가 숨김 상품을 다시 공개했습니다.',
        }));

        fireEvent.click(screen.getAllByRole('button', { name: '상단 추천 지정' })[0]);
        fireEvent.click(screen.getAllByRole('button', { name: '배치 올리기' })[1]);

        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'product',
            targetId: 'product-admin-01',
            actionType: 'feature_product',
            reason: '관리자가 상품을 상단 추천으로 지정했습니다.',
        }));
        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'product',
            targetId: 'product-admin-01',
            actionType: 'move_product_up',
            reason: '관리자가 상품 배치를 올렸습니다.',
        }));
    });

    it('runs member restriction and release actions from the admin member panel', async () => {
        render(<MemoryRouter><Admin /></MemoryRouter>);
        await screen.findByRole('heading', { name: '운영 관리자' });

        clickAdminTab(1);
        fireEvent.click(screen.getByRole('button', { name: '활동 제한' }));

        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'user',
            targetId: 'user-admin-01',
            actionType: 'restrict',
            reason: '관리자가 회원 활동을 제한했습니다.',
        }));
        expect(await screen.findByText('활동 제한됨')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '제한 해제' }));

        await waitFor(() => expect(saveAdminAction).toHaveBeenCalledWith({
            adminId: 'user-admin-01',
            targetType: 'user',
            targetId: 'user-admin-01',
            actionType: 'release_restriction',
            reason: '관리자가 회원 활동 제한을 해제했습니다.',
        }));
    });

    it('runs work cancellation from the admin workroom panel', async () => {
        render(<MemoryRouter><Admin /></MemoryRouter>);
        await screen.findByRole('heading', { name: '운영 관리자' });

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
});
