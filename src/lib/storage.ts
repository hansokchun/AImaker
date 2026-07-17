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
    SettlementPayout,
    Work,
    WorkMessage,
    WorkStep,
} from '../types';
import { supabase } from './supabase';
import { PLATFORM_FEE_RATE, calculateSettlementAmounts } from '../constants/settlement';
import { mockExpertProducts } from '../data/mockData';
import { buildDemoAccountData, isDemoAccountRecordId, isDemoTestAccountEmail } from '../data/demoAccountData';
import { EXTERNAL_CONTACT_WARNING, hasExternalContact } from '../constants/policies';
import { readCachedExpertProducts, writeCachedExpertProducts } from './expertProductCache';
import { validateMarketplaceMessage } from './tradeSafety';
import { SAFE_EXTERNAL_URL_MESSAGE, normalizeSafeExternalUrl } from './urlSafety';
import {
    getNotificationPreference,
    getUserNotifications,
    queueNotificationEvent,
    saveNotificationPreference,
} from './notificationStorage';
import {
    getExpertPayoutAccount,
    getExpertSettlementPayouts,
    saveExpertPayoutAccount,
} from './payoutStorage';
import type { User } from '@supabase/supabase-js';
import type { AdminReport, AdminReportSeverity, AdminReportTargetType } from './adminStorage';

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
    ADMIN_REPORTS: 'ai_admin_reports',
    EXPERT_PAYOUT_ACCOUNTS: 'ai_expert_payout_accounts',
    SETTLEMENT_PAYOUTS: 'ai_settlement_payouts',
    USER_NOTIFICATION_PREFERENCES: 'ai_user_notification_preferences',
    NOTIFICATION_EVENTS: 'ai_notification_events',
} as const;

const DEMO_ACCOUNT_USER_ID_KEY = 'ai_demo_account_user_id';
const DEMO_ACCOUNT_USER_NAME_KEY = 'ai_demo_account_user_name';
const CLOSED_CONSULTATION_RETENTION_DAYS = 7;
const CLOSED_CONSULTATION_RETENTION_MS = CLOSED_CONSULTATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const AUTO_PURCHASE_CONFIRM_DAYS = 7;
const AUTO_PURCHASE_CONFIRM_MS = AUTO_PURCHASE_CONFIRM_DAYS * 24 * 60 * 60 * 1000;
export const CANCELLATION_RESPONSE_HOURS = 24;
const CANCELLATION_RESPONSE_MS = CANCELLATION_RESPONSE_HOURS * 60 * 60 * 1000;

const isUuid = (value?: string) =>
    Boolean(value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i));

const toOptionalNumber = (value?: string): number | null => {
    const numericValue = Number(String(value || '').replace(/[^\d]/g, ''));
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
};

const getFavoriteProductsStorageKey = (userId: string) => `${STORAGE_KEYS.FAVORITE_PRODUCTS}_${userId}`;

const readLocalArray = <T>(key: string): T[] => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
        return [];
    }
};

const writeLocalArray = <T>(key: string, items: T[]): void => {
    localStorage.setItem(key, JSON.stringify(items));
};

const mergeById = <T extends { id: string | number }>(first: T[], second: T[]): T[] => {
    const seen = new Set<string>();
    const merged: T[] = [];

    for (const item of [...first, ...second]) {
        const key = String(item.id);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(item);
    }

    return merged;
};

const isConsultationVisible = (consultation: Consultation): boolean => {
    if (consultation.status !== 'closed') return true;
    const referenceTime = Date.parse(consultation.lastMessageAt || consultation.createdAt || '');
    if (Number.isNaN(referenceTime)) return true;
    return Date.now() - referenceTime < CLOSED_CONSULTATION_RETENTION_MS;
};

const demoRecordsOnly = <T extends { id: string | number }>(items: T[]) =>
    items.filter((item) => isDemoAccountRecordId(item.id));

