import './CategoryBrowsePanel.css'

interface CategoryBrowsePanelProps {
    readonly onSearchTerm: (term: string) => void
}

const popularSearches = ['숏폼 영상', '상세페이지 이미지', '업무 자동화', '프롬프트 제작'] as const

export default function CategoryBrowsePanel({
    onSearchTerm,
}: CategoryBrowsePanelProps) {
    return (
        <section className="category-browse-panel" aria-label="자주 찾는 AI 작업">
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
