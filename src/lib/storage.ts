/**
 * DB 연동 유틸리티 (Supabase API)
 * - 로컬 환경에선 localStorage를 fallback으로 사용하고,
 *   실제 운영/연동 시 연결된 Supabase Table을 가리키도록 진화 (Step 2 적용)
 */
import type {
    AiServiceRequest,
    Consultation,
    CreateConsultationInput,
    ConsultationMessage,
    Deliverable,
    Expert,
    ExpertProduct,
    ExpertProfile,
    PackageTier,
    Proposal,
    ProductPackage,
    Review,
    ServiceRequestData,
    Work,
    WorkMessage,
    WorkStep,
} from '../types';
import { supabase } from './supabase';
import { mockExpertProducts } from '../data/mockData';
import { EXTERNAL_CONTACT_WARNING, hasExternalContact } from '../constants/policies';
import type { User } from '@supabase/supabase-js';

/** localStorage 키 — 오타 방지를 위해 상수로 관리 */
const STORAGE_KEYS = {
    REQUESTS: 'ai_requests',
    PROFILE: 'ai_profile',
    PRODUCTS: 'ai_products',
    PROPOSALS: 'ai_proposals',
    WORKS: 'ai_works',
    WORK_STEPS: 'ai_work_steps',
    DELIVERABLES: 'ai_deliverables',
    REVIEWS: 'ai_reviews',
    CONSULTATIONS: 'ai_consultations',
    CONSULTATION_MESSAGES: 'ai_consultation_messages',
    WORK_MESSAGES: 'ai_work_messages',
    FAVORITE_PRODUCTS: 'ai_favorite_products',
} as const;

const PLATFORM_FEE_RATE = 0.12;

const isUuid = (value?: string) =>
    Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

const toOptionalNumber = (value?: string): number | null => {
    const numericValue = Number(String(value || '').replace(/[^\d]/g, ''));
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
};

const getFavoriteProductsStorageKey = (userId: string) => `${STORAGE_KEYS.FAVORITE_PRODUCTS}_${userId}`;

export async function getUserFavoriteProductIds(userId: string): Promise<string[]> {
    if (!userId) return [];
    try {
        const raw = localStorage.getItem(getFavoriteProductsStorageKey(userId));
        const ids = raw ? (JSON.parse(raw) as string[]) : [];
        return Array.from(new Set(ids.map(String)));
    } catch {
        return [];
    }
}

export async function getFavoriteProductCount(productId: string): Promise<number> {
    if (!productId) return 0;
    try {
        let count = 0;
        for (let index = 0; index < localStorage.length; index += 1) {
            const key = localStorage.key(index);
            if (!key?.startsWith(`${STORAGE_KEYS.FAVORITE_PRODUCTS}_`)) continue;
            const raw = localStorage.getItem(key);
            const ids = raw ? (JSON.parse(raw) as string[]) : [];
            if (ids.map(String).includes(productId)) count += 1;
        }
        return count;
    } catch {
        return 0;
    }
}

export async function toggleFavoriteProduct(userId: string, productId: string): Promise<string[]> {
    const currentIds = await getUserFavoriteProductIds(userId);
    const exists = currentIds.includes(productId);
    const nextIds = exists ? currentIds.filter((id) => id !== productId) : [productId, ...currentIds];
    localStorage.setItem(getFavoriteProductsStorageKey(userId), JSON.stringify(nextIds));
    return nextIds;
}

const createFallbackProductPackage = (item: any) => ({
    name: 'Standard' as const,
    price: Number(item.starting_price) || 0,
    deliveryDays: Number(item.delivery_days) || 1,
    revisionCount: Number(item.revision_count) || 1,
    included: [item.summary || item.title || '상담 후 작업 범위를 확정합니다.'],
});

const normalizeProductPackages = (item: any) => {
    const packages = item.packages || {};
    return packages.standard
        ? packages
        : {
            standard: createFallbackProductPackage(item),
            deluxe: packages.deluxe || null,
            premium: packages.premium || null,
        };
};

const packageTierNames: Record<PackageTier, ProductPackage['name']> = {
    standard: 'Standard',
    deluxe: 'Deluxe',
    premium: 'Premium',
};

const normalizeDbProductPackage = (tier: PackageTier, packageData: any, item: any): ProductPackage | null => {
    if (!packageData) {
        return tier === 'standard'
            ? {
                name: packageTierNames[tier],
                price: Number(item.starting_price) || 0,
                deliveryDays: Number(item.delivery_days) || 1,
                revisionCount: Number(item.revision_count) || 1,
                included: [item.summary || item.title || '상담 후 작업 범위를 확정합니다.'],
            }
            : null;
    }

    const included = packageData.included || packageData.includes || packageData.features || [];

    return {
        name: packageData.name || packageTierNames[tier],
        price: Number(packageData.price) || Number(item.starting_price) || 0,
        deliveryDays: Number(packageData.deliveryDays ?? packageData.delivery_days) || Number(item.delivery_days) || 1,
        revisionCount: Number(packageData.revisionCount ?? packageData.revision_count) || Number(item.revision_count) || 1,
        included: Array.isArray(included) && included.length > 0
            ? included
            : [item.summary || item.title || '상담 후 작업 범위를 확정합니다.'],
    };
};

const normalizeDbProductPackages = (item: any): ExpertProduct['packages'] => {
    const packages = item.packages || {};

    return {
        standard: normalizeDbProductPackage('standard', packages.standard, item) as ProductPackage,
        deluxe: normalizeDbProductPackage('deluxe', packages.deluxe, item),
        premium: normalizeDbProductPackage('premium', packages.premium, item),
    };
};

const toServiceRequest = (item: any): AiServiceRequest => ({
    id: item.id,
    clientId: item.client_id,
    expertId: item.expert_id,
    productId: item.product_id,
    selectedPackage: item.selected_package || 'standard',
    desiredResult: item.desired_result || '',
    purpose: item.purpose || '',
    referenceText: item.reference_text || '',
    referenceLinks: item.reference_links || [],
    deadline: item.deadline || '',
    progressType: item.progress_type || 'single',
    checklist: item.checklist || {
        commercialUseNeeded: false,
        sourceFileNeeded: false,
        revisionNeeded: false,
        usageContext: '',
    },
    additionalRequest: item.additional_request || '',
    status: item.status || 'submitted',
});

const toReview = (item: any): Review => ({
    id: item.id,
    workId: item.work_id,
    clientId: item.client_id,
    expertId: item.expert_id,
    rating: item.rating,
    content: item.content,
    createdAt: item.created_at,
});

const toConsultation = (item: any): Consultation => ({
    id: item.id,
    clientId: item.client_id,
    expertId: item.expert_id,
    productId: item.product_id,
    status: item.status || 'open',
    title: item.title || '상담 채팅',
    lastMessageAt: item.last_message_at || item.created_at,
    createdAt: item.created_at,
});

const toConsultationMessage = (item: any): ConsultationMessage => ({
    id: item.id,
    consultationId: item.consultation_id,
    senderId: item.sender_id,
    body: item.body || '',
    attachmentUrls: item.attachment_urls || [],
    createdAt: item.created_at,
});

const toWorkMessage = (item: any): WorkMessage => ({
    id: item.id,
    workId: item.work_id,
    senderId: item.sender_id,
    body: item.body || '',
    attachmentUrls: item.attachment_urls || [],
    createdAt: item.created_at,
});

