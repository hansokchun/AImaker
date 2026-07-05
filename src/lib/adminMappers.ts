import type { AiCategoryId, Consultation, ConsultationMessage, ExpertProduct, Proposal, Review, ServiceRequestData, Work, WorkMessage } from '../types';
import type { AdminAction, AdminProfile, AdminReport, AdminReportSeverity, AdminReportStatus, AdminReportTargetType } from './adminStorage';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (record: Record<string, unknown>, key: string): string => {
    const value = record[key];
    return typeof value === 'string' ? value : '';
};

const numberValue = (record: Record<string, unknown>, key: string): number => {
    const value = record[key];
    return typeof value === 'number' ? value : Number(value) || 0;
};

const stringArrayValue = (record: Record<string, unknown>, key: string): string[] => {
    const value = record[key];
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
};

const categoryValue = (value: string): AiCategoryId => {
    if (value === 'ai-image-character') return 'ai-image-character';
    if (value === 'ai-development-automation') return 'ai-development-automation';
    return 'ai-video-shortform';
};

const reportStatusValue = (value: string): AdminReportStatus => {
    if (value === 'resolved') return 'resolved';
    if (value === 'dismissed') return 'dismissed';
    return 'pending';
};

const reportSeverityValue = (value: string): AdminReportSeverity => {
    if (value === 'high') return 'high';
    if (value === 'low') return 'low';
    return 'medium';
};

const reportTargetTypeValue = (value: string): AdminReportTargetType => {
    if (value === 'user') return 'user';
    if (value === 'consultation') return 'consultation';
    if (value === 'work') return 'work';
    if (value === 'review') return 'review';
    return 'product';
};

export const toProfile = (item: unknown): AdminProfile | null => {
    if (!isRecord(item)) return null;

    const id = stringValue(item, 'id');
    if (!id) return null;

    return {
        id,
        email: stringValue(item, 'email'),
        name: stringValue(item, 'name') || stringValue(item, 'display_name') || '이름 미등록',
        avatarUrl: stringValue(item, 'avatar_url'),
        isExpert: Boolean(item.is_expert),
        moderationStatus: stringValue(item, 'account_status') === 'restricted' ? 'restricted' : 'active',
        createdAt: stringValue(item, 'created_at'),
    };
};

export const toAdminReport = (item: unknown): AdminReport | null => {
    if (!isRecord(item)) return null;
    const id = stringValue(item, 'id');
    if (!id) return null;

    return {
        id,
        reporterId: stringValue(item, 'reporter_id'),
        targetType: reportTargetTypeValue(stringValue(item, 'target_type')),
        targetId: stringValue(item, 'target_id'),
        reason: stringValue(item, 'reason'),
        status: reportStatusValue(stringValue(item, 'status')),
        severity: reportSeverityValue(stringValue(item, 'severity')),
        createdAt: stringValue(item, 'created_at'),
        resolvedAt: stringValue(item, 'resolved_at') || undefined,
        resolvedBy: stringValue(item, 'resolved_by') || undefined,
    };
};

export const toAdminProduct = (item: unknown): ExpertProduct | null => {
    if (!isRecord(item)) return null;
    const id = stringValue(item, 'id');
    if (!id) return null;

    return {
        id,
        expertId: stringValue(item, 'expert_id'),
        expertName: stringValue(item, 'expert_name') || 'AI 전문가',
        expertImageUrl: stringValue(item, 'expert_image_url') || stringValue(item, 'expert_avatar_url'),
        title: stringValue(item, 'title') || '제목 없음',
        category: categoryValue(stringValue(item, 'category')),
        summary: stringValue(item, 'summary'),
        description: stringValue(item, 'description'),
        sampleLinks: stringArrayValue(item, 'sample_links'),
        sampleImageUrl: stringArrayValue(item, 'sample_file_urls')[0] || stringArrayValue(item, 'sample_links')[0] || '',
        startingPrice: numberValue(item, 'starting_price'),
        deliveryDays: numberValue(item, 'delivery_days') || 1,
        revisionCount: numberValue(item, 'revision_count'),
        createdAt: stringValue(item, 'created_at'),
        taxInvoiceAvailable: Boolean(item.tax_invoice_available),
        isFeatured: Boolean(item.is_featured),
        displayOrder: numberValue(item, 'display_order'),
        packages: {
            standard: {
                name: 'Standard',
                price: numberValue(item, 'starting_price'),
                deliveryDays: numberValue(item, 'delivery_days') || 1,
                revisionCount: numberValue(item, 'revision_count'),
                included: [],
            },
            deluxe: null,
            premium: null,
        },
        status: stringValue(item, 'status') === 'hidden' ? 'hidden' : stringValue(item, 'status') === 'draft' ? 'draft' : 'published',
    };
};

