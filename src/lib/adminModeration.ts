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

const moveSupabaseProduct = async (productId: string, direction: 'up' | 'down'): Promise<boolean> => {
    if (!supabase) return false;

    const { data, error } = await supabase
        .from('expert_products')
        .select('id, display_order, title')
        .order('display_order', { ascending: true })
        .order('title', { ascending: true });

    if (error || !Array.isArray(data)) return false;

    const products = data.map((product, index) => ({
        id: String(product.id),
        displayOrder: Number(product.display_order) || index + 1,
    }));
    const targetIndex = products.findIndex((product) => product.id === productId);
    const swapIndex = direction === 'up' ? targetIndex - 1 : targetIndex + 1;
    const targetProduct = products[targetIndex];
    const swapProduct = products[swapIndex];

    if (!targetProduct || !swapProduct) return false;

    const updatedAt = new Date().toISOString();
    const [targetResult, swapResult] = await Promise.all([
        supabase
            .from('expert_products')
            .update({ display_order: swapProduct.displayOrder, updated_at: updatedAt })
            .eq('id', targetProduct.id),
        supabase
            .from('expert_products')
            .update({ display_order: targetProduct.displayOrder, updated_at: updatedAt })
            .eq('id', swapProduct.id),
    ]);

    return !targetResult.error && !swapResult.error;
};

const applySupabaseAdminAction = async (action: AdminAction): Promise<boolean> => {
    if (!supabase) return false;
    if (action.actionType === 'restrict' && action.targetType === 'user') {
        const { error } = await supabase
            .from('profiles')
            .update({ account_status: 'restricted', updated_at: new Date().toISOString() })
            .eq('id', action.targetId);
        return !error;
    }

    if (action.actionType === 'release_restriction' && action.targetType === 'user') {
        const { error } = await supabase
            .from('profiles')
            .update({ account_status: 'active', updated_at: new Date().toISOString() })
            .eq('id', action.targetId);
        return !error;
    }

    if (action.actionType === 'hide_product' && action.targetType === 'product') {
        const { error } = await supabase
            .from('expert_products')
            .update({ status: 'hidden', updated_at: new Date().toISOString() })
            .eq('id', action.targetId);
        return !error;
    }

    if (action.actionType === 'restore_product' && action.targetType === 'product') {
        const { error } = await supabase
            .from('expert_products')
            .update({ status: 'published', updated_at: new Date().toISOString() })
            .eq('id', action.targetId);
        return !error;
    }

    if ((action.actionType === 'feature_product' || action.actionType === 'unfeature_product') && action.targetType === 'product') {
        const { error } = await supabase
            .from('expert_products')
            .update({ is_featured: action.actionType === 'feature_product', updated_at: new Date().toISOString() })
            .eq('id', action.targetId);
        return !error;
    }

    if ((action.actionType === 'move_product_up' || action.actionType === 'move_product_down') && action.targetType === 'product') {
        return moveSupabaseProduct(action.targetId, action.actionType === 'move_product_up' ? 'up' : 'down');
    }

    if (action.actionType === 'cancel_trade' && action.targetType === 'work') {
        const { error } = await supabase
            .from('works')
            .update({
                status: 'cancelled',
                refund_status: 'fee_excluded_refund_pending',
                cancellation_reason: 'mutual_after_start',
                cancelled_at: new Date().toISOString(),
            })
            .eq('id', action.targetId);
        return !error;
    }

    if (action.targetType === 'work' && action.actionType === 'mark_settlement_pending') {
        const { error } = await supabase
            .from('works')
            .update({ settlement_status: 'pending', settlement_hold_reason: null, updated_at: new Date().toISOString() })
            .eq('id', action.targetId);
        return !error;
    }

    if (action.targetType === 'work' && action.actionType === 'mark_settlement_settled') {
        const settledAt = new Date().toISOString();
        const workResult = await supabase
            .from('works')
            .update({
                settlement_status: 'settled',
                refund_status: null,
                settlement_hold_reason: null,
                settlement_settled_at: settledAt,
                updated_at: settledAt,
            })
            .eq('id', action.targetId);
        const payoutResult = await supabase
            .from('settlement_payouts')
            .update({
                status: 'paid',
                processed_at: settledAt,
                updated_at: settledAt,
            })
            .eq('work_id', action.targetId);
        return !workResult.error && !payoutResult.error;
    }

    if (action.targetType === 'work' && action.actionType === 'hold_settlement') {
        const { error } = await supabase
            .from('works')
            .update({
                settlement_status: 'pending',
                settlement_hold_reason: action.reason,
                updated_at: new Date().toISOString(),
            })
            .eq('id', action.targetId);
        return !error;
    }

    if (action.targetType === 'work' && action.actionType === 'mark_refund_pending') {
        const { error } = await supabase
            .from('works')
            .update({
                settlement_status: 'refunded',
                refund_status: 'fee_excluded_refund_pending',
                updated_at: new Date().toISOString(),
            })
            .eq('id', action.targetId);
        return !error;
    }

    if (action.targetType === 'work' && action.actionType === 'execute_toss_refund') {
        const { error } = await supabase.functions.invoke('toss-payment-cancel', {
            body: {
                workId: action.targetId,
                reason: action.reason,
            },
        });
        return !error;
    }

    if (action.targetType === 'work' && (action.actionType === 'open_dispute' || action.actionType === 'resolve_dispute')) {
        const { error } = await supabase
            .from('works')
            .update({
                dispute_status: action.actionType === 'open_dispute' ? 'open' : 'resolved',
                updated_at: new Date().toISOString(),
            })
            .eq('id', action.targetId);
        return !error;
    }

    if (action.targetType === 'review' && (action.actionType === 'hide_review' || action.actionType === 'restore_review')) {
        const { error } = await supabase
            .from('reviews')
            .update({ status: action.actionType === 'hide_review' ? 'hidden' : 'published' })
            .eq('id', action.targetId);
        return !error;
    }

    if (action.actionType === 'close_consultation' && action.targetType === 'consultation') {
        const { error } = await supabase
            .from('consultations')
            .update({ status: 'closed', updated_at: new Date().toISOString() })
            .eq('id', action.targetId);
        return !error;
    }

    if ((action.actionType === 'resolve_report' || action.actionType === 'dismiss_report') && action.targetType === 'report') {
        const { error } = await supabase
            .from('admin_reports')
            .update({
                status: action.actionType === 'resolve_report' ? 'resolved' : 'dismissed',
                resolved_at: new Date().toISOString(),
                resolved_by: action.adminId,
            })
            .eq('id', action.targetId);
        return !error;
    }

    return true;
};

export const applyAdminActionEffect = async (action: AdminAction): Promise<void> => {
    if (!supabase) {
        applyLocalAdminAction(action);
        return;
    }

    const applied = await applySupabaseAdminAction(action);
    if (applied) return;
    if (action.actionType === 'execute_toss_refund') {
        throw new Error('토스 환불 실행에 실패했습니다.');
    }
    applyLocalAdminAction(action);
};
