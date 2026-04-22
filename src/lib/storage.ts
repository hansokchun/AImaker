/**
 * DB 연동 유틸리티 (Supabase API)
 * - 로컬 환경에선 localStorage를 fallback으로 사용하고,
 *   실제 운영/연동 시 연결된 Supabase Table을 가리키도록 진화 (Step 2 적용)
 */
import type { ServiceRequestData } from '../types';
import { supabase } from './supabase';

const STORAGE_KEYS = { REQUESTS: 'ai_requests' } as const;

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
