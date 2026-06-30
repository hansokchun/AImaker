/**
 * 목업 데이터 모듈
 * - 백엔드 연동 전까지 프론트엔드 개발에 사용하는 샘플 데이터
 * - 향후 Supabase 쿼리로 교체될 예정
 */
import type { Expert } from '../types';
import type { ExpertProduct } from '../types';
import { CATEGORY_NAMES } from '../constants/categories';



/**
 * 서비스 카테고리 목록
 * - 초기 런칭 범위의 3개 AI 작업 카테고리
 * - 기존 화면 호환을 위해 문자열 배열로도 제공
 */
export const CATEGORIES: string[] = CATEGORY_NAMES;

export const mockExpertProducts: ExpertProduct[] = [
    {
        id: 'product-ai-shortform-01',
        expertId: 'expert-video-01',
        expertName: '루미 AI 스튜디오',
        expertImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
        title: 'AI 숏폼 영상 콘셉트와 1차 시안을 제작해드립니다',
        category: 'ai-video-shortform',
        summary: '15초 내외 숏폼 영상의 콘셉트, 대본, AI 영상 시안을 빠르게 제작합니다.',
        description: '브랜드나 제품을 소개할 짧은 AI 숏폼 영상이 필요한 의뢰자에게 적합합니다.',
        aiTools: ['ChatGPT', 'Runway', 'Premiere Pro'],
        sampleLinks: ['https://example.com/samples/ai-shortform'],
        sampleImageUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80',
        startingPrice: 30000,
        deliveryDays: 2,
        revisionCount: 1,
        packages: {
            standard: {
                name: 'Standard',
                price: 30000,
                deliveryDays: 2,
                revisionCount: 1,
                included: ['15초 영상 콘셉트', '대본 초안', 'AI 영상 시안 1개'],
            },
            deluxe: {
                name: 'Deluxe',
                price: 70000,
                deliveryDays: 4,
                revisionCount: 2,
                included: ['30초 영상 콘셉트', '대본', 'AI 영상 시안 2개', '기본 편집'],
            },
            premium: null,
        },
        status: 'published',
    },
    {
        id: 'product-ai-image-01',
        expertId: 'expert-image-01',
        expertName: '모아 이미지랩',
        expertImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
        title: 'AI 캐릭터와 브랜드 이미지 시안을 만들어드립니다',
        category: 'ai-image-character',
        summary: 'Midjourney와 Stable Diffusion으로 캐릭터, 프로필, 브랜드 이미지 시안을 제작합니다.',
        description: 'SNS 프로필, 브랜드 키비주얼, 캐릭터 방향성을 빠르게 잡고 싶은 의뢰자에게 적합합니다.',
        aiTools: ['Midjourney', 'Stable Diffusion', 'Photoshop'],
        sampleLinks: ['https://example.com/samples/ai-character'],
        sampleImageUrl: 'https://images.unsplash.com/photo-1686191128892-3b35c3f5f1d1?auto=format&fit=crop&w=800&q=80',
        startingPrice: 25000,
        deliveryDays: 2,
        revisionCount: 1,
        packages: {
            standard: {
                name: 'Standard',
                price: 25000,
                deliveryDays: 2,
                revisionCount: 1,
                included: ['AI 이미지 시안 3장', '스타일 방향 제안', '기본 보정'],
            },
            deluxe: {
                name: 'Deluxe',
                price: 60000,
                deliveryDays: 4,
                revisionCount: 2,
                included: ['AI 이미지 시안 8장', '캐릭터 방향 2종', '상세 보정'],
            },
            premium: {
                name: 'Premium',
                price: 120000,
                deliveryDays: 7,
                revisionCount: 3,
                included: ['AI 이미지 시안 15장', '브랜드 이미지 세트', '활용 가이드'],
            },
        },
        status: 'published',
    },
    {
        id: 'product-ai-automation-01',
        expertId: 'expert-dev-01',
        expertName: '오토메이트 코파일럿',
        expertImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
        title: '반복 업무를 줄이는 AI 자동화 미니 도구를 만들어드립니다',
        category: 'ai-development-automation',
        summary: 'ChatGPT API, 스프레드시트, 간단한 웹 UI를 연결해 반복 업무를 자동화합니다.',
        description: '정리, 분류, 초안 작성처럼 반복되는 업무를 작은 자동화 도구로 줄이고 싶은 팀에 적합합니다.',
        aiTools: ['ChatGPT', 'Cursor', 'Supabase'],
        sampleLinks: ['https://example.com/samples/ai-automation'],
        sampleImageUrl: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80',
        startingPrice: 80000,
        deliveryDays: 5,
        revisionCount: 1,
        packages: {
            standard: {
                name: 'Standard',
                price: 80000,
                deliveryDays: 5,
                revisionCount: 1,
                included: ['업무 흐름 정리', '간단한 자동화 스크립트', '사용 방법 안내'],
            },
            deluxe: null,
            premium: null,
        },
        status: 'published',
    },
];
