/**
 * Home 페이지 (메인 랜딩)
 * - Hero 섹션: 검색바 + 인기 키워드
 * - 카테고리 그리드: 10대 핵심 서비스 카테고리
 * - 실시간 요청: DB에서 최신 3건 동적 로딩
 * - 추천 전문가: EXPERTS 데이터에서 상위 3명 표시
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ExpertCard from '../components/ExpertCard';
import { getStoredRequests, getExpertList } from '../lib/storage';
import { ROUTES } from '../constants/routes';
import type { ServiceRequestData, Expert } from '../types';

export default function Home() {
    // 실시간 요청 데이터 — DB에서 최신 3건을 비동기 로딩
    const [recentRequests, setRecentRequests] = useState<ServiceRequestData[]>([]);
    const [experts, setExperts] = useState<Expert[]>([]);

    useEffect(() => {
        getStoredRequests().then(data => {
            // 최신 3건만 사용 (이미 최신순 정렬되어 있음)
            setRecentRequests(data.slice(0, 3));
        });
        getExpertList().then(data => {
            // 전문가 상위 3명
            setExperts(data.slice(0, 3));
        });
    }, []);

    return (
        <main>
            {/* ===== Hero 섹션 — 사용자의 첫 인상을 결정하는 영역 ===== */}
            <section className="hero container">
                <div className="hero-content">
                    <h1 className="hero-title">상상을 현실로 만드는<br/><span className="highlight">최고의 AI 전문가</span></h1>
                    <p className="hero-subtitle">검증된 AI 아티스트, 개발자, 마케터와 함께 비즈니스의 새로운 가능성을 열어보세요.</p>
                    <div className="search-bar-container">
                        <form className="search-form" onSubmit={(e) => e.preventDefault()}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)' }}>search</span>
                            <input type="text" className="search-input" placeholder="어떤 전문가를 찾고 계신가요?" />
                            <button type="submit" className="btn-search">검색</button>
                        </form>
                    </div>
                    <div className="popular-searches">
                        <span className="popular-label">인기 키워드</span>
                        <div className="tag-group">
                            <a href="#" className="tag">#AI 영상 제작</a>
                            <a href="#" className="tag">#미드저니</a>
                            <a href="#" className="tag">#챗봇 개발</a>
                            <a href="#" className="tag">#캐릭터 디자인</a>
                        </div>
                    </div>
                </div>
                <div className="hero-image-container">
                    <img src="https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80" alt="AI Collaboration" className="hero-image" />
                    <div className="floating-badge badge-1">
                        <div className="badge-icon" style={{ color: '#f59e0b' }}><span className="material-symbols-outlined">star</span></div>
                        <div className="badge-text"><strong>4.9</strong><span>평균 평점</span></div>
                    </div>
                    <div className="floating-badge badge-2">
                        <div className="badge-icon" style={{ color: '#10b981' }}><span className="material-symbols-outlined">bolt</span></div>
                        <div className="badge-text"><strong>Fast</strong><span>빠른 마감</span></div>
                    </div>
                </div>
            </section>

            {/* ===== 서비스 카테고리 그리드 ===== */}
            <section className="categories container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem' }}>
                    <div>
                        <h2 className="section-title">서비스 카테고리</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>원하시는 분야의 전문 AI 서비스를 탐색해보세요.</p>
                    </div>
                    <Link to={ROUTES.CATEGORY} className="btn-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                        전체보기 <span className="material-symbols-outlined">arrow_forward</span>
                    </Link>
                </div>
                <div className="category-grid">
                    <Link to={ROUTES.CATEGORY} className="category-card"><div className="category-icon">🎬</div><h3 className="category-name">AI 영화 제작</h3></Link>
                    <Link to={ROUTES.CATEGORY} className="category-card"><div className="category-icon">✨</div><h3 className="category-name">AI 애니메이션</h3></Link>
                    <Link to={ROUTES.CATEGORY} className="category-card"><div className="category-icon">📱</div><h3 className="category-name">AI 광고 제작</h3></Link>
                    <Link to={ROUTES.CATEGORY} className="category-card"><div className="category-icon">🎨</div><h3 className="category-name">AI 이미지 제작</h3></Link>
                    <Link to={ROUTES.CATEGORY} className="category-card"><div className="category-icon">👤</div><h3 className="category-name">AI 캐릭터 제작</h3></Link>
                    <Link to={ROUTES.CATEGORY} className="category-card"><div className="category-icon">🎵</div><h3 className="category-name">AI 음원 만들기</h3></Link>
                    <Link to={ROUTES.CATEGORY} className="category-card"><div className="category-icon">🎙️</div><h3 className="category-name">AI 성우 입히기</h3></Link>
                    <Link to={ROUTES.CATEGORY} className="category-card"><div className="category-icon">🖌️</div><h3 className="category-name">AI 그래픽 디자인</h3></Link>
                    <Link to={ROUTES.CATEGORY} className="category-card"><div className="category-icon">📹</div><h3 className="category-name">AI 클립 구매</h3></Link>
                    <Link to={ROUTES.CATEGORY} className="category-card"><div className="category-icon">⚡</div><h3 className="category-name">AI 프롬프트 구매</h3></Link>
                </div>
            </section>

            {/* ===== 실시간 프로젝트 요청 — DB에서 최신 3건 동적 로딩 ===== */}
            <section className="recent-requests-section">
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem' }}>
                        <div>
                            <h2 className="section-title">실시간 프로젝트 요청</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>지금 바로 지원 가능한 최신 의뢰 건들입니다.</p>
                        </div>
                        <Link to={ROUTES.REQUEST_BOARD} className="btn-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                            게시판 가기 <span className="material-symbols-outlined">arrow_forward</span>
                        </Link>
                    </div>
                    <div className="request-mini-grid">
                        {recentRequests.length > 0 ? (
                            recentRequests.map((req) => (
                                <Link to={ROUTES.REQUEST_BOARD} className="request-mini-card" key={req.id}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '700', marginBottom: '0.5rem' }}>
                                        {req.categories?.[0] || '기타'}
                                    </div>
                                    <h3 style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
                                        {req.title}
                                    </h3>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                        <span>₩{Number(req.budget).toLocaleString()}~</span>
                                        <span>{req.createdAt}</span>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            /* 요청이 없을 때 — 작성 유도 CTA */
                            <Link to={ROUTES.SERVICE_REQUEST} className="request-mini-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '0.75rem' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: 'var(--primary)' }}>add_circle</span>
                                <h3 style={{ fontWeight: '700', fontSize: '1.1rem', lineHeight: '1.4' }}>
                                    첫 번째 요청서를 작성해보세요!
                                </h3>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    전문가들이 기다리고 있습니다
                                </span>
                            </Link>
                        )}
                    </div>
                </div>
            </section>

            {/* ===== 추천 전문가 ===== */}
            <section className="featured-experts container">
                <h2 className="section-title">이달의 추천 전문가</h2>
                <p className="section-subtitle">검증된 실력과 뛰어난 평점을 보유한 파트너입니다.</p>
                <div className="expert-grid">
                    {experts.map((expert) => (
                        <ExpertCard key={expert.id} expert={expert} />
                    ))}
                </div>
            </section>
        </main>
    );
}
