import type {
    Consultation,
    ConsultationMessage,
    ExpertProduct,
    Proposal,
    Review,
    ServiceRequestData,
    Work,
    WorkMessage,
} from '../types';
import { mockExpertProducts } from '../data/mockData';
import { applyAdminActionEffect } from './adminModeration';
import { supabase } from './supabase';
import {
    isRecord,
    toAdminAction,
    toAdminReport,
    toAdminProduct,
    toConsultation,
    toConsultationMessage,
    toProfile,
    toProposal,
    toReview,
    toServiceRequestData,
    toWork,
    toWorkMessage,
} from './adminMappers';

export interface AdminProfile {
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly avatarUrl: string;
    readonly isExpert: boolean;
    readonly moderationStatus?: 'active' | 'restricted';
    readonly createdAt: string;
}

export interface AdminSnapshot {
    readonly profiles: readonly AdminProfile[];
    readonly products: readonly ExpertProduct[];
    readonly serviceRequests: readonly ServiceRequestData[];
    readonly proposals: readonly Proposal[];
    readonly works: readonly Work[];
    readonly consultations: readonly Consultation[];
    readonly consultationMessages: readonly ConsultationMessage[];
    readonly workMessages: readonly WorkMessage[];
    readonly reviews: readonly Review[];
    readonly reports: readonly AdminReport[];
    readonly adminActions: readonly AdminAction[];
    readonly source: 'supabase' | 'local';
}

export type AdminReportStatus = 'pending' | 'resolved' | 'dismissed';
export type AdminReportSeverity = 'low' | 'medium' | 'high';
export type AdminReportTargetType = 'user' | 'product' | 'consultation' | 'work' | 'review';

export interface AdminReport {
    readonly id: string;
    readonly reporterId: string;
    readonly targetType: AdminReportTargetType;
    readonly targetId: string;
    readonly reason: string;
    readonly status: AdminReportStatus;
    readonly severity: AdminReportSeverity;
    readonly createdAt: string;
    readonly resolvedAt?: string;
    readonly resolvedBy?: string;
}

export type AdminActionTargetType = 'user' | 'product' | 'trade' | 'consultation' | 'work' | 'review' | 'report';
export type AdminActionType =
    | 'note'
    | 'warn'
    | 'restrict'
    | 'release_restriction'
    | 'hide_product'
    | 'restore_product'
    | 'feature_product'
    | 'unfeature_product'
    | 'move_product_up'
    | 'move_product_down'
    | 'resolve_report'
    | 'dismiss_report'
    | 'hide_review'
    | 'restore_review'
    | 'mark_settlement_pending'
    | 'mark_settlement_settled'
    | 'mark_refund_pending'
    | 'open_dispute'
    | 'resolve_dispute'
    | 'close_consultation'
    | 'cancel_trade';

export interface AdminAction {
    readonly id: string;
    readonly adminId: string;
    readonly targetType: AdminActionTargetType;
    readonly targetId: string;
    readonly actionType: AdminActionType;
    readonly reason: string;
    readonly createdAt: string;
}

export interface CreateAdminActionInput {
    readonly adminId: string;
    readonly targetType: AdminActionTargetType;
    readonly targetId: string;
    readonly actionType: AdminActionType;
    readonly reason: string;
}

const ADMIN_EMAILS = new Set(
    [
        'benet9827@gmail.com',
        'benet9818@gmail.com',
        ...(import.meta.env.VITE_ADMIN_EMAILS || '')
            .split(',')
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean),
    ],
);

const STORAGE_KEYS = {
    PROFILE_PREFIX: 'ai_profile_',
    REQUESTS: 'ai_requests',
    PRODUCTS: 'ai_products',
    PROPOSALS: 'ai_proposals',
    WORKS: 'ai_works',
    REVIEWS: 'ai_reviews',
    CONSULTATIONS: 'ai_consultations',
    CONSULTATION_MESSAGES: 'ai_consultation_messages',
    WORK_MESSAGES: 'ai_work_messages',
    ADMIN_ACTIONS: 'ai_admin_actions',
    ADMIN_REPORTS: 'ai_admin_reports',
} as const;

const readLocalArray = <T>(key: string): T[] => {
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) as T[] : [];
    } catch {
        return [];
    }
};

const readLocalProfiles = (): AdminProfile[] => {
    const profiles: AdminProfile[] = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key?.startsWith(STORAGE_KEYS.PROFILE_PREFIX)) continue;

        const profile = readLocalProfile(key);
        if (profile) profiles.push(profile);
    }

    return profiles;
};

const readLocalProfile = (key: string): AdminProfile | null => {
    try {
        const raw = window.localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!isRecord(parsed)) return null;

        const id = key.replace(STORAGE_KEYS.PROFILE_PREFIX, '');
        const name = typeof parsed.name === 'string' ? parsed.name : '이름 미등록';
        const avatarUrl = typeof parsed.imageUrl === 'string' ? parsed.imageUrl : '';
        const profession = typeof parsed.profession === 'string' ? parsed.profession : '';
        const aiTools = Array.isArray(parsed.aiTools) ? parsed.aiTools : [];
        const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '';
        const moderationStatus = parsed.moderationStatus === 'restricted' ? 'restricted' : 'active';

        return { id, email: '', name, avatarUrl, isExpert: Boolean(profession || aiTools.length), moderationStatus, createdAt: updatedAt };
    } catch {
        return null;
    }
};

