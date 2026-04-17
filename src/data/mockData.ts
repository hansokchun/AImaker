/**
 * 목업 데이터 모듈
 * - 백엔드 연동 전까지 프론트엔드 개발에 사용하는 샘플 데이터
 * - 향후 Supabase 쿼리로 교체될 예정
 */
import type { Expert } from '../types';

/** 전문가 샘플 데이터 */
export const EXPERTS: Expert[] = [
    { id: 1, name: "김디자인 전문가", profession: "UI/UX 디자이너", rating: 4.9, price: 150000, imageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600" },
    { id: 2, name: "이코딩 전문가", profession: "프론트엔드 개발자", rating: 4.8, price: 300000, imageUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600" },
    { id: 3, name: "박마켓 전문가", profession: "퍼포먼스 마케터", rating: 5.0, price: 100000, imageUrl: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600" },
    { id: 4, name: "최편집 전문가", profession: "영상 편집자", rating: 4.7, price: 80000, imageUrl: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600" },
    { id: 5, name: "정개발 전문가", profession: "백엔드 개발자", rating: 4.9, price: 500000, imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600" },
    { id: 6, name: "한로고 전문가", profession: "로고 디자이너", rating: 4.6, price: 50000, imageUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600" },
];

/**
 * 서비스 카테고리 목록
 * - blueprint.md의 "10대 핵심 서비스" 중 의뢰 가능한 8개 카테고리
 * - "AI 클립 구매"와 "AI 프롬프트 구매"는 결과물 판매이므로 요청 카테고리에서 제외
 */
export const CATEGORIES: string[] = [
    'AI 영화 제작', 'AI 애니메이션 제작', 'AI 광고 제작 (숏폼)', 'AI 이미지 제작',
    'AI 캐릭터 제작', 'AI 음원 만들기', 'AI 성우 입히기', 'AI 그래픽 디자인',
];