const toBoardRequestStatus = (status?: string): ServiceRequestData['status'] => {
    if (status === 'in_progress') return 'in_progress';
    if (status === 'completed' || status === 'cancelled') return 'completed';
    return 'pending';
};

const toLegacyRequest = (request: AiServiceRequest, createdAt?: string): ServiceRequestData => ({
    id: request.id as any,
    title: request.desiredResult,
    description: request.purpose,
    budget: '',
    deadline: request.deadline,
    categories: [],
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: createdAt,
    ordererEmail: '',
    clientId: request.clientId,
    expertId: request.expertId,
    status: toBoardRequestStatus(request.status),
    productId: request.productId,
    selectedPackage: request.selectedPackage,
    desiredResult: request.desiredResult,
    purpose: request.purpose,
    referenceText: request.referenceText,
    referenceLinks: request.referenceLinks,
    progressType: request.progressType,
});

const toServiceRequestData = (item: any): ServiceRequestData => ({
    id: item.id,
    title: item.title || item.desired_result || '',
    description: item.description || item.purpose || '',
    budget: item.budget ? String(item.budget) : '',
    deadline: item.deadline || '',
    categories: item.categories || [],
    ordererEmail: item.orderer_email || '',
    clientId: item.client_id,
    expertId: item.expert_id,
    createdAt: item.created_at || new Date().toISOString(),
    updatedAt: item.updated_at || item.updatedAt || item.created_at,
    status: toBoardRequestStatus(item.status),
    productId: item.product_id || '',
    selectedPackage: item.selected_package || 'standard',
    desiredResult: item.desired_result || item.title || '',
    purpose: item.purpose || item.description || '',
    referenceText: item.reference_text || '',
    referenceLinks: item.reference_links || [],
    progressType: item.progress_type || 'single',
});

const normalizeProposalStatus = (proposal: Proposal): Proposal => {
    if (proposal.status === 'sent' && new Date(proposal.expiresAt) < new Date()) {
        return { ...proposal, status: 'expired' };
    }
    return proposal;
};

const toProposal = (item: any): Proposal => normalizeProposalStatus({
    id: item.id,
    requestId: item.request_id,
    clientId: item.client_id,
    expertId: item.expert_id,
    title: item.title,
    scope: item.scope,
    deliverables: item.deliverables || [],
    totalPrice: item.total_price || 0,
    deliveryDays: item.delivery_days || 0,
    revisionCount: item.revision_count || 0,
    progressType: item.progress_type || 'single',
    milestones: item.milestones || [],
    commercialUseAllowed: Boolean(item.commercial_use_allowed),
    sourceFileIncluded: Boolean(item.source_file_included),
    status: item.status || 'sent',
    paymentStatus: item.payment_status || 'unpaid',
    platformFeeRate: item.platform_fee_rate ?? PLATFORM_FEE_RATE,
    expiresAt: item.expires_at,
});

const toWork = (item: any): Work => ({
    id: item.id,
    proposalId: item.proposal_id,
    requestId: item.request_id,
    clientId: item.client_id,
    expertId: item.expert_id,
    title: item.title,
    progressType: item.progress_type || 'single',
    status: item.status || 'in_progress',
    totalPrice: item.total_price || 0,
    platformFee: item.platform_fee || 0,
    expertPayout: item.expert_payout || 0,
    settlementStatus: item.settlement_status || 'held',
    stepIds: [],
});

const getProposalMoney = (proposal: Proposal) => {
    const platformFee = Math.round(proposal.totalPrice * PLATFORM_FEE_RATE);
    return {
        platformFee,
        expertPayout: proposal.totalPrice - platformFee,
    };
};

const toWorkStep = (item: any): WorkStep => ({
    id: item.id,
    workId: item.work_id,
    stepOrder: item.step_order,
    title: item.title,
    description: item.description || '',
    status: item.status || 'waiting',
});

const toDeliverable = (item: any): Deliverable => ({
    id: item.id,
    workId: item.work_id,
    stepId: item.step_id,
    expertId: item.expert_id,
    description: item.description,
    ...(item.external_url ? { externalUrl: item.external_url } : {}),
    ...(item.file_url ? { fileUrl: item.file_url } : {}),
    status: item.status || 'submitted',
    submittedAt: item.submitted_at,
});

const buildInitialWorkSteps = (proposal: Proposal, workId: string): WorkStep[] => {
    const titles = proposal.progressType === 'milestone' && proposal.milestones.length > 0
        ? proposal.milestones
        : [proposal.title];

    return titles.map((title, index) => ({
        id: `step-${workId}-${index + 1}`,
        workId,
        stepOrder: index + 1,
        title,
        description: index === 0 ? '작업을 시작합니다.' : '이전 단계 완료 후 진행합니다.',
        status: index === 0 ? 'in_progress' : 'waiting',
    }));
};

export async function ensureUserProfile(user: Pick<User, 'id' | 'email' | 'user_metadata'>): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase.from('profiles').upsert(
        {
            id: user.id,
            email: user.email,
            display_name: user.user_metadata?.display_name || user.user_metadata?.name || null,
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        },
        { onConflict: 'id' },
    );

    if (error) {
        console.error('profiles 최소 row 보장 실패:', error);
    }
}

export async function getUserDisplayProfile(userId: string): Promise<{ name: string; imageUrl: string; isExpert: boolean } | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('name, display_name, avatar_url, is_expert')
        .eq('id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        console.error('profiles 표시 정보 로딩 실패:', error);
        return null;
    }

    if (!data) return null;

    return {
        name: data.name || data.display_name || '',
        imageUrl: data.avatar_url || '',
        isExpert: Boolean(data.is_expert),
    };
}

export async function deleteUserPublicAccountData(userId: string): Promise<void> {
    if (!supabase) {
        localStorage.removeItem(`${STORAGE_KEYS.PROFILE}_${userId}`);
        return;
    }

    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

    if (error) {
        console.error('회원 public 데이터 삭제 실패:', error);
        throw new Error('회원 탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
}

async function getStoredRequestsLegacy(): Promise<ServiceRequestData[]> {
    if (!supabase) {
        console.warn('Supabase 미설정: localStorage 폴백 모드로 로딩합니다.');
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.REQUESTS);
            const requests = raw ? (JSON.parse(raw) as ServiceRequestData[]) : [];
            return requests.filter((request) => !request.productId && !request.expertId);
        } catch { return []; }
    }

    const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .is('product_id', null)
        .is('expert_id', null)
        .order('created_at', { ascending: false });
    if (error) {
        console.error('DB 요청 로딩 에러:', error);
        return [];
    }

    return data.map(toServiceRequestData) as ServiceRequestData[];
}

async function saveRequestLegacy(request: ServiceRequestData, userId?: string | null): Promise<void> {
    if (!supabase) {
        const existing = await getStoredRequestsLegacy();
        existing.push(request);
        localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(existing));
        return;
    }

    const { error } = await supabase.from('service_requests').insert([{
        title: request.title,
        description: request.description,
        budget: request.budget ? Number(request.budget) : null,
        deadline: request.deadline,
        categories: request.categories,
        orderer_email: request.ordererEmail,
        status: request.status,
        user_id: userId || null
    }]);

    if (error) {
        console.error('DB 저장 에러:', error);
        throw new Error('데이터베이스 통신 오류: 의뢰 저장 실패');
    }
}

