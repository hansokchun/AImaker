/**
 * localStorage 유틸리티
 * - JSON.parse 실패 시 앱 크래시를 방지하는 안전한 래퍼 함수 제공
 * - 왜 분리했나: ServiceRequest와 RequestBoard에서 동일한 localStorage 로직이
 *   중복되어 있었고, 에러 처리도 없었음
 */
import type { ServiceRequestData } from '../types';

/** localStorage 키 — 오타 방지를 위해 상수로 관리 */
const STORAGE_KEYS = {
    REQUESTS: 'ai_requests',
} as const;

/**
 * 저장된 서비스 요청 목록을 안전하게 불러온다.
 * localStorage 데이터가 손상되었을 경우 빈 배열을 반환하여 앱 크래시를 방지
 */
export function getStoredRequests(): ServiceRequestData[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.REQUESTS);
        if (!raw) return [];

        const parsed = JSON.parse(raw);

        // 파싱 결과가 배열이 아닌 경우 방어 (데이터 오염 대비)
        if (!Array.isArray(parsed)) {
            console.warn('저장된 요청 데이터 형식이 올바르지 않습니다. 초기화합니다.');
            return [];
        }

        return parsed as ServiceRequestData[];
    } catch (error) {
        console.error('서비스 요청 데이터 로딩 실패:', error);
        return [];
    }
}

/**
 * 새로운 서비스 요청을 localStorage에 저장한다.
 * 기존 목록에 추가하는 방식 (append)
 */
export function saveRequest(request: ServiceRequestData): void {
    try {
        const existing = getStoredRequests();
        existing.push(request);
        localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(existing));
    } catch (error) {
        console.error('서비스 요청 저장 실패:', error);
        throw new Error('요청 저장에 실패했습니다. 다시 시도해 주세요.');
    }
}
