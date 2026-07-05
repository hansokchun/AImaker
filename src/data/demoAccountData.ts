// SIZE_OK: deterministic demo fixtures let one QA account cover every marketplace state without touching production data.
import type {
    Consultation,
    ConsultationMessage,
    Deliverable,
    ExpertProduct,
    ExpertProfile,
    PackageTier,
    ProductPackage,
    Proposal,
    Review,
    ServiceRequestData,
    Work,
    WorkMessage,
    WorkStep,
} from '../types';

export const DEMO_TEST_ACCOUNT_EMAILS = [
    'benet9827@gmail.com',
    'benet9818@gmail.com',
] as const;
export const DEMO_TEST_ACCOUNT_EMAIL = DEMO_TEST_ACCOUNT_EMAILS[0];

const DEMO_NOW = '2026-07-01T09:00:00.000Z';
const PARTNER_EXPERT_ID = 'demo-expert-rumi-studio';
const BRAND_CLIENT_ID = 'demo-client-brand-lab';
const CAFE_CLIENT_ID = 'demo-client-cafe-owner';

export interface DemoAccountData {
    readonly profiles: Record<string, ExpertProfile>;
    readonly products: ExpertProduct[];
    readonly requests: ServiceRequestData[];
    readonly proposals: Proposal[];
    readonly works: Work[];
    readonly workSteps: WorkStep[];
    readonly deliverables: Deliverable[];
    readonly reviews: Review[];
    readonly consultations: Consultation[];
    readonly consultationMessages: ConsultationMessage[];
    readonly workMessages: WorkMessage[];
    readonly favoriteProductIds: string[];
}

export const isDemoTestAccountEmail = (email?: string | null) =>
    DEMO_TEST_ACCOUNT_EMAILS.includes(email?.trim().toLowerCase() as typeof DEMO_TEST_ACCOUNT_EMAILS[number]);

export const isDemoAccountRecordId = (id?: string | number | null) =>
    typeof id === 'string' && id.startsWith('demo-');

const createPackages = (
    price: number,
    deliveryDays: number,
    revisionCount: number,
    included: string[],
): ExpertProduct['packages'] => {
    const packageFor = (
        tier: ProductPackage['name'],
        multiplier: number,
        extraDays: number,
        extraRevision: number,
    ): ProductPackage => ({
        name: tier,
        price: Math.round(price * multiplier),
        deliveryDays: deliveryDays + extraDays,
        revisionCount: revisionCount + extraRevision,
        included,
    });

    return {
        standard: packageFor('Standard', 1, 0, 0),
        deluxe: packageFor('Deluxe', 1.8, 1, 1),
        premium: packageFor('Premium', 2.6, 2, 2),
    };
};

const createRequest = (
    id: string,
    clientId: string,
    expertId: string,
    productId: string,
    title: string,
    status: ServiceRequestData['status'],
    budget: number,
    createdAt: string,
): ServiceRequestData => ({
    id,
    title,
    description: 'AI 작업 테스트용 요구사항입니다.',
    budget: String(budget),
    deadline: '2026-07-12',
    categories: ['AI 작업'],
    createdAt,
    updatedAt: createdAt,
    ordererEmail: 'demo-client@example.com',
    clientId,
    expertId,
    status,
    productId,
    selectedPackage: 'standard',
    desiredResult: title,
    purpose: '런칭 전 기능 확인과 시안 검토',
    referenceText: '밝고 이해하기 쉬운 톤, 모바일에서 보기 좋은 결과물',
    referenceLinks: ['https://example.com/reference'],
    progressType: 'milestone',
});

