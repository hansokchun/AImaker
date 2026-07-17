import type { Consultation, ExpertProduct, Review, SettlementPayout, Work } from '../types';
import type { AdminAction, AdminReport, AdminReportStatus } from './adminStorage';
import { supabase } from './supabase';

const STORAGE_KEYS = {
    PROFILE_PREFIX: 'ai_profile_',
    PRODUCTS: 'ai_products',
    WORKS: 'ai_works',
    REVIEWS: 'ai_reviews',
    CONSULTATIONS: 'ai_consultations',
    ADMIN_REPORTS: 'ai_admin_reports',
    SETTLEMENT_PAYOUTS: 'ai_settlement_payouts',
} as const;

type AdminTradeWorkflowRequest = {
    readonly type: 'admin_moderation_action';
    readonly action: AdminAction;
};

const invokeAdminTradeWorkflow = async (action: AdminAction): Promise<void> => {
    if (!supabase) return;
    if (action.actionType === 'execute_toss_refund' && action.targetType === 'work') {
        const { error } = await supabase.functions.invoke('toss-payment-cancel', {
            body: { workId: action.targetId, reason: action.reason },
        });
        if (error) throw new Error(error.message || '토스 환불 실행에 실패했습니다.');
        return;
    }
    const body: AdminTradeWorkflowRequest = { type: 'admin_moderation_action', action };
    const { error } = await supabase.functions.invoke('trade-workflow', { body });
    if (error) throw new Error(error.message || '관리자 거래 상태 변경에 실패했습니다.');
};

const readLocalArray = <T>(key: string): T[] => {
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) as T[] : [];
    } catch {
        return [];
    }
};

const hideLocalProduct = (productId: string): void => {
    const products = readLocalArray<ExpertProduct>(STORAGE_KEYS.PRODUCTS);
    window.localStorage.setItem(
        STORAGE_KEYS.PRODUCTS,
        JSON.stringify(products.map((product) => product.id === productId ? { ...product, status: 'hidden' } : product)),
    );
};

const updateLocalProfileModeration = (userId: string, moderationStatus: 'active' | 'restricted'): void => {
    const key = `${STORAGE_KEYS.PROFILE_PREFIX}${userId}`;
    const existing = readLocalProfileRecord(key);
    window.localStorage.setItem(key, JSON.stringify({ ...existing, moderationStatus }));
};

const readLocalProfileRecord = (key: string): Record<string, unknown> => {
    try {
        const raw = window.localStorage.getItem(key);
        const parsed: unknown = raw ? JSON.parse(raw) : {};
        return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
    } catch {
        return {};
    }
};

const updateLocalProduct = (productId: string, updateProduct: (product: ExpertProduct) => ExpertProduct): void => {
    const products = readLocalArray<ExpertProduct>(STORAGE_KEYS.PRODUCTS);
    window.localStorage.setItem(
        STORAGE_KEYS.PRODUCTS,
        JSON.stringify(products.map((product) => product.id === productId ? updateProduct(product) : product)),
    );
};

const restoreLocalProduct = (productId: string): void => {
    updateLocalProduct(productId, (product) => ({ ...product, status: 'published' }));
};

const featureLocalProduct = (productId: string, isFeatured: boolean): void => {
    updateLocalProduct(productId, (product) => ({ ...product, isFeatured }));
};

const moveLocalProduct = (productId: string, direction: 'up' | 'down'): void => {
    const products = readLocalArray<ExpertProduct>(STORAGE_KEYS.PRODUCTS).map((product, index) => ({
        ...product,
        displayOrder: product.displayOrder ?? index + 1,
    }));
    const sortedProducts = [...products].sort((first, second) => (first.displayOrder || 0) - (second.displayOrder || 0));
    const targetIndex = sortedProducts.findIndex((product) => product.id === productId);
    const swapIndex = direction === 'up' ? targetIndex - 1 : targetIndex + 1;
    const targetProduct = sortedProducts[targetIndex];
    const swapProduct = sortedProducts[swapIndex];

    if (!targetProduct || !swapProduct) return;

    const targetOrder = targetProduct.displayOrder;
    const swapOrder = swapProduct.displayOrder;
    const nextProducts = products.map((product) => {
        if (product.id === targetProduct.id) return { ...product, displayOrder: swapOrder };
        if (product.id === swapProduct.id) return { ...product, displayOrder: targetOrder };
        return product;
    });
    window.localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(nextProducts));
};

const cancelLocalWork = (workId: string): void => {
    const cancelledAt = new Date().toISOString();
    const works = readLocalArray<Work>(STORAGE_KEYS.WORKS);
    window.localStorage.setItem(
        STORAGE_KEYS.WORKS,
        JSON.stringify(works.map((work) => work.id === workId
            ? {
                ...work,
                status: 'cancelled',
                settlementStatus: work.settlementStatus || 'held',
                refundStatus: 'fee_excluded_refund_pending',
                cancellationReason: 'mutual_after_start',
                cancelledAt,
            }
            : work)),
    );
};

const updateLocalWork = (workId: string, updateWork: (work: Work) => Work): void => {
    const works = readLocalArray<Work>(STORAGE_KEYS.WORKS);
    window.localStorage.setItem(
        STORAGE_KEYS.WORKS,
        JSON.stringify(works.map((work) => work.id === workId ? updateWork(work) : work)),
    );
};