export const toServiceRequestData = (item: unknown): ServiceRequestData | null => {
    if (!isRecord(item)) return null;
    const id = stringValue(item, 'id');
    if (!id) return null;

    return {
        id,
        title: stringValue(item, 'title') || stringValue(item, 'desired_result') || '제목 없음',
        description: stringValue(item, 'description') || stringValue(item, 'purpose'),
        budget: String(item.budget || ''),
        deadline: stringValue(item, 'deadline'),
        categories: stringArrayValue(item, 'categories'),
        createdAt: stringValue(item, 'created_at') || new Date().toISOString(),
        updatedAt: stringValue(item, 'updated_at'),
        ordererEmail: stringValue(item, 'orderer_email'),
        clientId: stringValue(item, 'client_id'),
        expertId: stringValue(item, 'expert_id'),
        status: stringValue(item, 'status') === 'completed'
            ? 'completed'
            : stringValue(item, 'status') === 'in_progress'
                ? 'in_progress'
                : 'pending',
        productId: stringValue(item, 'product_id'),
        selectedPackage: stringValue(item, 'selected_package') === 'premium'
            ? 'premium'
            : stringValue(item, 'selected_package') === 'deluxe'
                ? 'deluxe'
                : 'standard',
        desiredResult: stringValue(item, 'desired_result'),
        purpose: stringValue(item, 'purpose'),
        referenceText: stringValue(item, 'reference_text'),
        referenceLinks: stringArrayValue(item, 'reference_links'),
        progressType: stringValue(item, 'progress_type') === 'milestone' ? 'milestone' : 'single',
    };
};

export const toProposal = (item: unknown): Proposal | null => {
    if (!isRecord(item)) return null;
    const id = stringValue(item, 'id');
    if (!id) return null;

    return {
        id,
        requestId: stringValue(item, 'request_id'),
        clientId: stringValue(item, 'client_id'),
        expertId: stringValue(item, 'expert_id'),
        title: stringValue(item, 'title') || '제안서',
        scope: stringValue(item, 'scope'),
        deliverables: stringArrayValue(item, 'deliverables'),
        totalPrice: numberValue(item, 'total_price'),
        deliveryDays: numberValue(item, 'delivery_days'),
        revisionCount: numberValue(item, 'revision_count'),
        progressType: stringValue(item, 'progress_type') === 'milestone' ? 'milestone' : 'single',
        milestones: stringArrayValue(item, 'milestones'),
        commercialUseAllowed: Boolean(item.commercial_use_allowed),
        sourceFileIncluded: Boolean(item.source_file_included),
        status: stringValue(item, 'status') === 'accepted'
            ? 'accepted'
            : stringValue(item, 'status') === 'cancelled'
                ? 'cancelled'
                : stringValue(item, 'status') === 'expired'
                    ? 'expired'
                    : stringValue(item, 'status') === 'revision_requested'
                        ? 'revision_requested'
                        : 'sent',
        paymentStatus: stringValue(item, 'payment_status') === 'paid'
            ? 'paid'
            : stringValue(item, 'payment_status') === 'refunded'
                ? 'refunded'
                : 'unpaid',
        expiresAt: stringValue(item, 'expires_at'),
    };
};