const createProposal = (
    id: string,
    requestId: string,
    clientId: string,
    expertId: string,
    title: string,
    totalPrice: number,
    status: Proposal['status'],
    paymentStatus: NonNullable<Proposal['paymentStatus']>,
): Proposal => ({
    id,
    requestId,
    clientId,
    expertId,
    title,
    scope: '요구사항 정리, 1차 결과물 제출, 최종 검수까지 포함합니다.',
    deliverables: ['작업 방향 문서', '결과물 링크', '최종 전달 파일'],
    totalPrice,
    deliveryDays: 4,
    revisionCount: 2,
    progressType: 'milestone',
    milestones: ['흐름설계', '결과물 제출', '결과물 승인 및 정산'],
    commercialUseAllowed: true,
    sourceFileIncluded: false,
    status,
    paymentStatus,
    platformFeeRate: 0,
    expiresAt: '2026-07-08T23:59:59.000Z',
});

const createWork = (
    id: string,
    proposal: Proposal,
    status: Work['status'],
    settlementStatus: NonNullable<Work['settlementStatus']>,
): Work => ({
    id,
    proposalId: proposal.id,
    requestId: proposal.requestId,
    clientId: proposal.clientId,
    expertId: proposal.expertId,
    title: proposal.title,
    progressType: proposal.progressType,
    status,
    totalPrice: proposal.totalPrice,
    platformFee: 0,
    expertPayout: proposal.totalPrice,
    settlementStatus,
    ...(status === 'cancelled' ? {
        refundStatus: 'fee_excluded_refund_pending' as const,
        cancellationReason: 'before_start' as const,
        cancelledAt: '2026-06-29T11:00:00.000Z',
    } : {}),
    revisionLimit: proposal.revisionCount,
    revisionUsed: status === 'revision_requested' ? 1 : 0,
    stepIds: [`demo-step-${id}-flow`, `demo-step-${id}-deliverable`, `demo-step-${id}-settlement`],
});

const createSteps = (work: Work): WorkStep[] => {
    const submittedOrDone = ['submitted', 'revision_requested', 'completed'].includes(work.status);
    const completed = work.status === 'completed';
    const cancelled = work.status === 'cancelled';

    return [
        {
            id: work.stepIds[0],
            workId: work.id,
            stepOrder: 1,
            title: '흐름설계',
            description: '작업 범위와 레퍼런스를 정리합니다.',
            status: cancelled ? 'waiting' : 'approved',
        },
        {
            id: work.stepIds[1],
            workId: work.id,
            stepOrder: 2,
            title: '결과물 제출',
            description: '작업자가 결과물 링크나 파일을 제출합니다.',
            status: cancelled
                ? 'waiting'
                : work.status === 'revision_requested'
                    ? 'revision_requested'
                    : submittedOrDone
                        ? 'submitted'
                        : 'in_progress',
        },
        {
            id: work.stepIds[2],
            workId: work.id,
            stepOrder: 3,
            title: '결과물 승인 및 정산',
            description: '의뢰자 승인 후 정산 대기 상태로 전환됩니다.',
            status: completed ? 'approved' : 'waiting',
        },
    ];
};

const createDeliverable = (
    work: Work,
    status: Deliverable['status'],
    description: string,
): Deliverable => ({
    id: `demo-deliverable-${work.id}`,
    workId: work.id,
    stepId: work.stepIds[1],
    expertId: work.expertId,
    description,
    externalUrl: `https://example.com/demo/${work.id}`,
    status,
    submittedAt: '2026-06-30T15:30:00.000Z',
});

const profileFor = (
    id: string,
    name: string,
    imageUrl: string,
    profession: string,
    oneLiner: string,
): ExpertProfile => ({
    id,
    imageUrl,
    profession,
    name,
    oneLiner,
    greeting: 'AI 초보 의뢰자도 이해하기 쉽게 범위와 결과물을 나눠 설명합니다.',
    activities: ['브랜드 숏폼 캠페인 시안 제작', '상세페이지 AI 이미지 시안 제작', '반복 업무 자동화 워크플로우 설계'],
    awards: ['2026 AI 콘텐츠 실험 프로젝트 선정', 'AI 제작 입문 워크숍 운영'],
    aiTools: ['ChatGPT', 'Midjourney', 'Runway'],
    editTools: ['Figma', 'CapCut'],
    sampleLinks: ['https://example.com/sample/demo-portfolio'],
    contactAvailableTime: '평일 10:00-19:00',
    averageResponseTime: '보통 2시간 이내',
    packages: {
        standard: { price: '30000', description: '빠른 시안 제작', workDays: '작업일 2일', revisions: '수정 1회', features: ['콘셉트 정리', '1차 시안'] },
        deluxe: { price: '70000', description: '시안과 대본 제작', workDays: '작업일 4일', revisions: '수정 2회', features: ['콘셉트 정리', '대본', '시안'] },
        premium: { price: '150000', description: '최종 결과물 제작', workDays: '작업일 7일', revisions: '수정 3회', features: ['기획', '시안', '최종본'] },
    },
    updatedAt: DEMO_NOW,
});

