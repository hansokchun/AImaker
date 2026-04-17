/**
 * CategorySelector 컴포넌트
 * - 서비스 요청 시 카테고리를 선택하는 칩(chip) 형태의 다중 선택 UI
 * - ServiceRequest 페이지에서 사용
 * - 왜 칩 UI: 체크박스보다 시각적으로 직관적이고, 모바일에서도 터치하기 쉬움
 */
import { CATEGORIES } from '../data/mockData';
import './CategorySelector.css';

interface CategorySelectorProps {
    /** 현재 선택된 카테고리 목록 */
    selected: string[];
    /** 선택 변경 시 호출되는 콜백 */
    onChange: (categories: string[]) => void;
}

export default function CategorySelector({ selected, onChange }: CategorySelectorProps) {
    /** 카테고리 토글 — 이미 선택된 항목이면 제거, 아니면 추가 */
    const toggleCategory = (category: string) => {
        const newSelected = selected.includes(category)
            ? selected.filter((item) => item !== category)
            : [...selected, category];
        onChange(newSelected);
    };

    return (
        <div className="selector-container">
            {CATEGORIES.map((category) => (
                <div
                    key={category}
                    className={`chip ${selected.includes(category) ? 'active' : ''}`}
                    onClick={() => toggleCategory(category)}
                >
                    {category}
                </div>
            ))}
        </div>
    );
}