export async function getStoredRequests(): Promise<ServiceRequestData[]> {
    return getStoredRequestsLegacy();
}

export async function getUserServiceRequests(userId: string): Promise<ServiceRequestData[]> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.REQUESTS);
        const requests = raw ? (JSON.parse(raw) as ServiceRequestData[]) : [];
        return requests.filter((request) => request.clientId === userId || request.expertId === userId);
    }

    const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .or(`client_id.eq.${userId},expert_id.eq.${userId}`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('사용자 의뢰 요청 목록 로딩 실패:', error);
        return [];
    }

    return (data || []).map(toServiceRequestData);
}

export async function getUserConsultations(userId: string): Promise<Consultation[]> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.CONSULTATIONS);
        const consultations = raw ? (JSON.parse(raw) as Consultation[]) : [];
        return consultations
            .filter((consultation) => consultation.clientId === userId || consultation.expertId === userId)
            .sort((first, second) => Date.parse(second.lastMessageAt || second.createdAt) - Date.parse(first.lastMessageAt || first.createdAt));
    }

    const { data, error } = await supabase
        .from('consultations')
        .select('*')
        .or(`client_id.eq.${userId},expert_id.eq.${userId}`)
        .order('last_message_at', { ascending: false });

    if (error) {
        console.error('상담 목록 로딩 실패:', error);
        return [];
    }

    return (data || []).map(toConsultation);
}

export async function getConsultationMessages(consultationId: string): Promise<ConsultationMessage[]> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.CONSULTATION_MESSAGES);
        const messages = raw ? (JSON.parse(raw) as ConsultationMessage[]) : [];
        return messages
            .filter((message) => message.consultationId === consultationId)
            .sort((first, second) => Date.parse(first.createdAt) - Date.parse(second.createdAt));
    }

    const { data, error } = await supabase
        .from('consultation_messages')
        .select('*')
        .eq('consultation_id', consultationId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('상담 메시지 로딩 실패:', error);
        return [];
    }

    return (data || []).map(toConsultationMessage);
}

export async function createConsultation(input: CreateConsultationInput): Promise<Consultation> {
    const now = new Date().toISOString();

    if (!supabase) {
        const consultation: Consultation = {
            id: `consultation-${Date.now()}`,
            clientId: input.clientId,
            expertId: input.expertId,
            productId: input.productId,
            status: 'open',
            title: input.title,
            lastMessageAt: now,
            createdAt: now,
        };
        const message: ConsultationMessage = {
            id: `consultation-message-${Date.now()}`,
            consultationId: consultation.id,
            senderId: input.clientId,
            body: input.initialMessage,
            attachmentUrls: [],
            createdAt: now,
        };
        const consultationRaw = localStorage.getItem(STORAGE_KEYS.CONSULTATIONS);
        const consultations = consultationRaw ? (JSON.parse(consultationRaw) as Consultation[]) : [];
        localStorage.setItem(STORAGE_KEYS.CONSULTATIONS, JSON.stringify([consultation, ...consultations]));

        const messageRaw = localStorage.getItem(STORAGE_KEYS.CONSULTATION_MESSAGES);
        const messages = messageRaw ? (JSON.parse(messageRaw) as ConsultationMessage[]) : [];
        localStorage.setItem(STORAGE_KEYS.CONSULTATION_MESSAGES, JSON.stringify([...messages, message]));
        return consultation;
    }

    const { data, error } = await supabase
        .from('consultations')
        .insert({
            client_id: input.clientId,
            expert_id: input.expertId,
            product_id: input.productId,
            title: input.title,
            status: 'open',
        })
        .select()
        .single();

    if (error || !data) {
        console.error('상담 생성 실패:', error);
        throw new Error('데이터베이스 통신 오류: 상담 생성 실패');
    }

    const consultation = toConsultation(data);
    const { error: messageError } = await supabase
        .from('consultation_messages')
        .insert({
            consultation_id: consultation.id,
            sender_id: input.clientId,
            body: input.initialMessage,
            attachment_urls: [],
        });

    if (messageError) {
        console.error('상담 첫 메시지 저장 실패:', messageError);
        throw new Error('데이터베이스 통신 오류: 상담 메시지 저장 실패');
    }

    return consultation;
}

export async function saveConsultationMessage(input: {
    consultationId: string;
    senderId: string;
    body: string;
}): Promise<ConsultationMessage> {
    const body = input.body.trim();
    if (!body) throw new Error('상담 메시지를 입력해주세요.');
    const now = new Date().toISOString();

    if (!supabase) {
        const message: ConsultationMessage = {
            id: `consultation-message-${Date.now()}`,
            consultationId: input.consultationId,
            senderId: input.senderId,
            body,
            attachmentUrls: [],
            createdAt: now,
        };
        const messageRaw = localStorage.getItem(STORAGE_KEYS.CONSULTATION_MESSAGES);
        const messages = messageRaw ? (JSON.parse(messageRaw) as ConsultationMessage[]) : [];
        localStorage.setItem(STORAGE_KEYS.CONSULTATION_MESSAGES, JSON.stringify([...messages, message]));

        const consultationRaw = localStorage.getItem(STORAGE_KEYS.CONSULTATIONS);
        const consultations = consultationRaw ? (JSON.parse(consultationRaw) as Consultation[]) : [];
        localStorage.setItem(
            STORAGE_KEYS.CONSULTATIONS,
            JSON.stringify(
                consultations.map((consultation) =>
                    consultation.id === input.consultationId
                        ? { ...consultation, lastMessageAt: message.createdAt }
                        : consultation,
                ),
            ),
        );
        return message;
    }

    const { data, error } = await supabase
        .from('consultation_messages')
        .insert({
            consultation_id: input.consultationId,
            sender_id: input.senderId,
            body,
            attachment_urls: [],
        })
        .select()
        .single();

    if (error || !data) {
        console.error('상담 메시지 저장 실패:', error);
        throw new Error('데이터베이스 통신 오류: 상담 메시지 저장 실패');
    }

    const message = toConsultationMessage(data);
    const { error: consultationError } = await supabase
        .from('consultations')
        .update({ last_message_at: message.createdAt })
        .eq('id', input.consultationId);

    if (consultationError) {
        console.error('상담 최근 메시지 시간 갱신 실패:', consultationError);
        throw new Error('데이터베이스 통신 오류: 상담 갱신 실패');
    }

    return message;
}

export async function getServiceRequests(): Promise<AiServiceRequest[]> {
    if (!supabase) {
        const requests = await getStoredRequestsLegacy();
        return requests.map((request) => ({
            id: String(request.id),
            clientId: '',
            expertId: '',
            productId: request.productId || '',
            selectedPackage: request.selectedPackage || 'standard',
            desiredResult: request.desiredResult || request.title,
            purpose: request.purpose || request.description,
            referenceText: request.referenceText || '',
            referenceLinks: request.referenceLinks || [],
            deadline: request.deadline,
            progressType: request.progressType || 'single',
            checklist: {
                commercialUseNeeded: false,
                sourceFileNeeded: false,
                revisionNeeded: false,
                usageContext: '',
            },
            status: 'submitted',
        }));
    }

    const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('DB 요청 로딩 오류:', error);
        return [];
    }

    return (data || []).map(toServiceRequest);
}

