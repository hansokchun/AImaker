import type { AdminSnapshot } from './adminStorage';

export type AdminStatusFilter =
    | 'all'
    | 'published'
    | 'pending'
    | 'accepted'
    | 'paid'
    | 'open'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'hidden';

export interface AdminFilterState {
    readonly query: string;
    readonly status: AdminStatusFilter;
}

export const defaultAdminFilters: AdminFilterState = {
    query: '',
    status: 'all',
};

export function filterAdminSnapshot(snapshot: AdminSnapshot, filters: AdminFilterState): AdminSnapshot {
    const query = normalize(filters.query);

    const profiles = snapshot.profiles.filter((profile) =>
        matchesQuery(query, [profile.id, profile.email, profile.name]) && matchesStatus(filters.status, profile.isExpert ? 'published' : 'pending'),
    );
    const products = snapshot.products.filter((product) =>
        matchesQuery(query, [product.id, product.title, product.category, product.summary, product.description, product.expertName])
        && matchesStatus(filters.status, product.status),
    );
    const serviceRequests = snapshot.serviceRequests.filter((request) =>
        matchesQuery(query, [request.id, request.title, request.description, request.clientId, request.expertId, request.productId])
        && matchesStatus(filters.status, request.status),
    );
    const proposals = snapshot.proposals.filter((proposal) =>
        matchesQuery(query, [proposal.id, proposal.title, proposal.scope, proposal.clientId, proposal.expertId, proposal.requestId])
        && (matchesStatus(filters.status, proposal.status) || matchesStatus(filters.status, proposal.paymentStatus)),
    );
    const works = snapshot.works.filter((work) =>
        matchesQuery(query, [work.id, work.title, work.clientId, work.expertId, work.requestId, work.proposalId])
        && matchesStatus(filters.status, work.status),
    );
    const matchedConsultationMessages = snapshot.consultationMessages.filter((message) =>
        matchesQuery(query, [message.id, message.consultationId, message.senderId, message.body]),
    );
    const consultations = snapshot.consultations.filter((consultation) =>
        (matchesQuery(query, [consultation.id, consultation.title, consultation.clientId, consultation.expertId, consultation.productId])
            || matchedConsultationMessages.some((message) => message.consultationId === consultation.id))
        && matchesStatus(filters.status, consultation.status),
    );
    const consultationIds = new Set(consultations.map((consultation) => consultation.id));
    const workMessages = snapshot.workMessages.filter((message) =>
        works.some((work) => work.id === message.workId)
        && matchesQuery(query, [message.id, message.workId, message.senderId, message.body]),
    );
    const reviews = snapshot.reviews.filter((review) =>
        matchesQuery(query, [review.id, review.workId, review.clientId, review.expertId, review.content])
        && matchesStatus(filters.status, 'completed'),
    );
    const adminActions = snapshot.adminActions.filter((action) =>
        matchesQuery(query, [action.id, action.adminId, action.targetType, action.targetId, action.actionType, action.reason])
        && matchesStatus(filters.status, action.actionType),
    );

    return {
        ...snapshot,
        profiles,
        products,
        serviceRequests,
        proposals,
        works,
        consultations,
        consultationMessages: matchedConsultationMessages.filter((message) => consultationIds.has(message.consultationId)),
        workMessages,
        reviews,
        adminActions,
    };
}

function matchesQuery(query: string, values: readonly unknown[]): boolean {
    if (!query) return true;
    return values.some((value) => normalize(value).includes(query));
}

function matchesStatus(filter: AdminStatusFilter, status: unknown): boolean {
    return filter === 'all' || normalize(status) === filter;
}

function normalize(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}
