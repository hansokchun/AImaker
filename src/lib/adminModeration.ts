import type { Consultation, ExpertProduct, Work } from '../types';
import type { AdminAction } from './adminStorage';
import { supabase } from './supabase';

const STORAGE_KEYS = {
    PRODUCTS: 'ai_products',
    WORKS: 'ai_works',
    CONSULTATIONS: 'ai_consultations',
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

const closeLocalConsultation = (consultationId: string): void => {
    const consultations = readLocalArray<Consultation>(STORAGE_KEYS.CONSULTATIONS);
    window.localStorage.setItem(
        STORAGE_KEYS.CONSULTATIONS,
        JSON.stringify(consultations.map((consultation) =>
            consultation.id === consultationId ? { ...consultation, status: 'closed' } : consultation,
        )),
    );
};

const applyLocalAdminAction = (action: AdminAction): void => {
    if (action.actionType === 'hide_product' && action.targetType === 'product') hideLocalProduct(action.targetId);
    if (action.actionType === 'cancel_trade' && action.targetType === 'work') cancelLocalWork(action.targetId);
    if (action.actionType === 'close_consultation' && action.targetType === 'consultation') closeLocalConsultation(action.targetId);
};

const applySupabaseAdminAction = async (action: AdminAction): Promise<boolean> => {
    if (!supabase) return false;
    if (action.actionType === 'hide_product' && action.targetType === 'product') {
        const { error } = await supabase
            .from('expert_products')
            .update({ status: 'hidden', updated_at: new Date().toISOString() })
            .eq('id', action.targetId);
        return !error;
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

    if (action.actionType === 'close_consultation' && action.targetType === 'consultation') {
        const { error } = await supabase
            .from('consultations')
            .update({ status: 'closed', updated_at: new Date().toISOString() })
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
    if (!applied) applyLocalAdminAction(action);
};