export async function saveRequest(request: ServiceRequestData, userId?: string | null): Promise<void> {
    if (!supabase) {
        await saveRequestLegacy(request, userId);
        return;
    }

    await saveServiceRequest({
        id: String(request.id),
        clientId: userId || '',
        expertId: request.expertId || '',
        productId: request.productId || '',
        selectedPackage: request.selectedPackage || 'standard',
        desiredResult: request.desiredResult || request.title,
        purpose: request.purpose || request.description,
        referenceText: request.referenceText || '',
        referenceLinks: request.referenceLinks || [],
        deadline: request.deadline,
        progressType: request.progressType || 'single',
        checklist: {
            commercialUseNeeded: false,
            sourceFileNeeded: false,
            revisionNeeded: false,
            usageContext: '',
        },
        status: 'submitted',
        title: request.title,
        description: request.purpose || request.description,
        budget: request.budget,
        categories: request.categories,
    });
}

export async function getRequestById(requestId: string | number): Promise<ServiceRequestData | null> {
    if (!supabase) {
        const requests = await getStoredRequestsLegacy();
        return requests.find((request) => String(request.id) === String(requestId)) || null;
    }

    const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', String(requestId))
        .maybeSingle();

    if (error) {
        console.error('의뢰 요청 로딩 실패:', error);
        return null;
    }

    return data ? toServiceRequestData(data) : null;
}

export async function updateRequest(request: ServiceRequestData, userId?: string | null): Promise<void> {
    if (!supabase) {
        const requests = await getStoredRequestsLegacy();
        const nextRequests = requests.map((storedRequest) =>
            String(storedRequest.id) === String(request.id) ? { ...storedRequest, ...request } : storedRequest,
        );
        localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(nextRequests));
        return;
    }

    let query = supabase
        .from('service_requests')
        .update({
            title: request.title,
            description: request.purpose || request.description,
            budget: request.budget ? toOptionalNumber(request.budget) : null,
            deadline: request.deadline,
            categories: request.categories,
            selected_package: request.selectedPackage || 'standard',
            desired_result: request.desiredResult || request.title,
            purpose: request.purpose || request.description,
            reference_text: request.referenceText || '',
            reference_links: request.referenceLinks || [],
            progress_type: request.progressType || 'single',
        })
        .eq('id', String(request.id));

    if (userId) {
        query = query.eq('client_id', userId);
    }

    const { error } = await query;
    if (error) {
        console.error('의뢰 요청 수정 실패:', error);
        throw new Error('데이터베이스 통신 오류: 의뢰 요청 수정 실패');
    }
}

export async function saveServiceRequest(request: AiServiceRequest): Promise<void> {
    if (!supabase) {
        const existing = await getStoredRequestsLegacy();
        existing.push(toLegacyRequest(request));
        localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(existing));
        return;
    }

    const { error } = await supabase.from('service_requests').insert([{
        ...(isUuid(request.id) ? { id: request.id } : {}),
        client_id: request.clientId || null,
        ...(isUuid(request.expertId) ? { expert_id: request.expertId } : {}),
        ...(isUuid(request.productId) ? { product_id: request.productId } : {}),
        selected_package: request.selectedPackage,
        desired_result: request.desiredResult,
        purpose: request.purpose,
        reference_text: request.referenceText,
        reference_links: request.referenceLinks,
        deadline: request.deadline,
        progress_type: request.progressType,
        checklist: request.checklist,
        additional_request: request.additionalRequest || null,
        title: request.title || request.desiredResult,
        description: request.description || request.purpose,
        ...(request.budget !== undefined ? { budget: toOptionalNumber(request.budget) } : {}),
        ...(request.categories ? { categories: request.categories } : {}),
        status: request.status || 'submitted',
    }]);

    if (error) {
        console.error('DB 요청 저장 오류:', error);
        throw new Error('데이터베이스 통신 오류: 의뢰 요청 저장 실패');
    }
}

// ==========================================
// 전문가 프로필 저장/로드
// - 향후 Supabase expert_profiles 테이블로 마이그레이션 예정
// ==========================================

/**
 * 빈 프로필 템플릿을 생성한다.
 * - 새 사용자가 프로필 편집 페이지에 처음 진입할 때 사용
 * - 왜 함수로 분리: 매번 새 객체를 반환해야 참조 공유 버그를 방지
 */
export function createDefaultProfile(): ExpertProfile {
    return {
        imageUrl: '',
        profession: '',
        name: '',
        oneLiner: '',
        greeting: '',
        activities: [''],
        awards: [''],
        aiTools: [],
        editTools: [],
        sampleLinks: [],
        packages: {
            standard: { price: '', description: '', workDays: '', revisions: '', features: [''] },
            deluxe: { price: '', description: '', workDays: '', revisions: '', features: [''] },
            premium: { price: '', description: '', workDays: '', revisions: '', features: [''] },
        },
    };
}

/**
 * 특정 사용자의 프로필을 localStorage에서 안전하게 불러온다.
 * - userId별로 키를 분리하여 다중 사용자 지원
 * - 데이터 손상 시 null을 반환하여 앱 크래시 방지
 */
/**
 * 특정 사용자의 프로필을 Supabase(또는 localStorage)에서 불러온다.
 */
export async function getStoredProfile(userId: string): Promise<ExpertProfile | null> {
    if (!supabase) {
        // 폴백: localStorage
        try {
            const raw = localStorage.getItem(`${STORAGE_KEYS.PROFILE}_${userId}`);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return typeof parsed === 'object' && parsed !== null ? parsed as ExpertProfile : null;
        } catch {
            return null;
        }
    }

    // Supabase 연동
    const { data, error } = await supabase
        .from('expert_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        // 아직 프로필이 없으면(PGRST116) null 반환 (정상)
        if (error.code === 'PGRST116') return null;
        console.error('Supabase 프로필 로딩 실패:', error);
        return null;
    }

    if (!data) return null;

    // DB 스키마(snake_case)를 앱 타입(camelCase)으로 매핑
    return {
        id: data.user_id,
        imageUrl: data.image_url || '',
        profession: data.profession || '',
        name: data.name || '',
        oneLiner: data.one_liner || '',
        greeting: data.greeting || '',
        activities: Array.isArray(data.activities) && data.activities.length ? data.activities : [''],
        awards: Array.isArray(data.awards) && data.awards.length ? data.awards : [''],
        aiTools: Array.isArray(data.ai_tools) ? data.ai_tools : [],
        editTools: Array.isArray(data.edit_tools) ? data.edit_tools : [],
        sampleLinks: Array.isArray(data.sample_links) ? data.sample_links : [],
        packages: data.packages || {
            standard: { price: '', description: '', workDays: '', revisions: '', features: [''] },
            deluxe: { price: '', description: '', workDays: '', revisions: '', features: [''] },
            premium: { price: '', description: '', workDays: '', revisions: '', features: [''] },
        },
        updatedAt: data.updated_at,
    };
}

/**
 * 프로필 데이터를 Supabase(또는 localStorage)에 저장(Upsert)한다.
 */
