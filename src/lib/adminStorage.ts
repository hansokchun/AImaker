import type { Consultation, ExpertProduct, Proposal, Review, ServiceRequestData, Work } from '../types';
import { mockExpertProducts } from '../data/mockData';
import { getExpertProducts } from './storage';
import { supabase } from './supabase';
import {
    isRecord,
    toConsultation,
    toProfile,
    toProposal,
    toReview,
    toServiceRequestData,
    toWork,
} from './adminMappers';

export interface AdminProfile {
    readonly id: string;
    readonly email: string;
    readonly name: string;
    readonly avatarUrl: string;
    readonly isExpert: boolean;
    readonly createdAt: string;
}

export interface AdminSnapshot {
    readonly profiles: readonly AdminProfile[];
    readonly products: readonly ExpertProduct[];
    readonly serviceRequests: readonly ServiceRequestData[];
    readonly proposals: readonly Proposal[];
    readonly works: readonly Work[];
    readonly consultations: readonly Consultation[];
    readonly reviews: readonly Review[];
    readonly source: 'supabase' | 'local';
}

const ADMIN_EMAILS = new Set(
    [
        'benet9827@gmail.com',
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

        return { id, email: '', name, avatarUrl, isExpert: Boolean(profession || aiTools.length), createdAt: updatedAt };
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

export const isAdminEmail = (email?: string | null): boolean =>
    Boolean(email && ADMIN_EMAILS.has(email.toLowerCase()));

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
    const localSnapshot = getLocalAdminSnapshot();
    if (!supabase) return localSnapshot;

    const [products, profiles, serviceRequests, proposals, works, consultations, reviews] = await Promise.all([
        getExpertProducts(),
        selectAll('profiles', toProfile),
        selectAll('service_requests', toServiceRequestData),
        selectAll('proposals', toProposal),
        selectAll('works', toWork),
        selectAll('consultations', toConsultation),
        selectAll('reviews', toReview),
    ]);

    return {
        profiles: profiles.length > 0 ? profiles : localSnapshot.profiles,
        products: products.length > 0 ? products : localSnapshot.products,
        serviceRequests: serviceRequests.length > 0 ? serviceRequests : localSnapshot.serviceRequests,
        proposals: proposals.length > 0 ? proposals : localSnapshot.proposals,
        works: works.length > 0 ? works : localSnapshot.works,
        consultations: consultations.length > 0 ? consultations : localSnapshot.consultations,
        reviews: reviews.length > 0 ? reviews : localSnapshot.reviews,
        source: profiles.length || serviceRequests.length || proposals.length || works.length ? 'supabase' : 'local',
    };
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
        reviews: readLocalArray<Review>(STORAGE_KEYS.REVIEWS),
        source: 'local',
    };
}
