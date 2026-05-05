/**
 * Category 페이지 — 전문가 탐색
 * - 좌측 필터 사이드바 + 우측 전문가 카드 리스트 구조
 * - 카테고리, 가격, 등급으로 필터링 가능 (현재 UI만 구현, 실제 필터링은 향후 구현)
 */
import { useState, useEffect } from 'react';
import ExpertCard from '../components/ExpertCard';
import { CATEGORIES } from '../data/mockData';
import { getExpertList } from '../lib/storage';
import type { Expert } from '../types';
import './Category.css';

export default function Category() {
    const [allExperts, setAllExperts] = useState<Expert[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>(CATEGORIES);
    const [sortBy, setSortBy] = useState<string>('최신순');
    const [maxPrice, setMaxPrice] = useState<number>(1000000);

    // 컴포넌트 마운트 시 전문가 목록 로드
    useEffect(() => {
        getExpertList().then(data => setAllExperts(data));
    }, []);

    const toggleCategory = (category: string) => {
        if (selectedCategories.includes(category)) {
            setSelectedCategories(selectedCategories.filter((item) => item !== category));
        } else {
            setSelectedCategories([...selectedCategories, category]);
        }
    };

    // 필터링 로직
    const filteredExperts = allExperts.filter(expert => {
        // 1. 카테고리 필터 (전문 분야나 한줄 소개, 이름 등에 포함되는지 단순 텍스트 매칭)
        // 실제 운영 시에는 expert_profiles에 categories 배열을 추가하여 매칭하는 것이 좋습니다.
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.some(cat => 
            expert.profession?.includes(cat) || expert.name?.includes(cat) || (expert as any).oneLiner?.includes(cat)
        );

        // 2. 가격 필터
        const matchesPrice = expert.price <= maxPrice;

        return matchesCategory && matchesPrice;
    });

    // 정렬 로직 적용
    const sortedExperts = [...filteredExperts].sort((a, b) => {
        switch (sortBy) {
            case '평점 높은순':
                return b.rating - a.rating;
            case '리뷰순':
                return b.reviews - a.reviews;
            case '가격 높은순':
                return b.price - a.price;
            case '가격 낮은순':
                return a.price - b.price;
            case '추천순':
            case '최신순':
            default:
                // ID가 UUID 문자열일 수 있으므로 우선순위 비교를 위해 문자열 비교 또는 기본값 사용
                return String(b.id).localeCompare(String(a.id));
        }
    });

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
                            <input 
                                type="range" 
                                min="0" 
                                max="1000000" 
                                step="10000"
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(Number(e.target.value))}
                                style={{ width: '100%', marginBottom: '0.5rem' }} 
                            />
                            <div style={{ textAlign: 'center', marginBottom: '0.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                                {maxPrice >= 1000000 ? '전체 (최대치)' : `${(maxPrice / 10000).toLocaleString()}만원 이하`}
                            </div>
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
                            <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>총 {sortedExperts.length}명의 전문가</span>
                            <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                                <option value="최신순">최신순</option>
                                <option value="추천순">추천순</option>
                                <option value="평점 높은순">평점 높은순</option>
                                <option value="리뷰순">리뷰순</option>
                                <option value="가격 높은순">가격 높은순</option>
                                <option value="가격 낮은순">가격 낮은순</option>
                            </select>
                        </div>
                        <div className="expert-grid">
                            {sortedExperts.map((expert) => (
                                <ExpertCard key={expert.id} expert={expert} />
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