export async function saveProfile(userId: string, profile: ExpertProfile): Promise<void> {
    if (!supabase) {
        // 폴백: localStorage
        try {
            const toSave: ExpertProfile = {
                ...profile,
                id: userId,
                updatedAt: new Date().toISOString(),
            };
            localStorage.setItem(`${STORAGE_KEYS.PROFILE}_${userId}`, JSON.stringify(toSave));
            return;
        } catch {
            throw new Error('프로필 로컬 저장에 실패했습니다.');
        }
    }

    // Supabase Upsert (존재하면 수정, 없으면 삽입)
    const { error } = await supabase.from('expert_profiles').upsert({
        user_id: userId,
        image_url: profile.imageUrl,
        profession: profile.profession,
        name: profile.name,
        one_liner: profile.oneLiner,
        greeting: profile.greeting,
        activities: profile.activities,
        awards: profile.awards,
        ai_tools: profile.aiTools,
        edit_tools: profile.editTools,
        sample_links: profile.sampleLinks || [],
        packages: profile.packages,
        updated_at: new Date().toISOString(),
    });

    if (!error) {
        await supabase
            .from('profiles')
            .update({
                name: profile.name,
                avatar_url: profile.imageUrl,
            })
            .eq('id', userId);
    }

    if (error) {
        console.error('Supabase 프로필 저장 실패:', error);
        throw new Error(`데이터베이스 통신 오류: 프로필 저장 실패 (${error.message})`);
    }
}

/**
 * DB에서 전문가 목록을 가져온다 (Home, Category 페이지용)
 * - expert_profiles에서 모든 프로필을 가져와 Expert 타입으로 매핑
 * - 리뷰 및 평점 시스템 연동 전이므로 임시로 0 처리
 */
export async function saveExpertProduct(product: ExpertProduct): Promise<void> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
        const existing = raw ? (JSON.parse(raw) as ExpertProduct[]) : [];
        const next = existing.filter((item) => item.id !== product.id);
        next.push(product);
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(next));
        return;
    }

    const { error } = await supabase.from('expert_products').upsert({
        id: product.id,
        expert_id: product.expertId,
        title: product.title,
        category: product.category,
        summary: product.summary,
        description: product.description,
        ai_tools: product.aiTools,
        sample_links: product.sampleLinks,
        sample_file_urls: product.sampleImageUrl ? [product.sampleImageUrl] : [],
        starting_price: product.startingPrice,
        currency: 'KRW',
        delivery_days: product.deliveryDays,
        revision_count: product.revisionCount,
        packages: product.packages,
        status: product.status,
        updated_at: new Date().toISOString(),
    });

    if (error) {
        console.error('Supabase 상품 저장 실패:', error);
        throw new Error(`데이터베이스 통신 오류: 상품 저장 실패 (${error.message})`);
    }
}

export async function deleteExpertProduct(productId: string): Promise<void> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
        const existing = raw ? (JSON.parse(raw) as ExpertProduct[]) : [];
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(existing.filter((item) => item.id !== productId)));
        return;
    }

    const { error } = await supabase
        .from('expert_products')
        .update({ status: 'hidden', updated_at: new Date().toISOString() })
        .eq('id', productId);

    if (error) {
        console.error('Supabase 상품 삭제 실패:', error);
        throw new Error(`데이터베이스 통신 오류: 상품 삭제 실패 (${error.message})`);
    }
}

export async function getExpertProducts(): Promise<ExpertProduct[]> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
        const stored = raw ? (JSON.parse(raw) as ExpertProduct[]) : [];
        return stored.length ? stored : mockExpertProducts;
    }

    const { data, error } = await supabase
        .from('expert_products')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Supabase 상품 목록 로딩 실패:', error);
        return [];
    }

    return (data || []).map((item) => ({
        id: item.id,
        expertId: item.expert_id,
        expertName: item.expert_name || 'AI 전문가',
        title: item.title,
        category: item.category,
        summary: item.summary,
        description: item.description,
        aiTools: Array.isArray(item.ai_tools) ? item.ai_tools : [],
        sampleLinks: Array.isArray(item.sample_links) ? item.sample_links : [],
        sampleImageUrl: item.sample_file_urls?.[0] || item.sample_links?.[0] || '',
        startingPrice: Number(item.starting_price) || 0,
        deliveryDays: Number(item.delivery_days) || 1,
        revisionCount: Number(item.revision_count) || 1,
        packages: normalizeDbProductPackages(item),
        status: item.status,
    })) as ExpertProduct[];
}

export async function saveProposal(proposal: Proposal): Promise<string> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.PROPOSALS);
        const proposals = raw ? (JSON.parse(raw) as Proposal[]) : [];
        localStorage.setItem(STORAGE_KEYS.PROPOSALS, JSON.stringify([...proposals, proposal]));
        return proposal.id;
    }

    const { data, error } = await supabase
        .from('proposals')
        .insert([{
            ...(isUuid(proposal.id) ? { id: proposal.id } : {}),
            request_id: proposal.requestId,
            client_id: proposal.clientId,
            expert_id: proposal.expertId,
            title: proposal.title,
            scope: proposal.scope,
            deliverables: proposal.deliverables,
            total_price: proposal.totalPrice,
            delivery_days: proposal.deliveryDays,
            revision_count: proposal.revisionCount,
            progress_type: proposal.progressType,
            milestones: proposal.milestones,
            commercial_use_allowed: proposal.commercialUseAllowed,
            source_file_included: proposal.sourceFileIncluded,
            status: proposal.status,
            payment_status: proposal.paymentStatus || 'unpaid',
            platform_fee_rate: proposal.platformFeeRate ?? PLATFORM_FEE_RATE,
            expires_at: proposal.expiresAt,
        }])
        .select('id')
        .single();

    if (error) {
        console.error('DB 제안서 저장 오류:', error);
        throw new Error('데이터베이스 통신 오류: 제안서 저장 실패');
    }

    return data?.id || proposal.id;
}

export async function updateProposal(proposal: Proposal): Promise<void> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.PROPOSALS);
        const proposals = raw ? (JSON.parse(raw) as Proposal[]) : [];
        localStorage.setItem(
            STORAGE_KEYS.PROPOSALS,
            JSON.stringify(proposals.map((storedProposal) => (storedProposal.id === proposal.id ? proposal : storedProposal))),
        );
        return;
    }

    const { error } = await supabase
        .from('proposals')
        .update({
            title: proposal.title,
            scope: proposal.scope,
            deliverables: proposal.deliverables,
            total_price: proposal.totalPrice,
            delivery_days: proposal.deliveryDays,
            revision_count: proposal.revisionCount,
            progress_type: proposal.progressType,
            milestones: proposal.milestones,
            commercial_use_allowed: proposal.commercialUseAllowed,
            source_file_included: proposal.sourceFileIncluded,
            status: proposal.status,
            payment_status: proposal.paymentStatus || 'unpaid',
            platform_fee_rate: proposal.platformFeeRate ?? PLATFORM_FEE_RATE,
            expires_at: proposal.expiresAt,
        })
        .eq('id', proposal.id);

    if (error) throw new Error('데이터베이스 통신 오류: 제안서 수정 실패');
}

export async function getProposal(proposalId: string): Promise<Proposal | null> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.PROPOSALS);
        const proposals = raw ? (JSON.parse(raw) as Proposal[]) : [];
        return proposals.find((proposal) => proposal.id === proposalId) || null;
    }

    const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', proposalId)
        .single();

    if (error) return null;
    return data ? toProposal(data) : null;
}