const getLocalProfile = (userId: string): ExpertProfile | null => {
    try {
        const raw = localStorage.getItem(`${STORAGE_KEYS.PROFILE}_${userId}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? parsed as ExpertProfile : null;
    } catch {
        return null;
    }
};

const isLocalProfileRestricted = (userId: string): boolean => {
    const profile = getLocalProfile(userId) as (ExpertProfile & { moderationStatus?: string }) | null;
    return profile?.moderationStatus === 'restricted';
};

const getLocalUserRequests = (userId: string) =>
    readLocalArray<ServiceRequestData>(STORAGE_KEYS.REQUESTS)
        .filter((request) => request.clientId === userId || request.expertId === userId);

const getLocalUserConsultations = (userId: string) =>
    readLocalArray<Consultation>(STORAGE_KEYS.CONSULTATIONS)
        .filter((consultation) => consultation.clientId === userId || consultation.expertId === userId)
        .filter(isConsultationVisible)
        .sort((first, second) => Date.parse(second.lastMessageAt || second.createdAt) - Date.parse(first.lastMessageAt || first.createdAt));

const getLocalConsultationMessages = (consultationId: string) =>
    readLocalArray<ConsultationMessage>(STORAGE_KEYS.CONSULTATION_MESSAGES)
        .filter((message) => message.consultationId === consultationId)
        .sort((first, second) => Date.parse(first.createdAt) - Date.parse(second.createdAt));

const getLocalUserProposals = (userId: string) =>
    readLocalArray<Proposal>(STORAGE_KEYS.PROPOSALS)
        .filter((proposal) => proposal.clientId === userId || proposal.expertId === userId)
        .map(normalizeProposalStatus);

const getLocalUserWorks = (userId: string) =>
    readLocalArray<Work>(STORAGE_KEYS.WORKS)
        .filter((work) => work.clientId === userId || work.expertId === userId);

const getLocalWorkMessages = (workId: string) =>
    readLocalArray<WorkMessage>(STORAGE_KEYS.WORK_MESSAGES)
        .filter((message) => message.workId === workId)
        .sort((first, second) => Date.parse(first.createdAt) - Date.parse(second.createdAt));

const getLocalUserReviews = (userId: string) =>
    readLocalArray<Review>(STORAGE_KEYS.REVIEWS)
        .filter((review) => (review.clientId === userId || review.expertId === userId) && review.status !== 'hidden');

const getLocalExpertReviews = (expertId: string) =>
    readLocalArray<Review>(STORAGE_KEYS.REVIEWS)
        .filter((review) => review.expertId === expertId && review.status !== 'hidden')
        .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));

const hasLocalDemoWork = (workId: string) =>
    isDemoAccountRecordId(workId);

const hasLocalDemoConsultation = (consultationId: string) =>
    isDemoAccountRecordId(consultationId);

const hasLocalDemoProposal = (proposalId: string) =>
    isDemoAccountRecordId(proposalId) && readLocalArray<Proposal>(STORAGE_KEYS.PROPOSALS).some((proposal) => proposal.id === proposalId);

const getProposalConsultationId = (proposal: Proposal): string | null =>
    proposal.consultationId || getConsultationIdFromRequestId(proposal.requestId);

const shouldStoreProposalLocally = (proposal: Proposal) =>
    hasLocalDemoProposal(proposal.id)
    || isDemoAccountRecordId(proposal.requestId)
    || Boolean(getProposalConsultationId(proposal) && !isUuid(getProposalConsultationId(proposal) || undefined))
    || proposal.id.includes('demo-consultation')
    || proposal.requestId.includes('demo-consultation');

const getConsultationIdFromRequestId = (requestId: string | number): string | null => {
    const value = String(requestId);
    return value.startsWith('consultation-') ? value.slice('consultation-'.length) : null;
};

const isLocalOnlyProposal = (proposal: Proposal) =>
    shouldStoreProposalLocally(proposal);

const seedDemoArray = <T extends { id: string | number }>(key: string, items: T[]) => {
    const demoIds = new Set(items.map((item) => String(item.id)));
    const existing = readLocalArray<T>(key).filter((item) => !demoIds.has(String(item.id)));
    writeLocalArray(key, [...items, ...existing]);
};

const seedDemoAccountData = (userId: string, userName: string) => {
    const data = buildDemoAccountData(userId, userName);

    for (const [profileId, profile] of Object.entries(data.profiles)) {
        localStorage.setItem(`${STORAGE_KEYS.PROFILE}_${profileId}`, JSON.stringify(profile));
    }

    seedDemoArray(STORAGE_KEYS.PRODUCTS, data.products);
    seedDemoArray(STORAGE_KEYS.REQUESTS, data.requests);
    seedDemoArray(STORAGE_KEYS.PROPOSALS, data.proposals);
    seedDemoArray(STORAGE_KEYS.WORKS, data.works);
    seedDemoArray(STORAGE_KEYS.WORK_STEPS, data.workSteps);
    seedDemoArray(STORAGE_KEYS.DELIVERABLES, data.deliverables);
    seedDemoArray(STORAGE_KEYS.REVIEWS, data.reviews);
    seedDemoArray(STORAGE_KEYS.CONSULTATIONS, data.consultations);
    seedDemoArray(STORAGE_KEYS.CONSULTATION_MESSAGES, data.consultationMessages);
    seedDemoArray(STORAGE_KEYS.WORK_MESSAGES, data.workMessages);
    localStorage.setItem(getFavoriteProductsStorageKey(userId), JSON.stringify(data.favoriteProductIds));
};

const rememberDemoAccountIfNeeded = (user: Pick<User, 'id' | 'email' | 'user_metadata'>) => {
    if (!isDemoTestAccountEmail(user.email)) return;

    const displayName = user.user_metadata?.display_name || user.user_metadata?.name || user.email?.split('@')[0] || '석준';
    localStorage.setItem(DEMO_ACCOUNT_USER_ID_KEY, user.id);
    localStorage.setItem(DEMO_ACCOUNT_USER_NAME_KEY, displayName);
    seedDemoAccountData(user.id, displayName);
};

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
        optionValues: packageData.optionValues || packageData.option_values || undefined,
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

const toReview = (item: any): Review => {
    const clientName = item.client_name || item.clientName || item.reviewer_name;
    const clientImageUrl = item.client_image_url || item.clientImageUrl || item.reviewer_image_url;
    const createdAtLabel = item.created_at_label || item.createdAtLabel;
    const priceRangeLabel = item.price_range_label || item.priceRangeLabel;
    const workDurationDays = item.work_duration_days ?? item.workDurationDays;
    const status = item.status === 'hidden' ? 'hidden' : undefined;

    return {
        id: item.id,
        workId: item.work_id,
        clientId: item.client_id,
        ...(clientName ? { clientName } : {}),
        ...(clientImageUrl ? { clientImageUrl } : {}),
        expertId: item.expert_id,
        rating: item.rating,
        content: item.content,
        createdAt: item.created_at,
        ...(status ? { status } : {}),
        ...(createdAtLabel ? { createdAtLabel } : {}),
        ...(priceRangeLabel ? { priceRangeLabel } : {}),
        ...(workDurationDays !== undefined && workDurationDays !== null ? { workDurationDays: Number(workDurationDays) } : {}),
    };
};

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
    id: request.id,
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

const toTextList = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && 'title' in item) {
                const title = (item as { title?: unknown }).title;
                return typeof title === 'string' ? title : '';
            }
            return '';
        })
        .filter(Boolean);
};

const toProposal = (item: any): Proposal => normalizeProposalStatus({
    id: item.id,
    requestId: item.request_id || (item.consultation_id ? `consultation-${item.consultation_id}` : ''),
    ...(item.consultation_id ? { consultationId: item.consultation_id } : {}),
    clientId: item.client_id,
    expertId: item.expert_id,
    title: item.title,
    scope: item.scope,
    deliverables: toTextList(item.deliverables),
    totalPrice: item.total_price || 0,
    deliveryDays: item.delivery_days || 0,
    revisionCount: item.revision_count || 0,
    progressType: item.progress_type || 'single',
    milestones: toTextList(item.milestones),
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
    ...(item.refund_status ? { refundStatus: item.refund_status } : {}),
    ...(item.dispute_status ? { disputeStatus: item.dispute_status } : {}),
    ...(item.cancellation_reason ? { cancellationReason: item.cancellation_reason } : {}),
    ...(item.cancellation_requested_by ? { cancellationRequestedBy: item.cancellation_requested_by } : {}),
    ...(item.cancellation_requested_at ? { cancellationRequestedAt: item.cancellation_requested_at } : {}),
    ...(item.settlement_requested_at ? { settlementRequestedAt: item.settlement_requested_at } : {}),
    ...(item.settlement_settled_at ? { settlementSettledAt: item.settlement_settled_at } : {}),
    ...(item.settlement_hold_reason ? { settlementHoldReason: item.settlement_hold_reason } : {}),
    ...(item.cancelled_at ? { cancelledAt: item.cancelled_at } : {}),
    ...(item.completed_at ? { completedAt: item.completed_at } : {}),
    ...(item.revision_limit !== undefined && item.revision_limit !== null ? { revisionLimit: item.revision_limit } : {}),
    ...(item.revision_used !== undefined && item.revision_used !== null ? { revisionUsed: item.revision_used } : {}),
    stepIds: [],
});

const getProposalMoney = (proposal: Proposal) =>
    calculateSettlementAmounts(proposal.totalPrice, proposal.platformFeeRate ?? PLATFORM_FEE_RATE);

const toWorkStep = (item: any): WorkStep => ({
    id: item.id,
    workId: item.work_id,
    stepOrder: item.step_order,
    title: item.title,
    description: item.description || '',
    status: item.status || 'waiting',
});

const toDeliverable = (item: any): Deliverable => {
    const safeExternalUrl = normalizeSafeExternalUrl(item.external_url);
    const submittedAt = item.submitted_at;

    return {
        id: item.id,
        workId: item.work_id,
        stepId: item.step_id,
        expertId: item.expert_id,
        description: item.description,
        ...(safeExternalUrl ? { externalUrl: safeExternalUrl } : {}),
        ...(item.file_url ? { fileUrl: item.file_url } : {}),
        status: item.status || 'submitted',
        submittedAt,
        ...(typeof submittedAt === 'string' ? { autoPurchaseConfirmAt: getAutoPurchaseConfirmAt(submittedAt) } : {}),
    };
};

export const getAutoPurchaseConfirmAt = (submittedAt: string): string => {
    const submittedTime = Date.parse(submittedAt);
    if (Number.isNaN(submittedTime)) return submittedAt;
    return new Date(submittedTime + AUTO_PURCHASE_CONFIRM_MS).toISOString();
};

export const getCancellationAutoCancelAt = (requestedAt: string): string => {
    const requestedTime = Date.parse(requestedAt);
    if (Number.isNaN(requestedTime)) return requestedAt;
    return new Date(requestedTime + CANCELLATION_RESPONSE_MS).toISOString();
};

const hasOpenCancellationRequest = (work: Work): boolean => Boolean(work.cancellationRequestedAt && work.cancellationRequestedBy);

const findAutoPurchaseConfirmTarget = (
    work: Work,
    deliverables: readonly Deliverable[],
    now = new Date(),
): Deliverable | null => {
    if (work.status !== 'submitted') return null;
    if (work.settlementStatus && work.settlementStatus !== 'held') return null;
    if (work.disputeStatus === 'open') return null;
    if (hasOpenCancellationRequest(work)) return null;

    const target = deliverables.find((deliverable) => deliverable.status === 'submitted');
    if (!target) return null;

    const confirmTime = Date.parse(target.autoPurchaseConfirmAt || getAutoPurchaseConfirmAt(target.submittedAt));
    if (Number.isNaN(confirmTime)) return null;

    return confirmTime <= now.getTime() ? target : null;
};

const shouldAutoCancelWork = (work: Work, now = new Date()): boolean => {
    if (!hasOpenCancellationRequest(work)) return false;
    if (work.status === 'completed' || work.status === 'cancelled') return false;
    if (work.disputeStatus === 'open') return false;

    const cancelTime = Date.parse(getCancellationAutoCancelAt(work.cancellationRequestedAt || ''));
    if (Number.isNaN(cancelTime)) return false;

    return cancelTime <= now.getTime();
};

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

type TradeProposalPayload = {
    readonly id: string;
    readonly requestId: string;
    readonly consultationId?: string;
    readonly title: string;
    readonly scope: string;
    readonly deliverables: readonly string[];
    readonly totalPrice: number;
    readonly deliveryDays: number;
    readonly revisionCount: number;
    readonly progressType: Proposal['progressType'];
    readonly milestones: readonly string[];
    readonly commercialUseAllowed: boolean;
    readonly sourceFileIncluded: boolean;
    readonly paymentStatus: NonNullable<Proposal['paymentStatus']>;
    readonly expiresAt: string;
};

type TradeDeliverablePayload = {
    readonly id: string;
    readonly workId: string;
    readonly stepId?: string;
    readonly expertId: string;
    readonly description: string;
    readonly externalUrl?: string;
    readonly fileUrl?: string;
};

type TradeWorkflowRequest =
    | { readonly type: 'create_proposal'; readonly proposal: TradeProposalPayload }
    | { readonly type: 'update_proposal'; readonly proposal: TradeProposalPayload }
    | { readonly type: 'accept_proposal'; readonly proposalId: string }
    | { readonly type: 'request_proposal_revision'; readonly proposalId: string }
    | { readonly type: 'cancel_proposal'; readonly proposalId: string }
    | { readonly type: 'request_work_cancellation'; readonly workId: string; readonly reason: NonNullable<Work['cancellationReason']> }
    | { readonly type: 'accept_work_cancellation'; readonly workId: string }
    | { readonly type: 'request_settlement_withdrawal'; readonly workId: string }
    | { readonly type: 'submit_deliverable'; readonly deliverable: TradeDeliverablePayload }
    | { readonly type: 'approve_deliverable'; readonly workId: string; readonly deliverableId: string; readonly stepId?: string }
    | { readonly type: 'request_work_revision'; readonly workId: string; readonly deliverableId: string; readonly stepId?: string };

type TradeWorkflowResponse = {
    readonly proposalId?: string;
    readonly workId?: string;
    readonly deliverableId?: string;
};

const toTradeProposalPayload = (proposal: Proposal): TradeProposalPayload => ({
    id: proposal.id,
    requestId: proposal.requestId,
    ...(proposal.consultationId ? { consultationId: proposal.consultationId } : {}),
    title: proposal.title,
    scope: proposal.scope,
    deliverables: proposal.deliverables,
    totalPrice: proposal.totalPrice,
    deliveryDays: proposal.deliveryDays,
    revisionCount: proposal.revisionCount,
    progressType: proposal.progressType,
    milestones: proposal.milestones,
    commercialUseAllowed: proposal.commercialUseAllowed,
    sourceFileIncluded: proposal.sourceFileIncluded,
    paymentStatus: proposal.paymentStatus || 'unpaid',
    expiresAt: proposal.expiresAt,
});

const toTradeDeliverablePayload = (deliverable: Deliverable): TradeDeliverablePayload => ({
    id: deliverable.id,
    workId: deliverable.workId,
    ...(deliverable.stepId ? { stepId: deliverable.stepId } : {}),
    expertId: deliverable.expertId,
    description: deliverable.description,
    ...(deliverable.externalUrl ? { externalUrl: deliverable.externalUrl } : {}),
    ...(deliverable.fileUrl ? { fileUrl: deliverable.fileUrl } : {}),
});

const isTradeWorkflowResponse = (value: unknown): value is TradeWorkflowResponse => {
    if (!value || typeof value !== 'object') return false;
    const response = value as Partial<TradeWorkflowResponse>;
    return (response.proposalId === undefined || typeof response.proposalId === 'string')
        && (response.workId === undefined || typeof response.workId === 'string')
        && (response.deliverableId === undefined || typeof response.deliverableId === 'string');
};

const invokeTradeWorkflow = async (body: TradeWorkflowRequest): Promise<TradeWorkflowResponse> => {
    if (!supabase) return {};
    const { data, error } = await supabase.functions.invoke('trade-workflow', { body });
    if (error) throw new Error(error.message || '거래 상태 변경에 실패했습니다.');
    return isTradeWorkflowResponse(data) ? data : {};
};

export async function ensureUserProfile(user: Pick<User, 'id' | 'email' | 'user_metadata'>): Promise<void> {
    rememberDemoAccountIfNeeded(user);

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
    const localProfile = getLocalProfile(userId);
    const localDisplayProfile = localProfile
        ? {
            name: localProfile.name || '',
            imageUrl: localProfile.imageUrl || '',
            isExpert: Boolean(localProfile.profession || localProfile.aiTools.length),
        }
        : null;

    if (!supabase) return localDisplayProfile;

    const { data, error } = await supabase
        .from('profiles')
        .select('name, display_name, avatar_url, is_expert')
        .eq('id', userId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return localDisplayProfile;
        console.error('profiles 표시 정보 로딩 실패:', error);
        return localDisplayProfile;
    }

    if (!data) return localDisplayProfile;

    return {
        name: data.name || data.display_name || '',
        imageUrl: data.avatar_url || '',
        isExpert: Boolean(data.is_expert),
    };
}

export async function deleteUserPublicAccountData(userId: string): Promise<void> {
    if (!supabase) {
        localStorage.setItem(`${STORAGE_KEYS.PROFILE}_${userId}`, JSON.stringify({
            accountStatus: 'restricted',
            name: '탈퇴한 사용자',
            withdrawnAt: new Date().toISOString(),
        }));
        return;
    }

    const { error } = await supabase.functions.invoke('account-withdrawal');
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
        return getLocalUserRequests(userId);
    }

    const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .or(`client_id.eq.${userId},expert_id.eq.${userId}`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('사용자 의뢰 요청 목록 로딩 실패:', error);
        return demoRecordsOnly(getLocalUserRequests(userId));
    }

    return mergeById(demoRecordsOnly(getLocalUserRequests(userId)), (data || []).map(toServiceRequestData));
}

export async function getUserConsultations(userId: string): Promise<Consultation[]> {
    if (!supabase) {
        return getLocalUserConsultations(userId);
    }

    const { data, error } = await supabase
        .from('consultations')
        .select('*')
        .or(`client_id.eq.${userId},expert_id.eq.${userId}`)
        .order('last_message_at', { ascending: false });

    if (error) {
        console.error('상담 목록 로딩 실패:', error);
        return demoRecordsOnly(getLocalUserConsultations(userId));
    }

    return mergeById(demoRecordsOnly(getLocalUserConsultations(userId)), (data || []).map(toConsultation))
        .filter(isConsultationVisible);
}

export async function getConsultationMessages(consultationId: string): Promise<ConsultationMessage[]> {
    if (!supabase || hasLocalDemoConsultation(consultationId)) {
        return getLocalConsultationMessages(consultationId);
    }

    const { data, error } = await supabase
        .from('consultation_messages')
        .select('*')
        .eq('consultation_id', consultationId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('상담 메시지 로딩 실패:', error);
        return demoRecordsOnly(getLocalConsultationMessages(consultationId));
    }

    return mergeById(demoRecordsOnly(getLocalConsultationMessages(consultationId)), (data || []).map(toConsultationMessage));
}

export function subscribeToConsultationMessages(
    consultationId: string,
    onMessage: (message: ConsultationMessage) => void,
): () => void {
    if (!supabase || hasLocalDemoConsultation(consultationId)) return () => undefined;
    const supabaseClient = supabase;

    const channel = supabaseClient
        .channel(`consultation-messages:${consultationId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'consultation_messages',
            filter: `consultation_id=eq.${consultationId}`,
        }, (payload) => {
            onMessage(toConsultationMessage(payload.new));
        })
        .subscribe();

    return () => {
        void supabaseClient.removeChannel(channel);
    };
}

export async function createConsultation(input: CreateConsultationInput): Promise<Consultation> {
    const now = new Date().toISOString();
    const initialMessage = input.initialMessage?.trim() || '';

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
        const consultationRaw = localStorage.getItem(STORAGE_KEYS.CONSULTATIONS);
        const consultations = consultationRaw ? (JSON.parse(consultationRaw) as Consultation[]) : [];
        localStorage.setItem(STORAGE_KEYS.CONSULTATIONS, JSON.stringify([consultation, ...consultations]));

        if (initialMessage) {
            const message: ConsultationMessage = {
                id: `consultation-message-${Date.now()}`,
                consultationId: consultation.id,
                senderId: input.clientId,
                body: initialMessage,
                attachmentUrls: [],
                createdAt: now,
            };
            const messageRaw = localStorage.getItem(STORAGE_KEYS.CONSULTATION_MESSAGES);
            const messages = messageRaw ? (JSON.parse(messageRaw) as ConsultationMessage[]) : [];
            localStorage.setItem(STORAGE_KEYS.CONSULTATION_MESSAGES, JSON.stringify([...messages, message]));
        }
        return consultation;
    }

    const { data, error } = await supabase.rpc('create_consultation', {
        consultation_title: input.title,
        expert_user_id: input.expertId,
        initial_message: initialMessage || null,
        product_row_id: input.productId,
    });

    if (error || !data) {
        console.error('상담 생성 실패:', error);
        throw new Error('데이터베이스 통신 오류: 상담 생성 실패');
    }

    return toConsultation(data);
}

