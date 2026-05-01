/**
 * DB 연동 유틸리티 (Supabase API)
 * - 로컬 환경에선 localStorage를 fallback으로 사용하고,
 *   실제 운영/연동 시 연결된 Supabase Table을 가리키도록 진화 (Step 2 적용)
 */
import type { ServiceRequestData, ExpertProfile } from '../types';
import { supabase } from './supabase';

/** localStorage 키 — 오타 방지를 위해 상수로 관리 */
const STORAGE_KEYS = {
    REQUESTS: 'ai_requests',
    PROFILE: 'ai_profile',
} as const;

export async function getStoredRequests(): Promise<ServiceRequestData[]> {
    if (!supabase) {
        console.warn('Supabase 미설정: localStorage 폴백 모드로 로딩합니다.');
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.REQUESTS);
            return raw ? JSON.parse(raw) : [];
        } catch(e) { return []; }
    }

    const { data, error } = await supabase.from('service_requests').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('DB 요청 로딩 에러:', error);
        return [];
    }

    // 서버 데이터를 클라이언트 ServiceRequestData 타입으로 매핑
    return data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        budget: item.budget ? String(item.budget) : '',
        deadline: item.deadline || '',
        categories: item.categories || [],
        ordererEmail: item.orderer_email || '',
        createdAt: new Date(item.created_at).toLocaleDateString(),
        status: item.status as any,
    })) as ServiceRequestData[];
}

export async function saveRequest(request: ServiceRequestData, userId?: string | null): Promise<void> {
    if (!supabase) {
        const existing = await getStoredRequests();
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
export function getStoredProfile(userId: string): ExpertProfile | null {
    try {
        const raw = localStorage.getItem(`${STORAGE_KEYS.PROFILE}_${userId}`);
        if (!raw) return null;

        const parsed = JSON.parse(raw);

        // 최소한의 구조 검증 — name 필드가 있는지 확인
        if (typeof parsed !== 'object' || parsed === null) {
            console.warn('프로필 데이터 형식이 올바르지 않습니다.');
            return null;
        }

        return parsed as ExpertProfile;
    } catch (error) {
        console.error('프로필 데이터 로딩 실패:', error);
        return null;
    }
}

/**
 * 프로필 데이터를 localStorage에 저장한다.
 * - 저장 시 updatedAt 타임스탬프를 자동으로 갱신
 */
export function saveProfile(userId: string, profile: ExpertProfile): void {
    try {
        const toSave: ExpertProfile = {
            ...profile,
            id: userId,
            updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(`${STORAGE_KEYS.PROFILE}_${userId}`, JSON.stringify(toSave));
    } catch (error) {
        console.error('프로필 저장 실패:', error);
        throw new Error('프로필 저장에 실패했습니다. 다시 시도해 주세요.');
    }
}