export async function getUserProposals(userId: string): Promise<Proposal[]> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.PROPOSALS);
        const proposals = raw ? (JSON.parse(raw) as Proposal[]) : [];
        return proposals
            .filter((proposal) => proposal.clientId === userId || proposal.expertId === userId)
            .map(normalizeProposalStatus);
    }

    const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .or(`client_id.eq.${userId},expert_id.eq.${userId}`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('사용자 제안서 목록 로딩 실패:', error);
        return [];
    }

    return (data || []).map(toProposal);
}

export async function acceptProposal(proposal: Proposal): Promise<string> {
    if (proposal.status === 'expired' || new Date(proposal.expiresAt) < new Date()) {
        throw new Error('만료된 제안서는 승인할 수 없습니다.');
    }

    const money = getProposalMoney(proposal);

    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.WORKS);
        const works = raw ? (JSON.parse(raw) as Work[]) : [];
        const existingWork = works.find((work) => work.proposalId === proposal.id);
        if (proposal.paymentStatus === 'paid' && existingWork) return existingWork.id;

        const work: Work = {
            id: `work-${proposal.id}`,
            proposalId: proposal.id,
            requestId: proposal.requestId,
            clientId: proposal.clientId,
            expertId: proposal.expertId,
            title: proposal.title,
            progressType: proposal.progressType,
            status: 'in_progress',
            totalPrice: proposal.totalPrice,
            platformFee: money.platformFee,
            expertPayout: money.expertPayout,
            settlementStatus: 'held',
            stepIds: [],
        };
        const steps = buildInitialWorkSteps(proposal, work.id);
        localStorage.setItem(STORAGE_KEYS.WORKS, JSON.stringify([...works, { ...work, stepIds: steps.map((step) => step.id) }]));

        const stepsRaw = localStorage.getItem(STORAGE_KEYS.WORK_STEPS);
        const storedSteps = stepsRaw ? (JSON.parse(stepsRaw) as WorkStep[]) : [];
        localStorage.setItem(STORAGE_KEYS.WORK_STEPS, JSON.stringify([...storedSteps, ...steps]));

        const proposalRaw = localStorage.getItem(STORAGE_KEYS.PROPOSALS);
        const proposals = proposalRaw ? (JSON.parse(proposalRaw) as Proposal[]) : [];
        localStorage.setItem(
            STORAGE_KEYS.PROPOSALS,
            JSON.stringify(
                proposals.map((storedProposal) =>
                    storedProposal.id === proposal.id
                        ? {
                            ...storedProposal,
                            status: 'accepted',
                            paymentStatus: 'paid',
                            platformFeeRate: PLATFORM_FEE_RATE,
                        }
                        : storedProposal,
                ),
            ),
        );

        const requestRaw = localStorage.getItem(STORAGE_KEYS.REQUESTS);
        const requests = requestRaw ? (JSON.parse(requestRaw) as ServiceRequestData[]) : [];
        localStorage.setItem(
            STORAGE_KEYS.REQUESTS,
            JSON.stringify(
                requests.map((request) =>
                    String(request.id) === proposal.requestId ? { ...request, status: 'in_progress' } : request,
                ),
            ),
        );
        return work.id;
    }

    if (proposal.paymentStatus === 'paid') {
        const { data: existingWorkData } = await supabase
            .from('works')
            .select('id')
            .eq('proposal_id', proposal.id)
            .single();

        if (existingWorkData?.id) return existingWorkData.id;
    }

    const { error: proposalError } = await supabase
        .from('proposals')
        .update({
            status: 'accepted',
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            platform_fee_rate: PLATFORM_FEE_RATE,
        })
        .eq('id', proposal.id);

    if (proposalError) throw new Error('데이터베이스 통신 오류: 제안서 승인 실패');

    const { data: workData, error: workError } = await supabase.from('works').insert([{
        proposal_id: proposal.id,
        request_id: proposal.requestId,
        client_id: proposal.clientId,
        expert_id: proposal.expertId,
        title: proposal.title,
        progress_type: proposal.progressType,
        status: 'in_progress',
        total_price: proposal.totalPrice,
        platform_fee: money.platformFee,
        expert_payout: money.expertPayout,
        settlement_status: 'held',
    }]).select('id').single();

    if (workError) throw new Error('데이터베이스 통신 오류: 작업 생성 실패');

    const steps = buildInitialWorkSteps(proposal, workData.id);
    const { error: stepError } = await supabase.from('work_steps').insert(
        steps.map((step) => ({
            work_id: step.workId,
            step_order: step.stepOrder,
            title: step.title,
            description: step.description,
            status: step.status,
        })),
    );

    if (stepError) throw new Error('데이터베이스 통신 오류: 작업 단계 생성 실패');

    const { error: requestError } = await supabase
        .from('service_requests')
        .update({ status: 'in_progress' })
        .eq('id', proposal.requestId);

    if (requestError) throw new Error('데이터베이스 통신 오류: 요청 상태 변경 실패');
    return workData.id;
}

export async function requestProposalRevision(proposalId: string): Promise<void> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.PROPOSALS);
        const proposals = raw ? (JSON.parse(raw) as Proposal[]) : [];
        localStorage.setItem(
            STORAGE_KEYS.PROPOSALS,
            JSON.stringify(
                proposals.map((proposal) =>
                    proposal.id === proposalId ? { ...proposal, status: 'revision_requested' } : proposal,
                ),
            ),
        );
        return;
    }

    const { error } = await supabase
        .from('proposals')
        .update({ status: 'revision_requested' })
        .eq('id', proposalId);

    if (error) throw new Error('데이터베이스 통신 오류: 제안서 수정 요청 실패');
}

export async function cancelProposal(proposalId: string): Promise<void> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.PROPOSALS);
        const proposals = raw ? (JSON.parse(raw) as Proposal[]) : [];
        localStorage.setItem(
            STORAGE_KEYS.PROPOSALS,
            JSON.stringify(
                proposals.map((proposal) => (proposal.id === proposalId ? { ...proposal, status: 'cancelled' } : proposal)),
            ),
        );
        return;
    }

    const { error } = await supabase.from('proposals').update({ status: 'cancelled' }).eq('id', proposalId);

    if (error) throw new Error('데이터베이스 통신 오류: 제안서 취소 실패');
}

export async function getWorkroomData(workId: string): Promise<{
    work: Work | null;
    steps: WorkStep[];
    deliverables: Deliverable[];
}> {
    if (!supabase) {
        const worksRaw = localStorage.getItem(STORAGE_KEYS.WORKS);
        const stepsRaw = localStorage.getItem(STORAGE_KEYS.WORK_STEPS);
        const deliverablesRaw = localStorage.getItem(STORAGE_KEYS.DELIVERABLES);
        const works = worksRaw ? (JSON.parse(worksRaw) as Work[]) : [];
        const steps = stepsRaw ? (JSON.parse(stepsRaw) as WorkStep[]) : [];
        const deliverables = deliverablesRaw ? (JSON.parse(deliverablesRaw) as Deliverable[]) : [];
        const workDeliverables = deliverables
            .filter((deliverable) => deliverable.workId === workId)
            .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        return {
            work: works.find((work) => work.id === workId) || null,
            steps: steps.filter((step) => step.workId === workId),
            deliverables: workDeliverables,
        };
    }

    const { data: workData, error: workError } = await supabase
        .from('works')
        .select('*')
        .eq('id', workId)
        .single();

    if (workError || !workData) return { work: null, steps: [], deliverables: [] };

    const { data: stepData } = await supabase
        .from('work_steps')
        .select('*')
        .eq('work_id', workId)
        .order('step_order', { ascending: true });

    const { data: deliverableData } = await supabase
        .from('deliverables')
        .select('*')
        .eq('work_id', workId)
        .order('submitted_at', { ascending: false });

    const steps = (stepData || []).map(toWorkStep);
    const work = toWork(workData);

    return {
        work: { ...work, stepIds: steps.map((step) => step.id) },
        steps,
        deliverables: (deliverableData || []).map(toDeliverable),
    };
}

