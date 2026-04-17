/**
 * 전문가(Expert) 데이터 타입
 * - Supabase DB 스키마와 1:1 매핑을 목표로 하므로,
 *   필드명을 명확하게 유지해야 향후 마이그레이션이 용이함
 */
export interface Expert {
    /** 고유 식별자 */
    id: number;
    /** 전문가 이름 */
    name: string;
    /** 전문 분야 (예: "UI/UX 디자이너") */
    profession: string;
    /** 평균 평점 (0.0 ~ 5.0) */
    rating: number;
    /** 기본 서비스 가격 (원 단위) */
    price: number;
    /** 프로필 이미지 URL */
    imageUrl: string;
}

/**
 * 서비스 요청 데이터 타입
 * - localStorage에 JSON으로 저장되므로, 직렬화 가능한 타입만 사용
 * - 향후 Supabase 테이블로 마이그레이션 예정
 */
export interface ServiceRequestData {
    /** 고유 식별자 (Date.now() 기반으로 생성) */
    id: number;
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
    /** 요청 상태 */
    status: 'pending' | 'in_progress' | 'completed';
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