const selectAll = async <T>(table: string, mapper: (item: unknown) => T | null): Promise<T[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase.from(table).select('*').limit(200);
    if (error || !Array.isArray(data)) return [];
    return data.map(mapper).filter((item): item is T => Boolean(item));
};

const createAdminActionId = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `admin-action-${Date.now()}`;
};

const saveLocalAdminAction = (action: AdminAction): AdminAction => {
    const actions = readLocalArray<AdminAction>(STORAGE_KEYS.ADMIN_ACTIONS);
    window.localStorage.setItem(STORAGE_KEYS.ADMIN_ACTIONS, JSON.stringify([action, ...actions]));
    return action;
};

export const isAdminEmail = (email?: string | null): boolean =>
    Boolean(email && ADMIN_EMAILS.has(email.toLowerCase()));

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
    const localSnapshot = getLocalAdminSnapshot();
    if (!supabase) return localSnapshot;

    const [
        products,
        profiles,
        serviceRequests,
        proposals,
        works,
        consultations,
        consultationMessages,
        workMessages,
        reviews,
        reports,
        adminActions,
    ] = await Promise.all([
        selectAll('expert_products', toAdminProduct),
        selectAll('profiles', toProfile),
        selectAll('service_requests', toServiceRequestData),
        selectAll('proposals', toProposal),
        selectAll('works', toWork),
        selectAll('consultations', toConsultation),
        selectAll('consultation_messages', toConsultationMessage),
        selectAll('work_messages', toWorkMessage),
        selectAll('reviews', toReview),
        selectAll('admin_reports', toAdminReport),
        selectAll('admin_actions', toAdminAction),
    ]);

    return {
        profiles: profiles.length > 0 ? profiles : localSnapshot.profiles,
        products: products.length > 0 ? products : localSnapshot.products,
        serviceRequests: serviceRequests.length > 0 ? serviceRequests : localSnapshot.serviceRequests,
        proposals: proposals.length > 0 ? proposals : localSnapshot.proposals,
        works: works.length > 0 ? works : localSnapshot.works,
        consultations: consultations.length > 0 ? consultations : localSnapshot.consultations,
        consultationMessages: consultationMessages.length > 0 ? consultationMessages : localSnapshot.consultationMessages,
        workMessages: workMessages.length > 0 ? workMessages : localSnapshot.workMessages,
        reviews: reviews.length > 0 ? reviews : localSnapshot.reviews,
        reports: reports.length > 0 ? reports : localSnapshot.reports,
        adminActions: adminActions.length > 0 ? adminActions : localSnapshot.adminActions,
        source: profiles.length || serviceRequests.length || proposals.length || works.length ? 'supabase' : 'local',
    };
}

export async function saveAdminAction(input: CreateAdminActionInput): Promise<AdminAction> {
    const action: AdminAction = {
        id: createAdminActionId(),
        adminId: input.adminId,
        targetType: input.targetType,
        targetId: input.targetId,
        actionType: input.actionType,
        reason: input.reason,
        createdAt: new Date().toISOString(),
    };

    await applyAdminActionEffect(action);

    if (!supabase) return saveLocalAdminAction(action);

    const { error } = await supabase.from('admin_actions').insert({
        id: action.id,
        admin_id: action.adminId,
        target_type: action.targetType,
        target_id: action.targetId,
        action_type: action.actionType,
        reason: action.reason,
        created_at: action.createdAt,
    });

    if (error) return saveLocalAdminAction(action);
    return action;
}

function getLocalAdminSnapshot(): AdminSnapshot {
    const localProducts = readLocalArray<ExpertProduct>(STORAGE_KEYS.PRODUCTS);

    return {
        profiles: readLocalProfiles(),
        products: localProducts.length > 0 ? localProducts : mockExpertProducts,
        serviceRequests: readLocalArray<ServiceRequestData>(STORAGE_KEYS.REQUESTS),
        proposals: readLocalArray<Proposal>(STORAGE_KEYS.PROPOSALS),
        works: readLocalArray<Work>(STORAGE_KEYS.WORKS),
        consultations: readLocalArray<Consultation>(STORAGE_KEYS.CONSULTATIONS),
        consultationMessages: readLocalArray<ConsultationMessage>(STORAGE_KEYS.CONSULTATION_MESSAGES),
        workMessages: readLocalArray<WorkMessage>(STORAGE_KEYS.WORK_MESSAGES),
        reviews: readLocalArray<Review>(STORAGE_KEYS.REVIEWS),
        reports: readLocalArray<AdminReport>(STORAGE_KEYS.ADMIN_REPORTS),
        adminActions: readLocalArray<AdminAction>(STORAGE_KEYS.ADMIN_ACTIONS),
        source: 'local',
    };
}
