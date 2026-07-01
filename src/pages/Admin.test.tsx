import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSnapshot } from '../lib/adminStorage';
import { getAdminSnapshot } from '../lib/adminStorage';
import Admin from './Admin';

const mockUseAuth = vi.fn();
const mockNavigate = vi.fn();

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
    };
});

const snapshot: AdminSnapshot = {
    source: 'local',
    profiles: [
        {
            id: 'user-admin-01',
            email: 'benet9827@gmail.com',
            name: '관리자',
            avatarUrl: '',
            isExpert: true,
            createdAt: '2026-06-01T00:00:00.000Z',
        },
    ],
    products: [
        {
            id: 'product-admin-01',
            expertId: 'expert-admin-01',
            expertName: '한석준',
            title: 'AI 영상 제작',
            category: 'ai-video-shortform',
            summary: '숏폼 제작',
            description: 'AI 숏폼 영상 제작',
            aiTools: ['Runway'],
            sampleLinks: [],
            sampleImageUrl: 'https://example.com/product.jpg',
            startingPrice: 50000,
            deliveryDays: 3,
            revisionCount: 1,
            status: 'published',
            packages: {
                standard: {
                    name: 'Standard',
                    price: 50000,
                    deliveryDays: 3,
                    revisionCount: 1,
                    included: ['영상 1개'],
                },
                deluxe: null,
                premium: null,
            },
        },
    ],
    serviceRequests: [
        {
            id: 'request-admin-01',
            title: '숏폼 의뢰',
            description: '광고 숏폼',
            budget: '',
            deadline: '2026-07-05',
            categories: [],
            createdAt: '2026-07-01T00:00:00.000Z',
            clientId: 'client-admin-01',
            expertId: 'expert-admin-01',
            status: 'pending',
            productId: 'product-admin-01',
            selectedPackage: 'standard',
        },
    ],
    proposals: [
        {
            id: 'proposal-admin-01',
            requestId: 'request-admin-01',
            clientId: 'client-admin-01',
            expertId: 'expert-admin-01',
            title: '숏폼 제안서',
            scope: '영상 제작',
            deliverables: ['영상'],
            totalPrice: 50000,
            deliveryDays: 3,
            revisionCount: 1,
            progressType: 'single',
            milestones: [],
            commercialUseAllowed: true,
            sourceFileIncluded: false,
            status: 'accepted',
            paymentStatus: 'paid',
            expiresAt: '2026-07-10T00:00:00.000Z',
        },
    ],
    works: [
        {
            id: 'work-admin-01',
            proposalId: 'proposal-admin-01',
            requestId: 'request-admin-01',
            clientId: 'client-admin-01',
            expertId: 'expert-admin-01',
            title: '숏폼 작업방',
            progressType: 'single',
            status: 'in_progress',
            totalPrice: 50000,
            settlementStatus: 'held',
            stepIds: [],
        },
    ],
    consultations: [
        {
            id: 'consultation-admin-01',
            clientId: 'client-admin-01',
            expertId: 'expert-admin-01',
            productId: 'product-admin-01',
            status: 'open',
            title: '가격 문의',
            lastMessageAt: '2026-07-01T00:00:00.000Z',
            createdAt: '2026-07-01T00:00:00.000Z',
        },
    ],
    reviews: [
        {
            id: 'review-admin-01',
            workId: 'work-admin-01',
            clientId: 'client-admin-01',
            expertId: 'expert-admin-01',
            rating: 5,
            content: '좋았습니다.',
            createdAt: '2026-07-01T00:00:00.000Z',
        },
    ],
};

describe('Admin', () => {
    beforeEach(() => {
        mockNavigate.mockReset();
        mockUseAuth.mockReturnValue({
            loading: false,
            session: { user: { id: 'user-admin-01' } },
            user: { id: 'user-admin-01', email: 'benet9827@gmail.com' },
        });
        vi.mocked(getAdminSnapshot).mockClear();
        vi.mocked(getAdminSnapshot).mockResolvedValue(snapshot);
    });

    it('renders an operation dashboard for an admin account', async () => {
        render(
            <MemoryRouter>
                <Admin />
            </MemoryRouter>,
        );

        expect(await screen.findByRole('heading', { name: '운영 관리자' })).toBeInTheDocument();
        expect(screen.getByText('전체 회원')).toBeInTheDocument();
        expect(screen.getByText('공개 상품')).toBeInTheDocument();
        expect(screen.getByText('진행 중 작업')).toBeInTheDocument();
        expect(screen.getByText('데이터: 로컬/데모')).toBeInTheDocument();
    });

    it('shows product, trade, workroom, and review data from the admin snapshot', async () => {
        render(
            <MemoryRouter>
                <Admin />
            </MemoryRouter>,
        );

        await screen.findByRole('heading', { name: '운영 관리자' });

        fireEvent.click(screen.getByRole('button', { name: /상품/ }));
        expect(screen.getByText('AI 영상 제작')).toBeInTheDocument();
        expect(screen.getByText('50,000원')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /거래/ }));
        expect(screen.getByText('의뢰서 · 숏폼 의뢰')).toBeInTheDocument();
        expect(screen.getByText('제안서 · 숏폼 제안서')).toBeInTheDocument();
        expect(screen.getByText('결제 완료')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /작업방/ }));
        expect(screen.getByText('숏폼 작업방')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /리뷰/ }));
        expect(screen.getByText('좋았습니다.')).toBeInTheDocument();
    });

    it('blocks non-admin accounts from the admin screen', async () => {
        mockUseAuth.mockReturnValue({
            loading: false,
            session: { user: { id: 'user-normal-01' } },
            user: { id: 'user-normal-01', email: 'normal@example.com' },
        });

        render(
            <MemoryRouter>
                <Admin />
            </MemoryRouter>,
        );

        expect(screen.getByRole('heading', { name: '관리자 권한이 필요합니다' })).toBeInTheDocument();
        await waitFor(() => expect(getAdminSnapshot).not.toHaveBeenCalled());
    });
});