export function buildDemoAccountData(userId: string, userName = '석준'): DemoAccountData {
    const displayName = userName.trim() || '석준';
    const userImageUrl = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&h=240&fit=crop&crop=faces';
    const partnerImageUrl = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&h=240&fit=crop&crop=faces';

    const products: ExpertProduct[] = [
        {
            id: 'demo-product-benet-shortform',
            expertId: userId,
            expertName: displayName,
            expertImageUrl: userImageUrl,
            title: 'AI 숏폼 광고 영상 콘셉트·대본·시안 제작',
            category: 'ai-video-shortform',
            summary: '초보 의뢰자도 바로 확인 가능한 숏폼 광고 방향을 잡아드립니다.',
            description: '브랜드 목적, 타겟, 사용처를 바탕으로 콘셉트와 대본, 첫 시안을 단계별로 정리합니다.',
            sampleLinks: ['https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1200'],
            sampleImageUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1200',
            startingPrice: 30000,
            deliveryDays: 3,
            revisionCount: 2,
            createdAt: '2026-06-20T10:00:00.000Z',
            taxInvoiceAvailable: true,
            packages: createPackages(30000, 3, 2, ['콘셉트 2안', '15초 대본', 'AI 영상 시안 1개']),
            status: 'published',
        },
        {
            id: 'demo-product-benet-automation',
            expertId: userId,
            expertName: displayName,
            expertImageUrl: userImageUrl,
            title: '반복 업무를 AI 자동화 워크플로우로 정리해드립니다',
            category: 'ai-development-automation',
            summary: '스프레드시트, 문서 정리, 간단한 업무 도구를 저렴하게 자동화합니다.',
            description: '현재 업무 흐름을 듣고 자동화 가능한 부분을 나눠 작은 프로그램 또는 노코드 흐름으로 제안합니다.',
            sampleLinks: ['https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200'],
            sampleImageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200',
            startingPrice: 50000,
            deliveryDays: 5,
            revisionCount: 1,
            createdAt: '2026-06-24T10:00:00.000Z',
            taxInvoiceAvailable: false,
            packages: createPackages(50000, 5, 1, ['업무 흐름 정리', '자동화 설계서', '간단한 실행 예시']),
            status: 'published',
        },
        {
            id: 'demo-product-partner-character',
            expertId: PARTNER_EXPERT_ID,
            expertName: '루미 AI 스튜디오',
            expertImageUrl: partnerImageUrl,
            title: '브랜드 캐릭터 AI 이미지 시안 제작',
            category: 'ai-image-character',
            summary: '상세페이지와 SNS에 쓸 캐릭터 이미지를 빠르게 제작합니다.',
            description: '브랜드 톤과 참고 이미지를 기반으로 캐릭터 방향과 이미지 시안을 전달합니다.',
            sampleLinks: ['https://images.unsplash.com/photo-1634986666676-ec8fd927c23d?w=1200'],
            sampleImageUrl: 'https://images.unsplash.com/photo-1634986666676-ec8fd927c23d?w=1200',
            startingPrice: 40000,
            deliveryDays: 4,
            revisionCount: 2,
            createdAt: '2026-06-18T10:00:00.000Z',
            taxInvoiceAvailable: true,
            packages: createPackages(40000, 4, 2, ['캐릭터 방향 2안', '이미지 시안 3장', '상업 사용 안내']),
            status: 'published',
        },
    ];

    const requests = [
        createRequest('demo-request-client-waiting', userId, PARTNER_EXPERT_ID, products[2].id, '쿠팡 상세페이지용 AI 캐릭터 시안', 'pending', 40000, '2026-06-30T10:00:00.000Z'),
        createRequest('demo-request-client-proposal', userId, PARTNER_EXPERT_ID, products[2].id, '브랜드 캐릭터 3종 제작 제안 검토', 'pending', 70000, '2026-06-29T10:00:00.000Z'),
        createRequest('demo-request-client-progress', userId, PARTNER_EXPERT_ID, products[2].id, '신제품 소개 이미지 제작 진행', 'in_progress', 90000, '2026-06-28T10:00:00.000Z'),
        createRequest('demo-request-client-submitted', userId, PARTNER_EXPERT_ID, products[2].id, '광고 배너 AI 이미지 최종 검수', 'in_progress', 85000, '2026-06-27T10:00:00.000Z'),
        createRequest('demo-request-client-revision', userId, PARTNER_EXPERT_ID, products[2].id, '썸네일 이미지 수정 요청 확인', 'in_progress', 60000, '2026-06-26T10:00:00.000Z'),
        createRequest('demo-request-client-completed-reviewable', userId, PARTNER_EXPERT_ID, products[2].id, '리뷰 작성 테스트용 완료 거래', 'completed', 50000, '2026-06-25T10:00:00.000Z'),
        createRequest('demo-request-client-reviewed', userId, PARTNER_EXPERT_ID, products[2].id, '리뷰 등록 완료 상태 확인용 거래', 'completed', 45000, '2026-06-24T10:00:00.000Z'),
        createRequest('demo-request-client-cancelled', userId, PARTNER_EXPERT_ID, products[2].id, '작업 시작 전 취소 환불 예정 거래', 'in_progress', 30000, '2026-06-23T10:00:00.000Z'),
        createRequest('demo-request-expert-new', BRAND_CLIENT_ID, userId, products[0].id, '브랜드 런칭 숏폼 문의', 'pending', 30000, '2026-06-30T09:00:00.000Z'),
        createRequest('demo-request-expert-proposal', CAFE_CLIENT_ID, userId, products[0].id, '카페 홍보 영상 제안서 대기', 'pending', 70000, '2026-06-29T09:00:00.000Z'),
        createRequest('demo-request-expert-progress', BRAND_CLIENT_ID, userId, products[1].id, '리드 수집 자동화 작업 진행', 'in_progress', 120000, '2026-06-28T09:00:00.000Z'),
        createRequest('demo-request-expert-submitted', CAFE_CLIENT_ID, userId, products[0].id, '릴스 영상 시안 제출 후 검토 대기', 'in_progress', 80000, '2026-06-27T09:00:00.000Z'),
    ];

    const proposals = [
        createProposal('demo-proposal-client-unpaid', 'demo-request-client-proposal', userId, PARTNER_EXPERT_ID, '브랜드 캐릭터 3종 제작 제안서', 70000, 'sent', 'unpaid'),
        createProposal('demo-proposal-client-progress', 'demo-request-client-progress', userId, PARTNER_EXPERT_ID, '신제품 소개 이미지 제작', 90000, 'accepted', 'paid'),
        createProposal('demo-proposal-client-submitted', 'demo-request-client-submitted', userId, PARTNER_EXPERT_ID, '광고 배너 AI 이미지 제작', 85000, 'accepted', 'paid'),
        createProposal('demo-proposal-client-revision', 'demo-request-client-revision', userId, PARTNER_EXPERT_ID, '썸네일 이미지 수정 포함 제작', 60000, 'accepted', 'paid'),
        createProposal('demo-proposal-client-completed-reviewable', 'demo-request-client-completed-reviewable', userId, PARTNER_EXPERT_ID, '리뷰 작성 테스트 완료 거래', 50000, 'accepted', 'paid'),
        createProposal('demo-proposal-client-reviewed', 'demo-request-client-reviewed', userId, PARTNER_EXPERT_ID, '리뷰 등록 완료 거래', 45000, 'accepted', 'paid'),
        createProposal('demo-proposal-client-cancelled', 'demo-request-client-cancelled', userId, PARTNER_EXPERT_ID, '취소 환불 예정 거래', 30000, 'cancelled', 'refunded'),
        createProposal('demo-proposal-expert-sent', 'demo-request-expert-proposal', CAFE_CLIENT_ID, userId, '카페 홍보 영상 제안서', 70000, 'sent', 'unpaid'),
        createProposal('demo-proposal-expert-progress', 'demo-request-expert-progress', BRAND_CLIENT_ID, userId, '리드 수집 자동화 작업', 120000, 'accepted', 'paid'),
        createProposal('demo-proposal-expert-submitted', 'demo-request-expert-submitted', CAFE_CLIENT_ID, userId, '릴스 영상 시안 제출 거래', 80000, 'accepted', 'paid'),
        createProposal('demo-proposal-expert-revision-requested', 'demo-request-expert-new', BRAND_CLIENT_ID, userId, '브랜드 런칭 숏폼 수정 제안', 30000, 'revision_requested', 'unpaid'),
    ];

    const works = [
        createWork('demo-work-client-progress', proposals[1], 'in_progress', 'held'),
        createWork('demo-work-client-submitted', proposals[2], 'submitted', 'held'),
        createWork('demo-work-client-revision', proposals[3], 'revision_requested', 'held'),
        createWork('demo-work-client-completed-reviewable', proposals[4], 'completed', 'pending'),
        createWork('demo-work-client-reviewed', proposals[5], 'completed', 'settled'),
        createWork('demo-work-client-cancelled', proposals[6], 'cancelled', 'held'),
        createWork('demo-work-expert-progress', proposals[8], 'in_progress', 'held'),
        createWork('demo-work-expert-submitted', proposals[9], 'submitted', 'held'),
    ];

    return {
        profiles: {
            [userId]: profileFor(userId, displayName, userImageUrl, 'AI 영상·이미지 제작자', 'AI 초보 의뢰자도 이해하기 쉽게, 빠른 시안과 명확한 작업 범위로 제작합니다.'),
            [PARTNER_EXPERT_ID]: profileFor(PARTNER_EXPERT_ID, '루미 AI 스튜디오', partnerImageUrl, 'AI 이미지·캐릭터 제작자', '브랜드에 바로 붙일 수 있는 캐릭터와 이미지 시안을 빠르게 제작합니다.'),
            [BRAND_CLIENT_ID]: profileFor(BRAND_CLIENT_ID, '브랜드랩 김민지', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=240&h=240&fit=crop&crop=faces', '브랜드 마케터', '런칭 캠페인에 필요한 AI 작업을 의뢰합니다.'),
            [CAFE_CLIENT_ID]: profileFor(CAFE_CLIENT_ID, '카페온 박하은', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&h=240&fit=crop&crop=faces', '소상공인 의뢰자', '매장 홍보에 쓸 AI 콘텐츠를 테스트합니다.'),
        },
        products,
        requests,
        proposals,
        works,
        workSteps: works.flatMap(createSteps),
        deliverables: [
            createDeliverable(works[1], 'submitted', '광고 배너 이미지 1차 제출 링크입니다.'),
            createDeliverable(works[2], 'revision_requested', '색감 수정 요청이 들어온 썸네일 이미지 제출본입니다.'),
            createDeliverable(works[3], 'approved', '리뷰 작성 테스트용 최종 결과물입니다.'),
            createDeliverable(works[4], 'approved', '이미 리뷰가 등록된 최종 결과물입니다.'),
            createDeliverable(works[7], 'submitted', '카페 릴스 영상 1차 시안 링크입니다.'),
        ],
        reviews: [
            {
                id: 'demo-review-client-reviewed',
                workId: 'demo-work-client-reviewed',
                clientId: userId,
                clientName: displayName,
                clientImageUrl: userImageUrl,
                expertId: PARTNER_EXPERT_ID,
                rating: 5,
                content: '이미지 톤이 깔끔했고 수정 요청도 빠르게 반영됐습니다. 상세페이지에 바로 넣기 좋았습니다.',
                createdAt: '2026-06-29T10:00:00.000Z',
                createdAtLabel: '2일 전',
                priceRangeLabel: '4만 원대',
                workDurationDays: 3,
            },
            {
                id: 'demo-review-expert-received',
                workId: 'demo-work-expert-submitted',
                clientId: CAFE_CLIENT_ID,
                clientName: '카페온 박하은',
                clientImageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&h=240&fit=crop&crop=faces',
                expertId: userId,
                rating: 5,
                content: 'AI로 만든 영상 콘셉트가 이해하기 쉬웠고, 어떤 도구를 써야 하는지 판단하는 데 도움이 됐습니다.',
                createdAt: '2026-06-27T10:00:00.000Z',
                createdAtLabel: '4일 전',
                priceRangeLabel: '8만 원대',
                workDurationDays: 4,
            },
        ],
        consultations: [
            {
                id: 'demo-consultation-client-open',
                clientId: userId,
                expertId: PARTNER_EXPERT_ID,
                productId: products[2].id,
                status: 'open',
                title: '캐릭터 시안 제작 상담',
                lastMessageAt: '2026-07-01T08:50:00.000Z',
                createdAt: '2026-07-01T08:30:00.000Z',
            },
            {
                id: 'demo-consultation-expert-proposal',
                clientId: BRAND_CLIENT_ID,
                expertId: userId,
                productId: products[0].id,
                status: 'proposal_sent',
                title: '브랜드 숏폼 제안서 상담',
                lastMessageAt: '2026-06-30T17:10:00.000Z',
                createdAt: '2026-06-30T16:30:00.000Z',
            },
        ],
        consultationMessages: [
            {
                id: 'demo-consultation-message-client-01',
                consultationId: 'demo-consultation-client-open',
                senderId: userId,
                body: '쿠팡 상세페이지에 쓸 캐릭터 이미지를 3장 정도 만들고 싶습니다.',
                attachmentUrls: [],
                createdAt: '2026-07-01T08:30:00.000Z',
            },
            {
                id: 'demo-consultation-message-client-02',
                consultationId: 'demo-consultation-client-open',
                senderId: PARTNER_EXPERT_ID,
                body: '사용 목적과 참고 스타일을 주시면 1차 방향을 먼저 잡아드릴게요.',
                attachmentUrls: [],
                createdAt: '2026-07-01T08:50:00.000Z',
            },
            {
                id: 'demo-consultation-message-expert-01',
                consultationId: 'demo-consultation-expert-proposal',
                senderId: BRAND_CLIENT_ID,
                body: '초보자도 이해할 수 있게 숏폼 콘셉트와 대본을 같이 받고 싶습니다.',
                attachmentUrls: [],
                createdAt: '2026-06-30T16:30:00.000Z',
            },
            {
                id: 'demo-consultation-message-expert-02',
                consultationId: 'demo-consultation-expert-proposal',
                senderId: userId,
                body: '가능합니다. 콘셉트 2안과 15초 대본을 포함한 제안서를 보내드렸습니다.',
                attachmentUrls: [],
                createdAt: '2026-06-30T17:10:00.000Z',
            },
        ],
        workMessages: works.map((work): WorkMessage => ({
            id: `demo-work-message-${work.id}`,
            workId: work.id,
            senderId: work.clientId === userId ? userId : work.expertId,
            body: `${work.title} 진행 상태를 확인할 수 있는 테스트 메시지입니다.`,
            attachmentUrls: [],
            createdAt: '2026-06-30T12:00:00.000Z',
        })),
        favoriteProductIds: [products[2].id],
    };
}
