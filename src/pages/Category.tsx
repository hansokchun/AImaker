/**
 * Category 페이지 — 전문가 탐색
 * - 좌측 필터 사이드바 + 우측 전문가 카드 리스트 구조
 * - 카테고리, 가격, 등급으로 필터링 가능 (현재 UI만 구현, 실제 필터링은 향후 구현)
 */
import { useState } from 'react';
import ExpertCard from '../components/ExpertCard';
import { EXPERTS, CATEGORIES } from '../data/mockData';
import './Category.css';

export default function Category() {
    const [selectedCategories, setSelectedCategories] = useState<string[]>(CATEGORIES);

    const toggleCategory = (category: string) => {
        if (selectedCategories.includes(category)) {
            setSelectedCategories(selectedCategories.filter((item) => item !== category));
        } else {
            setSelectedCategories([...selectedCategories, category]);
        }
    };

    return (
        <>
            {/* 페이지 헤더 */}
            <div className="category-hero">
                <div className="container">
                    <h1 style={{ fontSize: '2.75rem', fontWeight: 800, marginBottom: '1.25rem', letterSpacing: '-0.02em' }}>전문가 탐색</h1>
                    <p style={{ fontSize: '1.1rem', opacity: 0.9, maxWidth: '600px', lineHeight: 1.6 }}>분야별 최고의 전문가들과 함께 비즈니스의 새로운 가능성을 열어보세요.</p>
                </div>
            </div>

            <main className="container">
                <div className="category-page-layout">
                    {/* 필터 사이드바 */}
                    <aside className="filter-sidebar">
                        <div className="filter-group">
                            <h4>서비스 분야</h4>
                            {CATEGORIES.map((category) => (
                                <label key={category}>
                                    <input
                                        type="checkbox"
                                        checked={selectedCategories.includes(category)}
                                        onChange={() => toggleCategory(category)}
                                    />
                                    {category}
                                </label>
                            ))}
                        </div>
                        <div className="filter-group">
                            <h4>가격 범위</h4>
                            <input type="range" min="0" max="1000000" style={{ width: '100%', marginBottom: '1rem' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                <span>0원</span>
                                <span>100만원+</span>
                            </div>
                        </div>
                        <div className="filter-group">
                            <h4>전문가 등급</h4>
                            <label><input type="checkbox" /> TOP 전문가</label>
                            <label><input type="checkbox" /> 신규 전문가</label>
                        </div>
                        <button className="btn-primary" style={{ width: '100%', padding: '0.8rem' }}>필터 적용</button>
                    </aside>

                    {/* 전문가 리스트 */}
                    <div className="expert-list-main">
                        <div className="expert-list-header">
                            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>총 {EXPERTS.length}명의 전문가</span>
                            <select className="sort-select">
                                <option>추천순</option>
                                <option>평점 높은순</option>
                                <option>가격 낮은순</option>
                                <option>최신순</option>
                            </select>
                        </div>
                        <div className="expert-grid">
                            {EXPERTS.map((expert) => (
                                <ExpertCard key={expert.id} expert={expert} />
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