export async function saveConsultationMessage(input: {
    consultationId: string;
    senderId: string;
    body: string;
    attachmentUrls?: readonly string[];
}): Promise<ConsultationMessage> {
    const body = input.body.trim();
    const validation = validateMarketplaceMessage(body);
    if (!validation.allowed) throw new Error(validation.message);
    if (!body) throw new Error('상담 메시지를 입력해주세요.');
    const now = new Date().toISOString();

    if (!supabase || hasLocalDemoConsultation(input.consultationId)) {
        const message: ConsultationMessage = {
            id: `consultation-message-${Date.now()}`,
            consultationId: input.consultationId,
            senderId: input.senderId,
            body,
            attachmentUrls: [...(input.attachmentUrls || [])],
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

    const { data, error } = await supabase.rpc('append_consultation_message', {
        consultation_row_id: input.consultationId,
        message_attachment_urls: [...(input.attachmentUrls || [])],
        message_body: body,
    });

    if (error || !data) {
        console.error('상담 메시지 저장 실패:', error);
        throw new Error('데이터베이스 통신 오류: 상담 메시지 저장 실패');
    }

    return toConsultationMessage(data);
}

const toAdminReport = (row: Record<string, any>): AdminReport => ({
    id: String(row.id),
    reporterId: row.reporter_id || '',
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    status: row.status || 'pending',
    severity: row.severity || 'medium',
    createdAt: row.created_at || new Date().toISOString(),
    resolvedAt: row.resolved_at || undefined,
    resolvedBy: row.resolved_by || undefined,
});

export async function closeConsultation(consultationId: string): Promise<Consultation> {
    const now = new Date().toISOString();

    if (!supabase || hasLocalDemoConsultation(consultationId)) {
        const consultations = readLocalArray<Consultation>(STORAGE_KEYS.CONSULTATIONS);
        const nextConsultations = consultations.map((consultation) =>
            consultation.id === consultationId
                ? { ...consultation, status: 'closed' as const, lastMessageAt: consultation.lastMessageAt || now }
                : consultation,
        );
        writeLocalArray(STORAGE_KEYS.CONSULTATIONS, nextConsultations);
        const closed = nextConsultations.find((consultation) => consultation.id === consultationId);
        if (!closed) throw new Error('상담을 찾을 수 없습니다.');
        return closed;
    }

    const { data, error } = await supabase.rpc('transition_consultation', {
        consultation_row_id: consultationId,
        next_status: 'closed',
    });

    if (error || !data) {
        console.error('상담 종료 저장 실패:', error);
        throw new Error('데이터베이스 통신 오류: 상담 종료 실패');
    }

    return toConsultation(data);
}

export async function markConsultationProposalSent(consultationId: string): Promise<Consultation> {
    const now = new Date().toISOString();

    if (!supabase || hasLocalDemoConsultation(consultationId)) {
        const consultations = readLocalArray<Consultation>(STORAGE_KEYS.CONSULTATIONS);
        const nextConsultations = consultations.map((consultation) =>
            consultation.id === consultationId
                ? { ...consultation, status: 'proposal_sent' as const, lastMessageAt: now }
                : consultation,
        );
        writeLocalArray(STORAGE_KEYS.CONSULTATIONS, nextConsultations);
        const updated = nextConsultations.find((consultation) => consultation.id === consultationId);
        if (!updated) throw new Error('상담을 찾을 수 없습니다.');
        return updated;
    }

    const { data, error } = await supabase.rpc('transition_consultation', {
        consultation_row_id: consultationId,
        next_status: 'proposal_sent',
    });

    if (error || !data) {
        console.error('상담 제안서 발송 상태 저장 실패:', error);
        throw new Error('데이터베이스 통신 오류: 상담 상태 저장 실패');
    }

    return toConsultation(data);
}

export async function saveConsultationReport(input: {
    consultationId: string;
    reporterId: string;
    reason?: string;
}): Promise<AdminReport> {
    const now = new Date().toISOString();
    const reason = input.reason?.trim() || '상담 채팅 신고';

    if (!supabase || hasLocalDemoConsultation(input.consultationId)) {
        const report: AdminReport = {
            id: `report-consultation-${input.consultationId}-${Date.now()}`,
            reporterId: input.reporterId,
            targetType: 'consultation',
            targetId: input.consultationId,
            reason,
            status: 'pending',
            severity: 'medium',
            createdAt: now,
        };
        writeLocalArray(STORAGE_KEYS.ADMIN_REPORTS, [report, ...readLocalArray<AdminReport>(STORAGE_KEYS.ADMIN_REPORTS)]);
        return report;
    }

    const { data, error } = await supabase
        .from('admin_reports')
        .insert({
            reporter_id: input.reporterId,
            target_type: 'consultation',
            target_id: input.consultationId,
            reason,
            status: 'pending',
            severity: 'medium',
        })
        .select()
        .single();

    if (error || !data) {
        console.error('상담 신고 저장 실패:', error);
        throw new Error('데이터베이스 통신 오류: 상담 신고 실패');
    }

    return toAdminReport(data);
}

export async function saveReport(input: {
    reporterId: string;
    targetType: AdminReportTargetType;
    targetId?: string;
    reason: string;
    severity?: AdminReportSeverity;
}): Promise<AdminReport> {
    const now = new Date().toISOString();
    const reason = input.reason.trim();
    const targetId = input.targetId?.trim() || input.reporterId;
    const severity = input.severity || 'medium';

    if (!reason) throw new Error('신고 내용을 입력해주세요.');

    if (!supabase) {
        const report: AdminReport = {
            id: `report-${input.targetType}-${targetId}-${Date.now()}`,
            reporterId: input.reporterId,
            targetType: input.targetType,
            targetId,
            reason,
            status: 'pending',
            severity,
            createdAt: now,
        };
        writeLocalArray(STORAGE_KEYS.ADMIN_REPORTS, [report, ...readLocalArray<AdminReport>(STORAGE_KEYS.ADMIN_REPORTS)]);
        return report;
    }

    const { data, error } = await supabase
        .from('admin_reports')
        .insert({
            reporter_id: input.reporterId,
            target_type: input.targetType,
            target_id: targetId,
            reason,
            status: 'pending',
            severity,
        })
        .select()
        .single();

    if (error || !data) {
        console.error('신고 저장 실패:', error);
        throw new Error('데이터베이스 통신 오류: 신고 저장 실패');
    }

    return toAdminReport(data);
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
    const consultationId = getConsultationIdFromRequestId(requestId);
    if (consultationId) {
        const consultation = readLocalArray<Consultation>(STORAGE_KEYS.CONSULTATIONS)
            .find((item) => item.id === consultationId);
        const supabaseConsultation = !consultation && supabase
            ? await supabase
                .from('consultations')
                .select('*')
                .eq('id', consultationId)
                .maybeSingle()
            : null;
        const source = consultation || (supabaseConsultation && !supabaseConsultation.error && supabaseConsultation.data
            ? toConsultation(supabaseConsultation.data)
            : null);
        if (!source) return null;

        return {
            id: requestId,
            title: source.title,
            description: source.title,
            budget: '',
            deadline: '',
            categories: [],
            createdAt: source.createdAt,
            updatedAt: source.lastMessageAt,
            clientId: source.clientId,
            expertId: source.expertId,
            status: source.status === 'closed' ? 'completed' : 'pending',
            productId: source.productId,
            selectedPackage: 'standard',
            desiredResult: source.title,
            purpose: source.title,
            referenceText: '',
            referenceLinks: [],
            progressType: 'single',
        };
    }

    const localRequest = readLocalArray<ServiceRequestData>(STORAGE_KEYS.REQUESTS)
        .find((request) => String(request.id) === String(requestId));

    if (!supabase) {
        return localRequest || null;
    }

    const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', String(requestId))
        .maybeSingle();

    if (error) {
        console.error('의뢰 요청 로딩 실패:', error);
        return localRequest && isDemoAccountRecordId(localRequest.id) ? localRequest : null;
    }

    return data ? toServiceRequestData(data) : localRequest && isDemoAccountRecordId(localRequest.id) ? localRequest : null;
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
        contactAvailableTime: '',
        averageResponseTime: '',
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
    const localProfile = getLocalProfile(userId);

    if (!supabase) {
        return localProfile;
    }

    // Supabase 연동
    const { data, error } = await supabase
        .from('expert_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        // 아직 프로필이 없으면(PGRST116) null 반환 (정상)
        if (error.code === 'PGRST116') return localProfile;
        console.error('Supabase 프로필 로딩 실패:', error);
        return localProfile;
    }

    if (!data) return localProfile;

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
        contactAvailableTime: data.contact_available_time || '',
        averageResponseTime: data.average_response_time || '',
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
    const { error: expertProfileError } = await supabase.from('expert_profiles').upsert({
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
        contact_available_time: profile.contactAvailableTime || '',
        average_response_time: profile.averageResponseTime || '',
        packages: profile.packages,
        updated_at: new Date().toISOString(),
    });

    if (expertProfileError) {
        console.error('Supabase 전문가 프로필 저장 실패:', expertProfileError);
        throw new Error(`데이터베이스 통신 오류: 프로필 저장 실패 (${expertProfileError.message})`);
    }

    const { error: basicProfileError } = await supabase
        .from('profiles')
        .update({
            name: profile.name,
            avatar_url: profile.imageUrl,
        })
        .eq('id', userId);

    if (basicProfileError) {
        console.error('Supabase 기본 프로필 저장 실패:', basicProfileError);
        throw new Error(`데이터베이스 통신 오류: 기본 프로필 저장 실패 (${basicProfileError.message})`);
    }
}

/**
 * DB에서 전문가 목록을 가져온다 (Home, Category 페이지용)
 * - expert_profiles에서 모든 프로필을 가져와 Expert 타입으로 매핑
 * - 리뷰 및 평점 시스템 연동 전이므로 임시로 0 처리
 */
export async function saveExpertProduct(product: ExpertProduct): Promise<void> {
    if (!supabase) {
        if (isLocalProfileRestricted(product.expertId)) {
            throw new Error('활동 제한된 회원은 상품을 등록하거나 수정할 수 없습니다.');
        }

        const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
        const existing = raw ? (JSON.parse(raw) as ExpertProduct[]) : [];
        const next = existing.filter((item) => item.id !== product.id);
        next.push(product);
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(next));
        return;
    }

    const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_expert: true })
        .eq('id', product.expertId);

    if (profileError) {
        console.error('Supabase 판매자 기능 활성화 실패:', profileError);
        throw new Error(`데이터베이스 통신 오류: 판매자 기능 활성화 실패 (${profileError.message})`);
    }

    const { error } = await supabase.from('expert_products').upsert({
        id: product.id,
        expert_id: product.expertId,
        title: product.title,
        category: product.category,
        summary: product.summary,
        description: product.description,
        sample_links: product.sampleLinks,
        sample_file_urls: product.sampleImageUrl ? [product.sampleImageUrl] : [],
        starting_price: product.startingPrice,
        currency: 'KRW',
        delivery_days: product.deliveryDays,
        revision_count: product.revisionCount,
        packages: product.packages,
        tax_invoice_available: Boolean(product.taxInvoiceAvailable),
        is_featured: Boolean(product.isFeatured),
        display_order: product.displayOrder || 0,
        status: product.status,
        updated_at: new Date().toISOString(),
    });

    if (error) {
        console.error('Supabase 상품 저장 실패:', error);
        throw new Error(`데이터베이스 통신 오류: 상품 저장 실패 (${error.message})`);
    }
}