export const toWork = (item: unknown): Work | null => {
    if (!isRecord(item)) return null;
    const id = stringValue(item, 'id');
    if (!id) return null;

    return {
        id,
        proposalId: stringValue(item, 'proposal_id'),
        requestId: stringValue(item, 'request_id'),
        clientId: stringValue(item, 'client_id'),
        expertId: stringValue(item, 'expert_id'),
        title: stringValue(item, 'title') || '작업',
        progressType: stringValue(item, 'progress_type') === 'milestone' ? 'milestone' : 'single',
        status: stringValue(item, 'status') === 'completed'
            ? 'completed'
            : stringValue(item, 'status') === 'submitted'
                ? 'submitted'
                : stringValue(item, 'status') === 'revision_requested'
                    ? 'revision_requested'
                    : stringValue(item, 'status') === 'cancelled'
                        ? 'cancelled'
                        : 'in_progress',
        totalPrice: numberValue(item, 'total_price'),
        platformFee: numberValue(item, 'platform_fee'),
        expertPayout: numberValue(item, 'expert_payout'),
        settlementStatus: stringValue(item, 'settlement_status') === 'settled'
            ? 'settled'
            : stringValue(item, 'settlement_status') === 'pending'
                ? 'pending'
                : stringValue(item, 'settlement_status') === 'refunded'
                    ? 'refunded'
                    : 'held',
        refundStatus: stringValue(item, 'refund_status') === 'refunded'
            ? 'refunded'
            : stringValue(item, 'refund_status') === 'fee_excluded_refund_pending'
                ? 'fee_excluded_refund_pending'
                : undefined,
        disputeStatus: stringValue(item, 'dispute_status') === 'open'
            ? 'open'
            : stringValue(item, 'dispute_status') === 'resolved'
                ? 'resolved'
                : undefined,
        stepIds: [],
    };
};

export const toConsultation = (item: unknown): Consultation | null => {
    if (!isRecord(item)) return null;
    const id = stringValue(item, 'id');
    if (!id) return null;

    return {
        id,
        clientId: stringValue(item, 'client_id'),
        expertId: stringValue(item, 'expert_id'),
        productId: stringValue(item, 'product_id'),
        status: stringValue(item, 'status') === 'proposal_sent'
            ? 'proposal_sent'
            : stringValue(item, 'status') === 'closed'
                ? 'closed'
                : 'open',
        title: stringValue(item, 'title') || '상담채팅',
        lastMessageAt: stringValue(item, 'last_message_at'),
        createdAt: stringValue(item, 'created_at'),
    };
};

export const toConsultationMessage = (item: unknown): ConsultationMessage | null => {
    if (!isRecord(item)) return null;
    const id = stringValue(item, 'id');
    if (!id) return null;

    return {
        id,
        consultationId: stringValue(item, 'consultation_id'),
        senderId: stringValue(item, 'sender_id'),
        body: stringValue(item, 'body'),
        attachmentUrls: stringArrayValue(item, 'attachment_urls'),
        createdAt: stringValue(item, 'created_at'),
    };
};

export const toWorkMessage = (item: unknown): WorkMessage | null => {
    if (!isRecord(item)) return null;
    const id = stringValue(item, 'id');
    if (!id) return null;

    return {
        id,
        workId: stringValue(item, 'work_id'),
        senderId: stringValue(item, 'sender_id'),
        body: stringValue(item, 'body'),
        attachmentUrls: stringArrayValue(item, 'attachment_urls'),
        createdAt: stringValue(item, 'created_at'),
    };
};

export const toAdminAction = (item: unknown): AdminAction | null => {
    if (!isRecord(item)) return null;
    const id = stringValue(item, 'id');
    if (!id) return null;

    return {
        id,
        adminId: stringValue(item, 'admin_id'),
        targetType: stringValue(item, 'target_type') as AdminAction['targetType'],
        targetId: stringValue(item, 'target_id'),
        actionType: stringValue(item, 'action_type') as AdminAction['actionType'],
        reason: stringValue(item, 'reason'),
        createdAt: stringValue(item, 'created_at'),
    };
};

export const toReview = (item: unknown): Review | null => {
    if (!isRecord(item)) return null;
    const id = stringValue(item, 'id');
    if (!id) return null;

    const rating = numberValue(item, 'rating');

    return {
        id,
        workId: stringValue(item, 'work_id'),
        clientId: stringValue(item, 'client_id'),
        expertId: stringValue(item, 'expert_id'),
        rating: rating === 1 || rating === 2 || rating === 3 || rating === 4 || rating === 5 ? rating : 5,
        content: stringValue(item, 'content'),
        status: stringValue(item, 'status') === 'hidden' ? 'hidden' : 'published',
        createdAt: stringValue(item, 'created_at'),
    };
};
