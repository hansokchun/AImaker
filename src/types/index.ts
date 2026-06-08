/**
 * 전문가(Expert) 데이터 타입
 * - Supabase DB 스키마와 1:1 매핑을 목표로 하므로,
 *   필드명을 명확하게 유지해야 향후 마이그레이션이 용이함
 */
export interface Expert {
    /** 고유 식별자 */
    id: string | number;
    /** 전문가 이름 */
    name: string;
    /** 전문 분야 (예: "UI/UX 디자이너") */
    profession: string;
    /** 평균 평점 (0.0 ~ 5.0) */
    rating: number;
    /** 리뷰 갯수 */
    reviews: number;
    /** 기본 서비스 가격 (원 단위) */
    price: number;
    /** 프로필 이미지 URL */
    imageUrl: string;
}

export type AiCategoryId =
    | 'ai-video-shortform'
    | 'ai-image-character'
    | 'ai-development-automation';

export interface AiCategory {
    id: AiCategoryId;
    name: string;
    description: string;
    examples: string[];
}

export type PackageTier = 'standard' | 'deluxe' | 'premium';

export interface ProductPackage {
    name: 'Standard' | 'Deluxe' | 'Premium';
    price: number;
    deliveryDays: number;
    revisionCount: number;
    included: string[];
}

export interface ExpertProduct {
    id: string;
    expertId: string;
    expertName: string;
    title: string;
    category: AiCategoryId;
    summary: string;
    description: string;
    aiTools: string[];
    sampleLinks: string[];
    sampleImageUrl: string;
    startingPrice: number;
    deliveryDays: number;
    revisionCount: number;
    packages: Record<PackageTier, ProductPackage | null> & {
        standard: ProductPackage;
    };
    status: 'draft' | 'published' | 'hidden';
}

export interface AiServiceRequest {
    id: string;
    clientId: string;
    expertId: string;
    productId: string;
    selectedPackage: PackageTier;
    desiredResult: string;
    purpose: string;
    referenceText: string;
    referenceLinks: string[];
    deadline: string;
    progressType: 'single' | 'milestone';
    checklist: {
        commercialUseNeeded: boolean;
        sourceFileNeeded: boolean;
        revisionNeeded: boolean;
        preferredAiTool?: string;
        usageContext: string;
    };
    additionalRequest?: string;
    status: 'submitted' | 'proposal_sent' | 'cancelled';
    title?: string;
    description?: string;
    budget?: string;
    categories?: string[];
}

export interface Proposal {
    id: string;
    requestId: string;
    clientId: string;
    expertId: string;
    title: string;
    scope: string;
    deliverables: string[];
    totalPrice: number;
    deliveryDays: number;
    revisionCount: number;
    progressType: 'single' | 'milestone';
    milestones: string[];
    commercialUseAllowed: boolean;
    sourceFileIncluded: boolean;
    status: 'sent' | 'revision_requested' | 'accepted' | 'cancelled' | 'expired';
    paymentStatus?: 'unpaid' | 'paid' | 'refunded';
    platformFeeRate?: number;
    expiresAt: string;
}

export interface Consultation {
    id: string;
    clientId: string;
    expertId: string;
    productId: string;
    status: 'open' | 'proposal_sent' | 'closed';
    title: string;
    lastMessageAt: string;
    createdAt: string;
}

export interface ConsultationMessage {
    id: string;
    consultationId: string;
    senderId: string;
    body: string;
    attachmentUrls: string[];
    createdAt: string;
}

export interface CreateConsultationInput {
    clientId: string;
    expertId: string;
    productId: string;
    title: string;
    initialMessage: string;
}

export interface Work {
    id: string;
    proposalId: string;
    requestId: string;
    clientId: string;
    expertId: string;
    title: string;
    progressType: 'single' | 'milestone';
    status: 'in_progress' | 'submitted' | 'revision_requested' | 'completed' | 'cancelled';
    totalPrice?: number;
    platformFee?: number;
    expertPayout?: number;
    settlementStatus?: 'held' | 'pending' | 'settled' | 'refunded';
    stepIds: string[];
}

export interface WorkStep {
    id: string;
    workId: string;
    stepOrder: number;
    title: string;
    description: string;
    status: 'waiting' | 'in_progress' | 'submitted' | 'revision_requested' | 'approved';
}