export {
    getExpertPayoutAccount,
    getExpertSettlementPayouts,
    getNotificationPreference,
    getUserNotifications,
    queueNotificationEvent,
    saveExpertPayoutAccount,
    saveNotificationPreference,
};

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

const withTimeout = async <T>(promise: PromiseLike<T>, milliseconds: number): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => reject(new Error('request timed out')), milliseconds)
            }),
        ])
    } finally {
        if (timer) clearTimeout(timer)
    }
}

export async function getExpertProducts(options: { includeOwned?: boolean } = {}): Promise<ExpertProduct[]> {
    if (!supabase) {
        const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
        const stored = raw ? (JSON.parse(raw) as ExpertProduct[]) : [];
        const products = (stored.length ? stored : mockExpertProducts)
            .filter((product) => options.includeOwned || product.status === 'published')
            .sort(compareProductPlacement);
        return Promise.all(products.map(async (product) => {
            if (product.expertImageUrl) return product;

            const profile = await getStoredProfile(product.expertId);
            if (!profile) return product;

            return {
                ...product,
                expertName: profile.name || product.expertName,
                expertImageUrl: profile.imageUrl || product.expertImageUrl,
            };
        }));
    }

    const localProducts = readLocalArray<ExpertProduct>(STORAGE_KEYS.PRODUCTS);
    let productQuery = supabase
        .from('expert_products')
        .select('*')
        .order('created_at', { ascending: false });
    if (!options.includeOwned) {
        productQuery = productQuery.eq('status', 'published');
    }
    const { data, error } = await withTimeout(productQuery, 8000);

    if (error) {
        console.error('Supabase 상품 목록 로딩 실패:', error);
        const cachedProducts = readCachedExpertProducts();
        return cachedProducts.length ? cachedProducts : demoRecordsOnly(localProducts);
    }

    const productRows = data || [];
    const expertIds = Array.from(new Set(
        productRows
            .map((item) => item.expert_id)
            .filter((expertId): expertId is string => typeof expertId === 'string' && expertId.length > 0),
    ));
    const profileById = new Map<string, { name: string; imageUrl: string }>();

    if (expertIds.length > 0) {
        const [basicProfileResult, expertProfileResult] = await withTimeout(Promise.all([
            supabase
                .from('profiles')
                .select('id, name, display_name, avatar_url')
                .in('id', expertIds),
            supabase
                .from('expert_profiles')
                .select('user_id, name, image_url')
                .in('user_id', expertIds),
        ]), 8000).catch(() => [
            { data: null, error: new Error('profile lookup timed out') },
            { data: null, error: new Error('profile lookup timed out') },
        ] as const);
        const { data: profiles, error: profileError } = basicProfileResult;
        const { data: expertProfiles, error: expertProfileError } = expertProfileResult;

        if (profileError) {
            console.error('Supabase 판매자 프로필 로딩 실패:', profileError);
        } else {
            for (const profile of profiles || []) {
                profileById.set(profile.id, {
                    name: profile.name || profile.display_name || '',
                    imageUrl: profile.avatar_url || '',
                });
            }
        }

        if (expertProfileError) {
            console.error('Supabase 전문가 프로필 로딩 실패:', expertProfileError);
        } else {
            for (const profile of expertProfiles || []) {
                if (typeof profile.user_id !== 'string') continue;

                const existingProfile = profileById.get(profile.user_id);
                profileById.set(profile.user_id, {
                    name: existingProfile?.name || profile.name || '',
                    imageUrl: existingProfile?.imageUrl || profile.image_url || '',
                });
            }
        }
    }

    const supabaseProducts = productRows.map((item) => {
        const profile = profileById.get(item.expert_id);

        return {
            id: item.id,
            expertId: item.expert_id,
            expertName: profile?.name || item.expert_name || 'AI 전문가',
            expertImageUrl: profile?.imageUrl || item.expert_image_url || item.expert_avatar_url || '',
            title: item.title,
            category: item.category,
            summary: item.summary,
            description: item.description,
            sampleLinks: Array.isArray(item.sample_links) ? item.sample_links : [],
            sampleImageUrl: item.sample_file_urls?.[0] || item.sample_links?.[0] || '',
            startingPrice: Number(item.starting_price) || 0,
            deliveryDays: Number(item.delivery_days) || 1,
            revisionCount: Number(item.revision_count) || 1,
            createdAt: item.created_at,
            taxInvoiceAvailable: Boolean(item.tax_invoice_available),
            isFeatured: Boolean(item.is_featured),
            displayOrder: Number(item.display_order) || 0,
            packages: normalizeDbProductPackages(item),
            status: item.status,
        };
    }) as ExpertProduct[];

    const mergedProducts = mergeById(demoRecordsOnly(localProducts), supabaseProducts).sort(compareProductPlacement);
    writeCachedExpertProducts(supabaseProducts);
    return mergedProducts;
}

