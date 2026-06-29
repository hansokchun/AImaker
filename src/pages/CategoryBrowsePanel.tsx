import { AI_CATEGORIES } from '../constants/categories'
import type { AiCategoryId } from '../types'
import './CategoryBrowsePanel.css'

interface CategoryBrowsePanelProps {
    readonly selectedCategories: readonly AiCategoryId[]
    readonly onSelectCategory: (categoryId: AiCategoryId) => void
    readonly onSearchTerm: (term: string) => void
}

const categoryInsights: Record<AiCategoryId, { readonly metric: string; readonly note: string }> = {
    'ai-video-shortform': {
        metric: '빠른 시안형',
        note: '숏폼, 광고 영상, 콘셉트 영상',
    },
    'ai-image-character': {
        metric: '저가 입문형',
        note: '이미지, 캐릭터, 브랜드 비주얼',
    },
    'ai-development-automation': {
        metric: '맞춤 제작형',
        note: 'AI 코딩, 자동화, 업무 도구',
    },
}

const popularSearches = ['숏폼 영상', '상세페이지 이미지', '업무 자동화', '프롬프트 제작'] as const

export default function CategoryBrowsePanel({
    selectedCategories,
    onSelectCategory,
    onSearchTerm,
}: CategoryBrowsePanelProps) {
    return (
        <section className="category-browse-panel" aria-labelledby="category-browse-heading">
            <div className="category-browse-heading">
                <div>
                    <span>AI 서비스 탐색</span>
                    <h2 id="category-browse-heading">AI 작업을 카테고리별로 탐색하세요</h2>
                </div>
                <p>판매자 샘플, 시작가, 납기를 한 화면에서 비교하세요.</p>
            </div>

            <div className="category-browse-grid" aria-label="AI 작업 카테고리">
                {AI_CATEGORIES.map((category, index) => {
                    const insight = categoryInsights[category.id]
                    const isActiveCategory =
                        selectedCategories.length !== AI_CATEGORIES.length &&
                        selectedCategories.includes(category.id)

                    return (
                        <button
                            key={category.id}
                            type="button"
                            className={`category-browse-card${isActiveCategory ? ' is-active' : ''}`}
                            aria-label={`${category.name} 카테고리 보기`}
                            onClick={() => onSelectCategory(category.id)}
                        >
                            <span className="category-browse-mark" aria-hidden="true">0{index + 1}</span>
                            <strong>{category.name}</strong>
                            <small>{insight.metric}</small>
                            <span>{insight.note}</span>
                        </button>
                    )
                })}
            </div>

            <div className="popular-searches" aria-label="자주 찾는 AI 작업">
                <strong>자주 찾는 AI 작업</strong>
                <div>
                    {popularSearches.map((term) => (
                        <button
                            key={term}
                            type="button"
                            aria-label={`${term} 검색`}
                            onClick={() => onSearchTerm(term)}
                        >
                            {term}
                        </button>
                    ))}
                </div>
            </div>
        </section>
    )
}