export interface Deliverable {
    id: string;
    workId: string;
    stepId: string;
    expertId: string;
    description: string;
    externalUrl?: string;
    fileUrl?: string;
    status: 'submitted' | 'approved' | 'revision_requested';
    submittedAt: string;
}

export interface Review {
    id: string;
    workId: string;
    clientId: string;
    expertId: string;
    rating: 1 | 2 | 3 | 4 | 5;
    content: string;
    createdAt: string;
}

/**
 * 서비스 요청 데이터 타입
 * - localStorage에 JSON으로 저장되므로, 직렬화 가능한 타입만 사용
 * - 향후 Supabase 테이블로 마이그레이션 예정
 */
export interface ServiceRequestData {
    /** 고유 식별자 (Date.now() 기반으로 생성) */
    id: number | string;
    /** 요청 제목 */
    title: string;
    /** 상세 설명 */
    description: string;
    /** 희망 예산 (문자열 — input[type=number]의 값이 string으로 관리되므로) */
    budget: string;
    /** 마감 기한 (YYYY-MM-DD 형식) */
    deadline: string;
    /** 선택된 카테고리 목록 */
    categories: string[];
    /** 작성일 (toLocaleDateString 형식) */
    createdAt: string;
    /** 마지막 수정일 */
    updatedAt?: string;
    /** 주문자 연락용 이메일 */
    ordererEmail?: string;
    /** Supabase client id */
    clientId?: string;
    /** Supabase expert id */
    expertId?: string;
    /** 요청 상태 */
    status: 'pending' | 'in_progress' | 'completed';
    /** 선택 상품 ID */
    productId?: string;
    /** 선택 패키지 */
    selectedPackage?: PackageTier;
    /** 원하는 결과물 */
    desiredResult?: string;
    /** 작업 목적 */
    purpose?: string;
    /** 참고자료 원문 */
    referenceText?: string;
    /** 참고 링크 목록 */
    referenceLinks?: string[];
    /** 진행 방식 */
    progressType?: 'single' | 'milestone';
}

/**
 * 채팅 메시지 타입
 * - system: 시스템 안내 메시지
 * - expert: 전문가 응답
 * - user: 사용자 입력
 */
export interface ChatMessage {
    type: 'system' | 'expert' | 'user';
    text: string;
}

/**
 * Auth Context 타입
 * - Supabase 세션/유저 정보를 앱 전역에서 공유하기 위한 컨텍스트 값
 */
export interface AuthContextType {
    session: import('@supabase/supabase-js').Session | null;
    user: import('@supabase/supabase-js').User | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

/**
 * 요금 패키지 정보 타입
 * - Standard / Deluxe / Premium 각 단계의 상세 정보
 * - PackageCard, Profile 페이지에서 공통으로 사용
 */
export interface PackageInfo {
    /** 표시 가격 (예: "₩50,000") */
    price: string;
    /** 패키지 설명 */
    description: string;
    /** 작업 소요일 (예: "⏲️ 작업일 2일") */
    workDays: string;
    /** 수정 횟수 (예: "🔄 수정 1회") */
    revisions: string;
    /** 포함 항목 목록 */
    features: string[];
}

/**
 * 전문가 프로필 데이터 타입
 * - ExpertDetail 페이지의 모든 섹션을 편집 가능한 데이터로 정의
 * - localStorage에 저장 → 향후 Supabase expert_profiles 테이블로 마이그레이션 예정
 */
export interface ExpertProfile {
    /** Supabase 사용자 ID (auth.uid와 매핑) */
    id?: string;
    /** 프로필 이미지 URL */
    imageUrl: string;
    /** 전문 분야 (예: "AI 영상 및 이미지 생성 전문가") */
    profession: string;
    /** 전문가 이름 */
    name: string;
    /** 한 줄 소개 (프로필 상단에 표시) */
    oneLiner: string;
    /** 상세 인사말 */
    greeting: string;
    /** 주요 활동 목록 */
    activities: string[];
    /** 수상 이력 목록 */
    awards: string[];
    /** AI 도구 목록 (예: ["Midjourney", "Stable Diffusion"]) */
    aiTools: string[];
    /** 편집/후반 작업 도구 목록 */
    editTools: string[];
    /** 대표 포트폴리오/샘플 링크 목록 */
    sampleLinks?: string[];
    /** 3단계 요금 패키지 */
    packages: {
        standard: PackageInfo;
        deluxe: PackageInfo;
        premium: PackageInfo;
    };
    /** 마지막 수정 시각 */
    updatedAt?: string;
}
