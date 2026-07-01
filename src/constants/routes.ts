/**
 * 라우트 경로 상수
 * - 경로를 한 곳에서 관리하여 오타 방지 및 일괄 변경 가능
 * - 새로운 페이지 추가 시 반드시 여기에 경로를 먼저 등록할 것
 */
export const ROUTES = {
    HOME: '/',
    CATEGORY: '/category',
    EXPERT_DETAIL: '/expert/:id',
    PRODUCT_NEW: '/products/new',
    PRODUCT_EDIT: '/products/:productId/edit',
    SERVICE_REQUEST_PRODUCT: '/request/:productId',
    PROPOSAL_NEW: '/proposals/new',
    PROPOSAL: '/proposal/:proposalId',
    WORKROOM: '/workroom/:workId',
    WORK_DASHBOARD: '/my-work',
    LOGIN: '/login',
    ONBOARDING: '/onboarding',
    MY_PAGE: '/mypage',
    PROFILE: '/profile',
    ADMIN: '/admin',
} as const;

/** ROUTES 값들의 유니온 타입 (타입 가드에 활용 가능) */
export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