export const getCachedExpertProducts = readCachedExpertProducts;

const compareProductPlacement = (first: ExpertProduct, second: ExpertProduct): number => {
    if (Boolean(first.isFeatured) !== Boolean(second.isFeatured)) return first.isFeatured ? -1 : 1;
    const firstOrder = first.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const secondOrder = second.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (firstOrder !== secondOrder) return firstOrder - secondOrder;
    return Date.parse(second.createdAt || '') - Date.parse(first.createdAt || '');
};

export async function saveProposal(proposal: Proposal): Promise<string> {
    if (!supabase || shouldStoreProposalLocally(proposal)) {
        const raw = localStorage.getItem(STORAGE_KEYS.PROPOSALS);
        const proposals = raw ? (JSON.parse(raw) as Proposal[]) : [];
        localStorage.setItem(STORAGE_KEYS.PROPOSALS, JSON.stringify([...proposals, proposal]));
        return proposal.id;
    }

    const result = await invokeTradeWorkflow({
        type: 'create_proposal',
        proposal: toTradeProposalPayload(proposal),
    });
    return result.proposalId || proposal.id;
}

export async function updateProposal(proposal: Proposal): Promise<void> {
    if (!supabase || shouldStoreProposalLocally(proposal)) {
        const raw = localStorage.getItem(STORAGE_KEYS.PROPOSALS);
        const proposals = raw ? (JSON.parse(raw) as Proposal[]) : [];
        localStorage.setItem(
            STORAGE_KEYS.PROPOSALS,
            JSON.stringify(proposals.map((storedProposal) => (storedProposal.id === proposal.id ? proposal : storedProposal))),
        );
        return;
    }

    await invokeTradeWorkflow({
        type: 'update_proposal',
        proposal: toTradeProposalPayload(proposal),
    });
}

