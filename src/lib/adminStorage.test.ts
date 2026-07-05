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
});
