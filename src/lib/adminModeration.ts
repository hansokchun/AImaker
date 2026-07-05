import type { Consultation, ExpertProduct, Work } from '../types';
import type { AdminAction } from './adminStorage';
import { supabase } from './supabase';

const STORAGE_KEYS = {
    PROFILE_PREFIX: 'ai_profile_',
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
    if (action.actionType === 'restrict' && action.targetType === 'user') updateLocalProfileModeration(action.targetId, 'restricted');
    if (action.actionType === 'release_restriction' && action.targetType === 'user') updateLocalProfileModeration(action.targetId, 'active');
    if (action.actionType === 'hide_product' && action.targetType === 'product') hideLocalProduct(action.targetId);
    if (action.actionType === 'restore_product' && action.targetType === 'product') restoreLocalProduct(action.targetId);
    if (action.actionType === 'feature_product' && action.targetType === 'product') featureLocalProduct(action.targetId, true);
    if (action.actionType === 'unfeature_product' && action.targetType === 'product') featureLocalProduct(action.targetId, false);
    if (action.actionType === 'move_product_up' && action.targetType === 'product') moveLocalProduct(action.targetId, 'up');
    if (action.actionType === 'move_product_down' && action.targetType === 'product') moveLocalProduct(action.targetId, 'down');
    if (action.actionType === 'cancel_trade' && action.targetType === 'work') cancelLocalWork(action.targetId);
    if (action.actionType === 'close_consultation' && action.targetType === 'consultation') closeLocalConsultation(action.targetId);
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