export async function getProposal(proposalId: string): Promise<Proposal | null> {
    const localProposal = readLocalArray<Proposal>(STORAGE_KEYS.PROPOSALS)
        .find((proposal) => proposal.id === proposalId);

    if (!supabase) {
        return localProposal ? normalizeProposalStatus(localProposal) : null;
    }
    if (localProposal && isLocalOnlyProposal(localProposal)) {
        return normalizeProposalStatus(localProposal);
    }

    const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', proposalId)
        .single();

    if (error) return localProposal && isLocalOnlyProposal(localProposal) ? normalizeProposalStatus(localProposal) : null;
    return data
        ? toProposal(data)
        : localProposal && isLocalOnlyProposal(localProposal)
            ? normalizeProposalStatus(localProposal)
            : null;
}

export async function getUserProposals(userId: string): Promise<Proposal[]> {
    if (!supabase) {
        return getLocalUserProposals(userId);
    }

    const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .or(`client_id.eq.${userId},expert_id.eq.${userId}`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('사용자 제안서 목록 로딩 실패:', error);
        return demoRecordsOnly(getLocalUserProposals(userId));
    }

    return mergeById(
        getLocalUserProposals(userId).filter(isLocalOnlyProposal),
        (data || []).map(toProposal),
    );
}

export async function acceptProposal(proposal: Proposal): Promise<string> {
    if (proposal.status === 'expired' || new Date(proposal.expiresAt) < new Date()) {
        throw new Error('만료된 제안서는 승인할 수 없습니다.');
    }

    const money = getProposalMoney(proposal);

    if (!supabase || shouldStoreProposalLocally(proposal)) {
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
            revisionLimit: proposal.revisionCount,
            revisionUsed: 0,
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
                            platformFeeRate: proposal.platformFeeRate ?? PLATFORM_FEE_RATE,
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
        await Promise.all([
            queueNotificationEvent({
                userId: proposal.clientId,
                type: 'payment_completed',
                title: '결제가 완료되었습니다',
                body: `${proposal.title} 작업 결제가 완료되어 작업방이 열렸습니다.`,
                relatedType: 'work',
                relatedId: work.id,
            }),
            queueNotificationEvent({
                userId: proposal.expertId,
                type: 'workroom_created',
                title: '새 작업방이 생성되었습니다',
                body: `${proposal.title} 결제가 완료되어 작업을 시작할 수 있습니다.`,
                relatedType: 'work',
                relatedId: work.id,
            }),
        ]);
        return work.id;
    }

    const result = await invokeTradeWorkflow({ type: 'accept_proposal', proposalId: proposal.id });
    return result.workId || `work-${proposal.id}`;
}