export async function getWorkByProposal(proposalId: string): Promise<Work | null> {
    if (!supabase) {
        const worksRaw = localStorage.getItem(STORAGE_KEYS.WORKS);
        const works = worksRaw ? (JSON.parse(worksRaw) as Work[]) : [];
        return works.find((work) => work.proposalId === proposalId) || null;
    }

    const { data, error } = await supabase
        .from('works')
        .select('*')
        .eq('proposal_id', proposalId)
        .single();

    if (error || !data) return null;

    return toWork(data);
}

export async function getUserWorks(userId: string): Promise<Work[]> {
    if (!supabase) {
        const worksRaw = localStorage.getItem(STORAGE_KEYS.WORKS);
        const works = worksRaw ? (JSON.parse(worksRaw) as Work[]) : [];
        return works.filter((work) => work.clientId === userId || work.expertId === userId);
    }

    const { data, error } = await supabase
        .from('works')
        .select('*')
        .or(`client_id.eq.${userId},expert_id.eq.${userId}`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('사용자 작업 목록 로딩 실패:', error);
        return [];
    }

    return (data || []).map(toWork);
}

export async function cancelWork(workId: string): Promise<void> {
    if (!supabase) {
        const worksRaw = localStorage.getItem(STORAGE_KEYS.WORKS);
        const works = worksRaw ? (JSON.parse(worksRaw) as Work[]) : [];
        localStorage.setItem(
            STORAGE_KEYS.WORKS,
            JSON.stringify(
                works.map((work) =>
                    work.id === workId ? { ...work, status: 'cancelled', settlementStatus: 'refunded' } : work,
                ),
            ),
        );
        return;
    }

    const { error } = await supabase
        .from('works')
        .update({ status: 'cancelled', settlement_status: 'refunded' })
        .eq('id', workId);

    if (error) throw new Error('데이터베이스 통신 오류: 거래 중단 실패');
}

export async function getWorkMessages(workId: string): Promise<WorkMessage[]> {
    const getLocalMessages = () => {
        const raw = localStorage.getItem(STORAGE_KEYS.WORK_MESSAGES);
        const messages = raw ? (JSON.parse(raw) as WorkMessage[]) : [];
        return messages
            .filter((message) => message.workId === workId)
            .sort((first, second) => Date.parse(first.createdAt) - Date.parse(second.createdAt));
    };

    if (!supabase) return getLocalMessages();

    const { data, error } = await supabase
        .from('work_messages')
        .select('*')
        .eq('work_id', workId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('?묒뾽諛?硫붿떆吏 濡쒕뵫 ?ㅽ뙣:', error);
        return getLocalMessages();
    }

    return (data || []).map(toWorkMessage);
}

export async function saveWorkMessage(input: {
    workId: string;
    senderId: string;
    body: string;
}): Promise<WorkMessage> {
    const body = input.body.trim();
    if (!body) throw new Error('?묒뾽諛?硫붿떆吏瑜??낅젰?댁＜?몄슂.');
    const now = new Date().toISOString();

    const saveLocalMessage = () => {
        const message: WorkMessage = {
            id: `work-message-${Date.now()}`,
            workId: input.workId,
            senderId: input.senderId,
            body,
            attachmentUrls: [],
            createdAt: now,
        };
        const raw = localStorage.getItem(STORAGE_KEYS.WORK_MESSAGES);
        const messages = raw ? (JSON.parse(raw) as WorkMessage[]) : [];
        localStorage.setItem(STORAGE_KEYS.WORK_MESSAGES, JSON.stringify([...messages, message]));
        return message;
    };

    if (!supabase) return saveLocalMessage();

    const { data, error } = await supabase
        .from('work_messages')
        .insert({
            work_id: input.workId,
            sender_id: input.senderId,
            body,
            attachment_urls: [],
        })
        .select()
        .single();

    if (error || !data) {
        console.error('?묒뾽諛?硫붿떆吏 ????ㅽ뙣:', error);
        return saveLocalMessage();
    }

    return toWorkMessage(data);
}

export async function saveDeliverable(deliverable: Deliverable): Promise<void> {
    if (hasExternalContact(deliverable.description)) {
        throw new Error(EXTERNAL_CONTACT_WARNING);
    }

    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.DELIVERABLES);
        const deliverables = raw ? (JSON.parse(raw) as Deliverable[]) : [];
        localStorage.setItem(STORAGE_KEYS.DELIVERABLES, JSON.stringify([...deliverables, deliverable]));
        const worksRaw = localStorage.getItem(STORAGE_KEYS.WORKS);
        const works = worksRaw ? (JSON.parse(worksRaw) as Work[]) : [];
        localStorage.setItem(
            STORAGE_KEYS.WORKS,
            JSON.stringify(works.map((work) => (work.id === deliverable.workId ? { ...work, status: 'submitted' } : work))),
        );
        if (deliverable.stepId) {
            const stepsRaw = localStorage.getItem(STORAGE_KEYS.WORK_STEPS);
            const steps = stepsRaw ? (JSON.parse(stepsRaw) as WorkStep[]) : [];
            localStorage.setItem(
                STORAGE_KEYS.WORK_STEPS,
                JSON.stringify(
                    steps.map((step) =>
                        step.id === deliverable.stepId ? { ...step, status: 'submitted' } : step,
                    ),
                ),
            );
        }
        return;
    }

    const { error } = await supabase.from('deliverables').insert([{
        ...(isUuid(deliverable.id) ? { id: deliverable.id } : {}),
        work_id: deliverable.workId,
        step_id: deliverable.stepId || null,
        expert_id: deliverable.expertId,
        description: deliverable.description,
        external_url: deliverable.externalUrl || null,
        file_url: deliverable.fileUrl || null,
        status: deliverable.status,
    }]);

    if (error) throw new Error('데이터베이스 통신 오류: 제출물 저장 실패');

    if (deliverable.stepId) {
        const { error: stepError } = await supabase
            .from('work_steps')
            .update({ status: 'submitted' })
            .eq('id', deliverable.stepId);

        if (stepError) throw new Error('데이터베이스 통신 오류: 단계 제출 처리 실패');
    }

    const { error: workError } = await supabase
        .from('works')
        .update({ status: 'submitted' })
        .eq('id', deliverable.workId);

    if (workError) throw new Error('데이터베이스 통신 오류: 작업 제출 처리 실패');
}