const updateLocalReview = (reviewId: string, status: 'published' | 'hidden'): void => {
    const reviews = readLocalArray<Review>(STORAGE_KEYS.REVIEWS);
    window.localStorage.setItem(
        STORAGE_KEYS.REVIEWS,
        JSON.stringify(reviews.map((review) => review.id === reviewId ? { ...review, status } : review)),
    );
};

const closeLocalConsultation = (consultationId: string): void => {
    const consultations = readLocalArray<Consultation>(STORAGE_KEYS.CONSULTATIONS);
    window.localStorage.setItem(
        STORAGE_KEYS.CONSULTATIONS,
        JSON.stringify(consultations.map((consultation) =>
            consultation.id === consultationId ? { ...consultation, status: 'closed' } : consultation,
        )),
    );
};

const updateLocalReportStatus = (reportId: string, status: AdminReportStatus, action: AdminAction): void => {
    const reports = readLocalArray<AdminReport>(STORAGE_KEYS.ADMIN_REPORTS);
    window.localStorage.setItem(
        STORAGE_KEYS.ADMIN_REPORTS,
        JSON.stringify(reports.map((report) =>
            report.id === reportId
                ? {
                    ...report,
                    status,
                    resolvedAt: action.createdAt,
                    resolvedBy: action.adminId,
                }
                : report,
        )),
    );
};

const markLocalSettlementPayoutPaid = (workId: string, processedAt: string): void => {
    const payouts = readLocalArray<SettlementPayout>(STORAGE_KEYS.SETTLEMENT_PAYOUTS);
    window.localStorage.setItem(
        STORAGE_KEYS.SETTLEMENT_PAYOUTS,
        JSON.stringify(payouts.map((payout) => payout.workId === workId
            ? { ...payout, status: 'paid', processedAt }
            : payout)),
    );
};

const applyLocalAdminAction = (action: AdminAction): void => {
    if (action.actionType === 'restrict' && action.targetType === 'user') updateLocalProfileModeration(action.targetId, 'restricted');
    if (action.actionType === 'release_restriction' && action.targetType === 'user') updateLocalProfileModeration(action.targetId, 'active');
    if (action.actionType === 'hide_product' && action.targetType === 'product') hideLocalProduct(action.targetId);
    if (action.actionType === 'restore_product' && action.targetType === 'product') restoreLocalProduct(action.targetId);
    if (action.actionType === 'feature_product' && action.targetType === 'product') featureLocalProduct(action.targetId, true);
    if (action.actionType === 'unfeature_product' && action.targetType === 'product') featureLocalProduct(action.targetId, false);
    if (action.actionType === 'move_product_up' && action.targetType === 'product') moveLocalProduct(action.targetId, 'up');
    if (action.actionType === 'move_product_down' && action.targetType === 'product') moveLocalProduct(action.targetId, 'down');
    if (action.actionType === 'cancel_trade' && action.targetType === 'work') cancelLocalWork(action.targetId);
    if (action.actionType === 'mark_settlement_pending' && action.targetType === 'work') {
        updateLocalWork(action.targetId, (work) => ({ ...work, settlementStatus: 'pending', settlementHoldReason: undefined }));
    }
    if (action.actionType === 'mark_settlement_settled' && action.targetType === 'work') {
        updateLocalWork(action.targetId, (work) => ({
            ...work,
            settlementStatus: 'settled',
            settlementHoldReason: undefined,
            settlementSettledAt: action.createdAt,
        }));
        markLocalSettlementPayoutPaid(action.targetId, action.createdAt);
    }
    if (action.actionType === 'hold_settlement' && action.targetType === 'work') {
        updateLocalWork(action.targetId, (work) => ({
            ...work,
            settlementStatus: 'pending',
            settlementHoldReason: action.reason,
        }));
    }
    if (action.actionType === 'mark_refund_pending' && action.targetType === 'work') {
        updateLocalWork(action.targetId, (work) => ({
            ...work,
            settlementStatus: 'refunded',
            refundStatus: 'fee_excluded_refund_pending',
        }));
    }
    if (action.actionType === 'execute_toss_refund' && action.targetType === 'work') {
        updateLocalWork(action.targetId, (work) => ({
            ...work,
            settlementStatus: 'refunded',
            refundStatus: 'refunded',
            cancelledAt: action.createdAt,
        }));
    }
    if (action.actionType === 'open_dispute' && action.targetType === 'work') {
        updateLocalWork(action.targetId, (work) => ({ ...work, disputeStatus: 'open' }));
    }
    if (action.actionType === 'resolve_dispute' && action.targetType === 'work') {
        updateLocalWork(action.targetId, (work) => ({ ...work, disputeStatus: 'resolved' }));
    }
    if (action.actionType === 'hide_review' && action.targetType === 'review') updateLocalReview(action.targetId, 'hidden');
    if (action.actionType === 'restore_review' && action.targetType === 'review') updateLocalReview(action.targetId, 'published');
    if (action.actionType === 'close_consultation' && action.targetType === 'consultation') closeLocalConsultation(action.targetId);
    if (action.actionType === 'resolve_report' && action.targetType === 'report') updateLocalReportStatus(action.targetId, 'resolved', action);
    if (action.actionType === 'dismiss_report' && action.targetType === 'report') updateLocalReportStatus(action.targetId, 'dismissed', action);
};

export const applyAdminActionEffect = async (action: AdminAction): Promise<void> => {
    if (!supabase) {
        applyLocalAdminAction(action);
        return;
    }
    await invokeAdminTradeWorkflow(action);
};