export async function requestProposalRevision(proposalId: string): Promise<void> {
    if (!supabase || hasLocalDemoProposal(proposalId) || proposalId.includes('demo-consultation')) {
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

    await invokeTradeWorkflow({ type: 'request_proposal_revision', proposalId });
}

export async function cancelProposal(proposalId: string): Promise<void> {
    if (!supabase || hasLocalDemoProposal(proposalId) || proposalId.includes('demo-consultation')) {
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

    await invokeTradeWorkflow({ type: 'cancel_proposal', proposalId });
}

export async function getWorkroomData(workId: string): Promise<{
    work: Work | null;
    steps: WorkStep[];
    deliverables: Deliverable[];
}> {
    const getLocalWorkroomData = () => {
        const works = readLocalArray<Work>(STORAGE_KEYS.WORKS);
        const steps = readLocalArray<WorkStep>(STORAGE_KEYS.WORK_STEPS);
        const deliverables = readLocalArray<Deliverable>(STORAGE_KEYS.DELIVERABLES);
        const workDeliverables = deliverables
            .filter((deliverable) => deliverable.workId === workId)
            .map((deliverable) => ({
                ...deliverable,
                autoPurchaseConfirmAt: deliverable.autoPurchaseConfirmAt || getAutoPurchaseConfirmAt(deliverable.submittedAt),
            }))
            .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

        return {
            work: works.find((work) => work.id === workId) || null,
            steps: steps.filter((step) => step.workId === workId),
            deliverables: workDeliverables,
        };
    };

    if (!supabase) {
        const localWorkroom = getLocalWorkroomData();
        if (localWorkroom.work && isDemoAccountRecordId(localWorkroom.work.id)) return localWorkroom;

        if (localWorkroom.work && shouldAutoCancelWork(localWorkroom.work)) {
            await cancelWork(localWorkroom.work.id, localWorkroom.work.cancellationReason || 'mutual_after_start');
            return getLocalWorkroomData();
        }

        const autoConfirmTarget = localWorkroom.work
            ? findAutoPurchaseConfirmTarget(localWorkroom.work, localWorkroom.deliverables)
            : null;

        if (localWorkroom.work && autoConfirmTarget) {
            await approveWorkDeliverable(
                localWorkroom.work.id,
                autoConfirmTarget.id,
                localWorkroom.work.requestId,
                autoConfirmTarget.stepId,
            );
            return getLocalWorkroomData();
        }

        return localWorkroom;
    }

    const localWorkroom = getLocalWorkroomData();
    if (localWorkroom.work && isDemoAccountRecordId(localWorkroom.work.id)) return localWorkroom;

    const { data: workData, error: workError } = await supabase
        .from('works')
        .select('*')
        .eq('id', workId)
        .single();

    if (workError || !workData) {
        return localWorkroom.work && isDemoAccountRecordId(localWorkroom.work.id)
            ? localWorkroom
            : { work: null, steps: [], deliverables: [] };
    }

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
    const deliverables = (deliverableData || []).map(toDeliverable);
    const workWithSteps = { ...work, stepIds: steps.map((step) => step.id) };

    return {
        work: workWithSteps,
        steps,
        deliverables,
    };
}

export async function getWorkByProposal(proposalId: string): Promise<Work | null> {
    const localWork = readLocalArray<Work>(STORAGE_KEYS.WORKS)
        .find((work) => work.proposalId === proposalId) || null;

    if (!supabase) {
        return localWork;
    }

    const { data, error } = await supabase
        .from('works')
        .select('*')
        .eq('proposal_id', proposalId)
        .single();

    if (error || !data) return localWork && isDemoAccountRecordId(localWork.id) ? localWork : null;

    return toWork(data);
}

export async function getUserWorks(userId: string): Promise<Work[]> {
    if (!supabase) {
        return getLocalUserWorks(userId);
    }

    const { data, error } = await supabase
        .from('works')
        .select('*')
        .or(`client_id.eq.${userId},expert_id.eq.${userId}`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('사용자 작업 목록 로딩 실패:', error);
        return demoRecordsOnly(getLocalUserWorks(userId));
    }

    return mergeById(demoRecordsOnly(getLocalUserWorks(userId)), (data || []).map(toWork));
}

const getLocalWork = (workId: string): Work | null =>
    readLocalArray<Work>(STORAGE_KEYS.WORKS).find((work) => work.id === workId) || null;

const assertWorkCanBeCancelled = (work: Work | null): void => {
    if (!work) return;
    if (work.status === 'completed') throw new Error('완료된 작업은 거래 취소를 요청할 수 없습니다.');
    if (work.status === 'cancelled') throw new Error('이미 취소된 작업입니다.');
    if (work.disputeStatus === 'open') throw new Error('분쟁 처리 중에는 거래 취소를 진행할 수 없습니다.');
};

const assertWorkIsNotFrozen = (work: Work | null, actionName: string): void => {
    if (!work) return;
    if (work.disputeStatus === 'open') throw new Error(`분쟁 처리 중에는 ${actionName}할 수 없습니다.`);
    if (hasOpenCancellationRequest(work)) throw new Error(`거래 취소 요청 응답 대기 중에는 ${actionName}할 수 없습니다.`);
};

export async function cancelWork(
    workId: string,
    reason: NonNullable<Work['cancellationReason']> = 'mutual_after_start',
): Promise<void> {
    const cancelledAt = new Date().toISOString();
    if (!supabase || hasLocalDemoWork(workId)) {
        assertWorkCanBeCancelled(getLocalWork(workId));
        const worksRaw = localStorage.getItem(STORAGE_KEYS.WORKS);
        const works = worksRaw ? (JSON.parse(worksRaw) as Work[]) : [];
        localStorage.setItem(
            STORAGE_KEYS.WORKS,
            JSON.stringify(
                works.map((work) =>
                    work.id === workId
                        ? {
                            ...work,
                            status: 'cancelled',
                            settlementStatus: work.settlementStatus || 'held',
                            refundStatus: 'fee_excluded_refund_pending',
                            cancellationReason: reason,
                            cancellationRequestedBy: undefined,
                            cancellationRequestedAt: undefined,
                            cancelledAt,
                        }
                        : work,
                ),
            ),
        );
        return;
    }

    await invokeTradeWorkflow({ type: 'request_work_cancellation', workId, reason });
}

export async function requestWorkCancellation(
    workId: string,
    requesterId: string,
    reason: NonNullable<Work['cancellationReason']> = 'mutual_after_start',
): Promise<void> {
    const requestedAt = new Date().toISOString();

    if (!supabase || hasLocalDemoWork(workId)) {
        const currentWork = getLocalWork(workId);
        assertWorkCanBeCancelled(currentWork);
        if (!currentWork) throw new Error('작업방을 찾을 수 없습니다.');
        if (currentWork.clientId !== requesterId && currentWork.expertId !== requesterId) {
            throw new Error('거래 참여자만 취소를 요청할 수 있습니다.');
        }
        if (hasOpenCancellationRequest(currentWork)) {
            if (currentWork.cancellationRequestedBy === requesterId) return;
            throw new Error('상대방의 취소 요청이 있습니다. 취소 수락으로 진행해 주세요.');
        }

        const works = readLocalArray<Work>(STORAGE_KEYS.WORKS);
        writeLocalArray(
            STORAGE_KEYS.WORKS,
            works.map((work) =>
                work.id === workId
                    ? {
                        ...work,
                        cancellationReason: reason,
                        cancellationRequestedBy: requesterId,
                        cancellationRequestedAt: requestedAt,
                    }
                    : work,
            ),
        );
        return;
    }

    await invokeTradeWorkflow({ type: 'request_work_cancellation', workId, reason });
}

export async function acceptWorkCancellation(workId: string, actorId: string): Promise<void> {
    if (!supabase || hasLocalDemoWork(workId)) {
        const currentWork = getLocalWork(workId);
        assertWorkCanBeCancelled(currentWork);
        if (!currentWork?.cancellationRequestedAt || !currentWork.cancellationRequestedBy) {
            throw new Error('수락할 취소 요청이 없습니다.');
        }
        if (currentWork.cancellationRequestedBy === actorId) {
            throw new Error('취소 요청자는 직접 수락할 수 없습니다.');
        }
        if (currentWork.clientId !== actorId && currentWork.expertId !== actorId) {
            throw new Error('거래 참여자만 취소를 수락할 수 있습니다.');
        }
        await cancelWork(workId, currentWork.cancellationReason || 'mutual_after_start');
        return;
    }

    await invokeTradeWorkflow({ type: 'accept_work_cancellation', workId });
}

export async function requestSettlementWithdrawal(workId: string, expertId: string): Promise<void> {
    const requestedAt = new Date().toISOString();

    if (!supabase || hasLocalDemoWork(workId)) {
        const payoutAccount = await getExpertPayoutAccount(expertId);
        if (!payoutAccount?.id) {
            throw new Error('정산 받을 계좌를 먼저 등록해주세요.');
        }
        const currentWork = getLocalWork(workId);
        if (!currentWork) throw new Error('작업방을 찾을 수 없습니다.');
        if (currentWork.expertId !== expertId) throw new Error('작업자만 정산을 신청할 수 있습니다.');
        if (currentWork.status !== 'completed' || currentWork.settlementStatus !== 'pending') {
            throw new Error('구매확정 후 정산 대기 상태에서만 정산을 신청할 수 있습니다.');
        }
        if (currentWork.disputeStatus === 'open') throw new Error('분쟁 처리 중에는 정산을 신청할 수 없습니다.');
        if (currentWork.settlementHoldReason) throw new Error('정산 보류 상태에서는 관리자 확인이 필요합니다.');

        const works = readLocalArray<Work>(STORAGE_KEYS.WORKS);
        writeLocalArray(
            STORAGE_KEYS.WORKS,
            works.map((work) =>
                work.id === workId ? { ...work, settlementRequestedAt: work.settlementRequestedAt || requestedAt } : work,
            ),
        );
        const payouts = readLocalArray<SettlementPayout>(STORAGE_KEYS.SETTLEMENT_PAYOUTS);
        if (!payouts.some((payout) => payout.workId === workId && payout.status !== 'failed')) {
            writeLocalArray(STORAGE_KEYS.SETTLEMENT_PAYOUTS, [{
                id: `settlement-payout-${workId}`,
                workId,
                expertId,
                payoutAccountId: payoutAccount.id,
                amount: currentWork.expertPayout || 0,
                status: 'queued',
                requestedAt,
            }, ...payouts]);
        }
        await queueNotificationEvent({
            userId: expertId,
            type: 'settlement_requested',
            title: '정산 요청이 접수되었습니다',
            body: `${currentWork.title} 정산 요청이 접수되었습니다. 관리자 확인 후 송금 처리됩니다.`,
            relatedType: 'settlement',
            relatedId: workId,
        });
        return;
    }

    await invokeTradeWorkflow({ type: 'request_settlement_withdrawal', workId });
}

export async function getWorkMessages(workId: string): Promise<WorkMessage[]> {
    if (!supabase || hasLocalDemoWork(workId)) return getLocalWorkMessages(workId);

    const { data, error } = await supabase
        .from('work_messages')
        .select('*')
        .eq('work_id', workId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('?묒뾽諛?硫붿떆吏 濡쒕뵫 ?ㅽ뙣:', error);
        return demoRecordsOnly(getLocalWorkMessages(workId));
    }

    return mergeById(demoRecordsOnly(getLocalWorkMessages(workId)), (data || []).map(toWorkMessage));
}

export async function saveWorkMessage(input: {
    workId: string;
    senderId: string;
    body: string;
}): Promise<WorkMessage> {
    const body = input.body.trim();
    const validation = validateMarketplaceMessage(body);
    if (!validation.allowed) throw new Error(validation.message);
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

    if (!supabase || hasLocalDemoWork(input.workId)) return saveLocalMessage();

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

export async function saveDeliverable(deliverable: Deliverable): Promise<Deliverable> {
    if (hasExternalContact(deliverable.description)) {
        throw new Error(EXTERNAL_CONTACT_WARNING);
    }
    const safeExternalUrl = normalizeSafeExternalUrl(deliverable.externalUrl);
    if (deliverable.externalUrl && !safeExternalUrl) {
        throw new Error(SAFE_EXTERNAL_URL_MESSAGE);
    }
    const deliverableToSave = safeExternalUrl ? { ...deliverable, externalUrl: safeExternalUrl } : deliverable;

    if (!supabase || hasLocalDemoWork(deliverable.workId)) {
        const currentWork = getLocalWork(deliverable.workId);
        assertWorkIsNotFrozen(currentWork, '제출물을 등록');
        if (currentWork?.status === 'completed' || currentWork?.status === 'cancelled') {
            throw new Error('종료된 작업에는 제출물을 등록할 수 없습니다.');
        }
        const raw = localStorage.getItem(STORAGE_KEYS.DELIVERABLES);
        const deliverables = raw ? (JSON.parse(raw) as Deliverable[]) : [];
        localStorage.setItem(STORAGE_KEYS.DELIVERABLES, JSON.stringify([...deliverables, deliverableToSave]));
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
        if (currentWork) {
            await queueNotificationEvent({
                userId: currentWork.clientId,
                type: 'deliverable_submitted',
                title: '결과물이 제출되었습니다',
                body: `${currentWork.title} 결과물이 도착했습니다. 확인 후 승인하거나 수정 요청을 남겨주세요.`,
                relatedType: 'deliverable',
                relatedId: deliverable.id,
            });
        }
        return deliverableToSave;
    }

    const result = await invokeTradeWorkflow({
        type: 'submit_deliverable',
        deliverable: toTradeDeliverablePayload(deliverableToSave),
    });
    return result.deliverableId ? { ...deliverableToSave, id: result.deliverableId } : deliverableToSave;
}

export async function approveWorkDeliverable(
    workId: string,
    deliverableId: string,
    requestId?: string,
    stepId?: string,
): Promise<void> {
    const completedAt = new Date().toISOString();
    if (!supabase || hasLocalDemoWork(workId)) {
        const deliverablesRaw = localStorage.getItem(STORAGE_KEYS.DELIVERABLES);
        const worksRaw = localStorage.getItem(STORAGE_KEYS.WORKS);
        const stepsRaw = localStorage.getItem(STORAGE_KEYS.WORK_STEPS);
        const deliverables = deliverablesRaw ? (JSON.parse(deliverablesRaw) as Deliverable[]) : [];
        const works = worksRaw ? (JSON.parse(worksRaw) as Work[]) : [];
        const steps = stepsRaw ? (JSON.parse(stepsRaw) as WorkStep[]) : [];
        const currentWork = works.find((work) => work.id === workId) || null;
        assertWorkIsNotFrozen(currentWork, '결과물을 승인');

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
                    work.id === workId
                        ? {
                            ...work,
                            status: 'completed',
                            settlementStatus: 'pending',
                            cancellationRequestedBy: undefined,
                            cancellationRequestedAt: undefined,
                            completedAt,
                        }
                        : work,
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
        if (currentWork) {
            await queueNotificationEvent({
                userId: currentWork.expertId,
                type: 'settlement_available',
                title: '정산 가능한 거래가 생겼습니다',
                body: `${currentWork.title} 작업이 승인되어 정산을 요청할 수 있습니다.`,
                relatedType: 'work',
                relatedId: workId,
            });
        }
        return;
    }

    await invokeTradeWorkflow({ type: 'approve_deliverable', workId, deliverableId, ...(stepId ? { stepId } : {}) });
}

export async function requestWorkRevision(workId: string, deliverableId: string, stepId?: string): Promise<void> {
    if (!supabase || hasLocalDemoWork(workId)) {
        const deliverablesRaw = localStorage.getItem(STORAGE_KEYS.DELIVERABLES);
        const worksRaw = localStorage.getItem(STORAGE_KEYS.WORKS);
        const stepsRaw = localStorage.getItem(STORAGE_KEYS.WORK_STEPS);
        const deliverables = deliverablesRaw ? (JSON.parse(deliverablesRaw) as Deliverable[]) : [];
        const works = worksRaw ? (JSON.parse(worksRaw) as Work[]) : [];
        const steps = stepsRaw ? (JSON.parse(stepsRaw) as WorkStep[]) : [];
        const currentWork = works.find((work) => work.id === workId);
        assertWorkIsNotFrozen(currentWork || null, '수정 요청');
        const revisionLimit = currentWork?.revisionLimit ?? 0;
        const revisionUsed = currentWork?.revisionUsed ?? 0;
        const nextRevisionUsed = revisionUsed + 1;

        if (revisionLimit > 0 && revisionUsed >= revisionLimit) {
            throw new Error('수정 요청 가능 횟수를 모두 사용했습니다.');
        }

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
                works.map((work) =>
                    work.id === workId
                        ? { ...work, status: 'revision_requested', revisionUsed: nextRevisionUsed }
                        : work,
                ),
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
        if (currentWork) {
            await queueNotificationEvent({
                userId: currentWork.expertId,
                type: 'revision_requested',
                title: '수정 요청이 도착했습니다',
                body: `${currentWork.title} 결과물에 수정 요청이 등록되었습니다.`,
                relatedType: 'deliverable',
                relatedId: deliverableId,
            });
        }
        return;
    }

    await invokeTradeWorkflow({ type: 'request_work_revision', workId, deliverableId, ...(stepId ? { stepId } : {}) });
}

export async function saveReview(review: Review): Promise<void> {
    if (!supabase || hasLocalDemoWork(review.workId)) {
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
        return getLocalUserReviews(userId);
    }

    const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .or(`client_id.eq.${userId},expert_id.eq.${userId}`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('리뷰 목록 로딩 실패:', error);
        return demoRecordsOnly(getLocalUserReviews(userId));
    }

    return mergeById(demoRecordsOnly(getLocalUserReviews(userId)), (data || []).map(toReview))
        .filter((review) => review.status !== 'hidden');
}

export async function getExpertReviews(expertId: string): Promise<Review[]> {
    if (!supabase) {
        return getLocalExpertReviews(expertId);
    }

    const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('expert_id', expertId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('전문가 공개 리뷰 로딩 실패:', error);
        return demoRecordsOnly(getLocalExpertReviews(expertId));
    }

    return mergeById(demoRecordsOnly(getLocalExpertReviews(expertId)), (data || []).map(toReview))
        .filter((review) => review.status !== 'hidden');
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