export async function approveWorkDeliverable(
    workId: string,
    deliverableId: string,
    requestId?: string,
    stepId?: string,
): Promise<void> {
    if (!supabase) {
        const deliverablesRaw = localStorage.getItem(STORAGE_KEYS.DELIVERABLES);
        const worksRaw = localStorage.getItem(STORAGE_KEYS.WORKS);
        const stepsRaw = localStorage.getItem(STORAGE_KEYS.WORK_STEPS);
        const deliverables = deliverablesRaw ? (JSON.parse(deliverablesRaw) as Deliverable[]) : [];
        const works = worksRaw ? (JSON.parse(worksRaw) as Work[]) : [];
        const steps = stepsRaw ? (JSON.parse(stepsRaw) as WorkStep[]) : [];

        localStorage.setItem(
            STORAGE_KEYS.DELIVERABLES,
            JSON.stringify(
                deliverables.map((deliverable) =>
                    deliverable.id === deliverableId ? { ...deliverable, status: 'approved' } : deliverable,
                ),
            ),
        );
        localStorage.setItem(
            STORAGE_KEYS.WORKS,
            JSON.stringify(
                works.map((work) =>
                    work.id === workId ? { ...work, status: 'completed', settlementStatus: 'pending' } : work,
                ),
            ),
        );
        if (stepId) {
            localStorage.setItem(
                STORAGE_KEYS.WORK_STEPS,
                JSON.stringify(steps.map((step) => (step.id === stepId ? { ...step, status: 'approved' } : step))),
            );
        }
        if (requestId) {
            const requestsRaw = localStorage.getItem(STORAGE_KEYS.REQUESTS);
            const requests = requestsRaw ? (JSON.parse(requestsRaw) as ServiceRequestData[]) : [];
            localStorage.setItem(
                STORAGE_KEYS.REQUESTS,
                JSON.stringify(
                    requests.map((request) =>
                        String(request.id) === requestId ? { ...request, status: 'completed' } : request,
                    ),
                ),
            );
        }
        return;
    }

    const { error: deliverableError } = await supabase
        .from('deliverables')
        .update({ status: 'approved' })
        .eq('id', deliverableId);

    if (deliverableError) throw new Error('데이터베이스 통신 오류: 제출물 승인 실패');

    if (stepId) {
        const { error: stepError } = await supabase
            .from('work_steps')
            .update({ status: 'approved' })
            .eq('id', stepId);

        if (stepError) throw new Error('데이터베이스 통신 오류: 단계 승인 처리 실패');
    }

    const { error: workError } = await supabase
        .from('works')
        .update({
            status: 'completed',
            settlement_status: 'pending',
            completed_at: new Date().toISOString(),
        })
        .eq('id', workId);

    if (workError) throw new Error('데이터베이스 통신 오류: 작업 완료 처리 실패');
    if (requestId) {
        const { error: requestError } = await supabase
            .from('service_requests')
            .update({ status: 'completed' })
            .eq('id', requestId);

        if (requestError) throw new Error('데이터베이스 통신 오류: 요청 완료 처리 실패');
    }
}

export async function requestWorkRevision(workId: string, deliverableId: string, stepId?: string): Promise<void> {
    if (!supabase) {
        const deliverablesRaw = localStorage.getItem(STORAGE_KEYS.DELIVERABLES);
        const worksRaw = localStorage.getItem(STORAGE_KEYS.WORKS);
        const stepsRaw = localStorage.getItem(STORAGE_KEYS.WORK_STEPS);
        const deliverables = deliverablesRaw ? (JSON.parse(deliverablesRaw) as Deliverable[]) : [];
        const works = worksRaw ? (JSON.parse(worksRaw) as Work[]) : [];
        const steps = stepsRaw ? (JSON.parse(stepsRaw) as WorkStep[]) : [];

        localStorage.setItem(
            STORAGE_KEYS.DELIVERABLES,
            JSON.stringify(
                deliverables.map((deliverable) =>
                    deliverable.id === deliverableId
                        ? { ...deliverable, status: 'revision_requested' }
                        : deliverable,
                ),
            ),
        );
        localStorage.setItem(
            STORAGE_KEYS.WORKS,
            JSON.stringify(
                works.map((work) => (work.id === workId ? { ...work, status: 'revision_requested' } : work)),
            ),
        );
        if (stepId) {
            localStorage.setItem(
                STORAGE_KEYS.WORK_STEPS,
                JSON.stringify(
                    steps.map((step) => (step.id === stepId ? { ...step, status: 'revision_requested' } : step)),
                ),
            );
        }
        return;
    }

    const { error: deliverableError } = await supabase
        .from('deliverables')
        .update({ status: 'revision_requested' })
        .eq('id', deliverableId);

    if (deliverableError) throw new Error('데이터베이스 통신 오류: 제출물 수정 요청 실패');

    if (stepId) {
        const { error: stepError } = await supabase
            .from('work_steps')
            .update({ status: 'revision_requested' })
            .eq('id', stepId);

        if (stepError) throw new Error('데이터베이스 통신 오류: 단계 수정 요청 처리 실패');
    }

    const { error: workError } = await supabase
        .from('works')
        .update({ status: 'revision_requested' })
        .eq('id', workId);

    if (workError) throw new Error('데이터베이스 통신 오류: 작업 수정 요청 실패');
}

export async function saveReview(review: Review): Promise<void> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.REVIEWS);
        const reviews = raw ? (JSON.parse(raw) as Review[]) : [];
        localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify([...reviews, review]));
        return;
    }

    const { error } = await supabase.from('reviews').insert([{
        ...(isUuid(review.id) ? { id: review.id } : {}),
        work_id: review.workId,
        client_id: review.clientId,
        expert_id: review.expertId,
        rating: review.rating,
        content: review.content,
    }]);

    if (error) throw new Error('데이터베이스 통신 오류: 리뷰 저장 실패');
}

export async function getUserReviews(userId: string): Promise<Review[]> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.REVIEWS);
        const reviews = raw ? (JSON.parse(raw) as Review[]) : [];
        return reviews.filter((review) => review.clientId === userId || review.expertId === userId);
    }

    const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .or(`client_id.eq.${userId},expert_id.eq.${userId}`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('리뷰 목록 로딩 실패:', error);
        return [];
    }

    return (data || []).map(toReview);
}

export async function getExpertReviews(expertId: string): Promise<Review[]> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.REVIEWS);
        const reviews = raw ? (JSON.parse(raw) as Review[]) : [];
        return reviews
            .filter((review) => review.expertId === expertId)
            .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
    }

    const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('expert_id', expertId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('전문가 공개 리뷰 로딩 실패:', error);
        return [];
    }

    return (data || []).map(toReview);
}

export async function getExpertList(): Promise<Expert[]> {
    if (!supabase) {
        return [];
    }

    const { data, error } = await supabase
        .from('expert_profiles')
        .select('*')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('전문가 목록 로딩 실패:', error);
        return [];
    }

    if (!data) return [];

    return data.map((item) => {
        // 패키지에서 기본 가격 추출 (문자열 -> 숫자 변환 시도)
        let basePrice = 0;
        if (item.packages?.standard?.price) {
            const priceStr = String(item.packages.standard.price).replace(/[^0-9]/g, '');
            basePrice = parseInt(priceStr, 10) || 0;
        }

        return {
            id: item.user_id,
            name: item.name || '이름 없음',
            profession: item.profession || '분야 미지정',
            rating: 0, // 리뷰 시스템 연동 후 수정 (Step 4)
            reviews: 0, // 리뷰 시스템 연동 후 수정 (Step 4)
            price: basePrice,
            imageUrl: item.image_url || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600', // 기본 이미지
            // 필요한 경우 one_liner도 포함시킬 수 있음
            oneLiner: item.one_liner || '',
        } as Expert & { oneLiner?: string }; // Category.tsx 검색을 위해 oneLiner 속성 임시 허용
    });
}
