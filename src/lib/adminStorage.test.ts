import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExpertProduct, Work } from '../types';

vi.mock('./supabase', () => ({ supabase: null }));
vi.mock('../data/mockData', () => ({ mockExpertProducts: [] }));

const product: ExpertProduct = {
    id: 'product-admin-hide-01',
    expertId: 'expert-admin-01',
    expertName: 'Admin Expert',
    title: 'Admin hidden product',
    category: 'ai-video-shortform',
    summary: 'summary',
    description: 'description',
    sampleLinks: [],
    sampleImageUrl: '',
    startingPrice: 50000,
    deliveryDays: 3,
    revisionCount: 1,
    status: 'published',
    displayOrder: 2,
    isFeatured: false,
    packages: {
        standard: {
            name: 'Standard',
            price: 50000,
            deliveryDays: 3,
            revisionCount: 1,
            included: ['one output'],
        },
        deluxe: null,
        premium: null,
    },
};

const secondProduct: ExpertProduct = {
    ...product,
    id: 'product-admin-hide-02',
    title: 'Admin second product',
    displayOrder: 1,
};

const work: Work = {
    id: 'work-admin-cancel-01',
    proposalId: 'proposal-admin-01',
    requestId: 'request-admin-01',
    clientId: 'client-admin-01',
    expertId: 'expert-admin-01',
    title: 'Admin cancellable work',
    progressType: 'single',
    status: 'in_progress',
    totalPrice: 50000,
    settlementStatus: 'held',
    stepIds: [],
};

describe('adminStorage', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.resetModules();
    });

    it('hides a product when an admin records a hide product action', async () => {
        localStorage.setItem('ai_products', JSON.stringify([product]));
        const { saveAdminAction } = await import('./adminStorage');

        await saveAdminAction({
            adminId: 'admin-user-01',
            targetType: 'product',
            targetId: product.id,
            actionType: 'hide_product',
            reason: '관리자가 상품을 숨겼습니다.',
        });

        const storedProducts = JSON.parse(localStorage.getItem('ai_products') || '[]') as ExpertProduct[];
        expect(storedProducts[0]?.status).toBe('hidden');
    });

    it('restricts a member profile when an admin records a restrict action', async () => {
        localStorage.setItem('ai_profile_user-admin-restrict-01', JSON.stringify({ name: 'Restricted member' }));
        const { saveAdminAction } = await import('./adminStorage');

        await saveAdminAction({
            adminId: 'admin-user-01',
            targetType: 'user',
            targetId: 'user-admin-restrict-01',
            actionType: 'restrict',
            reason: '관리자가 회원 활동을 제한했습니다.',
        });

        const storedProfile = JSON.parse(localStorage.getItem('ai_profile_user-admin-restrict-01') || '{}') as { moderationStatus?: string };
        expect(storedProfile.moderationStatus).toBe('restricted');
    });

    it('restores and features a product from admin product actions', async () => {
        localStorage.setItem('ai_products', JSON.stringify([{ ...product, status: 'hidden' }]));
        const { saveAdminAction } = await import('./adminStorage');

        await saveAdminAction({
            adminId: 'admin-user-01',
            targetType: 'product',
            targetId: product.id,
            actionType: 'restore_product',
            reason: '관리자가 상품을 다시 공개했습니다.',
        });
        await saveAdminAction({
            adminId: 'admin-user-01',
            targetType: 'product',
            targetId: product.id,
            actionType: 'feature_product',
            reason: '관리자가 상품을 상단 추천으로 지정했습니다.',
        });

        const storedProducts = JSON.parse(localStorage.getItem('ai_products') || '[]') as ExpertProduct[];
        expect(storedProducts[0]?.status).toBe('published');
        expect(storedProducts[0]?.isFeatured).toBe(true);
    });

    it('moves a product earlier in the admin product display order', async () => {
        localStorage.setItem('ai_products', JSON.stringify([product, secondProduct]));
        const { saveAdminAction } = await import('./adminStorage');

        await saveAdminAction({
            adminId: 'admin-user-01',
            targetType: 'product',
            targetId: product.id,
            actionType: 'move_product_up',
            reason: '관리자가 상품 배치를 올렸습니다.',
        });

        const storedProducts = JSON.parse(localStorage.getItem('ai_products') || '[]') as ExpertProduct[];
        const movedProduct = storedProducts.find((item) => item.id === product.id);
        const swappedProduct = storedProducts.find((item) => item.id === secondProduct.id);
        expect(movedProduct?.displayOrder).toBe(1);
        expect(swappedProduct?.displayOrder).toBe(2);
    });

    it('cancels a work when an admin records a cancel trade action', async () => {
        localStorage.setItem('ai_works', JSON.stringify([work]));
        const { saveAdminAction } = await import('./adminStorage');

        await saveAdminAction({
            adminId: 'admin-user-01',
            targetType: 'work',
            targetId: work.id,
            actionType: 'cancel_trade',
            reason: '관리자가 거래 중단을 처리했습니다.',
        });

        const storedWorks = JSON.parse(localStorage.getItem('ai_works') || '[]') as Work[];
        expect(storedWorks[0]?.status).toBe('cancelled');
        expect(storedWorks[0]?.refundStatus).toBe('fee_excluded_refund_pending');
    });

    it('resolves a pending report when an admin records a resolve report action', async () => {
        localStorage.setItem('ai_admin_reports', JSON.stringify([{
            id: 'report-admin-01',
            reporterId: 'client-admin-01',
            targetType: 'product',
            targetId: product.id,
            reason: '외부 연락처 유도 의심',
            status: 'pending',
            severity: 'high',
            createdAt: '2026-07-01T00:40:00.000Z',
        }]));
        const { saveAdminAction } = await import('./adminStorage');

        await saveAdminAction({
            adminId: 'admin-user-01',
            targetType: 'report',
            targetId: 'report-admin-01',
            actionType: 'resolve_report',
            reason: '관리자가 신고 항목을 검토 완료 처리했습니다.',
        });

        const storedReports = JSON.parse(localStorage.getItem('ai_admin_reports') || '[]') as { readonly status?: string }[];
        expect(storedReports[0]?.status).toBe('resolved');
    });
});
