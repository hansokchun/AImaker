import type { AiCategory } from '../types'

export const AI_CATEGORIES: AiCategory[] = [
    {
        id: 'ai-video-shortform',
        name: 'AI 영상/숏폼',
        description: '숏폼, 광고 영상, 영상 콘셉트, AI 영상 시안을 의뢰할 수 있습니다.',
        examples: ['숏폼 영상', '광고 영상', '영상 콘셉트'],
    },
    {
        id: 'ai-image-character',
        name: 'AI 이미지/캐릭터',
        description: '이미지 생성, 캐릭터, 프로필 이미지, 브랜드 이미지를 의뢰할 수 있습니다.',
        examples: ['이미지 생성', '캐릭터 시안', '브랜드 이미지'],
    },
    {
        id: 'ai-development-automation',
        name: 'AI 개발/자동화',
        description: 'AI 코딩, 업무 자동화, 간단한 웹/프로그램 제작을 의뢰할 수 있습니다.',
        examples: ['AI 코딩', '업무 자동화', '간단한 웹 제작'],
    },
]

export const CATEGORY_NAMES = AI_CATEGORIES.map((category) => category.name)
