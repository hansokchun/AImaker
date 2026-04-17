/**
 * Home 페이지 (메인 랜딩)
 * - Hero 섹션: 검색바 + 인기 키워드
 * - 카테고리 그리드: 10대 핵심 서비스 카테고리
 * - 실시간 요청: 최신 프로젝트 요청 미니 카드
 * - 추천 전문가: EXPERTS 데이터에서 상위 3명 표시
 */
import { Link } from 'react-router-dom';
import ExpertCard from '../components/ExpertCard';
import { EXPERTS } from '../data/mockData';
import { ROUTES } from '../constants/routes';

export default function Home() {
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

            {/* ===== 실시간 프로젝트 요청 — 하드코딩 미니카드 (향후 DB 연동 예정) ===== */}
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
                        <Link to={ROUTES.REQUEST_BOARD} className="request-mini-card">
                            <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '700', marginBottom: '0.5rem' }}>AI 영상</div>
                            <h3 style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>브랜드 홍보용 시네마틱 영상 제작 요청</h3>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                <span>₩800,000~</span><span>오늘 등록</span>
                            </div>
                        </Link>
                        <Link to={ROUTES.REQUEST_BOARD} className="request-mini-card">
                            <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '700', marginBottom: '0.5rem' }}>AI 개발</div>
                            <h3 style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>사내 데이터 기반 맞춤형 챗봇 구축 전문가</h3>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                <span>₩2,500,000~</span><span>2시간 전</span>
                            </div>
                        </Link>
                        <Link to={ROUTES.REQUEST_BOARD} className="request-mini-card">
                            <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '700', marginBottom: '0.5rem' }}>AI 디자인</div>
                            <h3 style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>웹툰 배경 생성 모델 튜닝 및 가이드 제작</h3>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                <span>₩450,000~</span><span>5시간 전</span>
                            </div>
                        </Link>
                    </div>
                </div>
            </section>

            {/* ===== 추천 전문가 ===== */}
            <section className="featured-experts container">
                <h2 className="section-title">이달의 추천 전문가</h2>
                <p className="section-subtitle">검증된 실력과 뛰어난 평점을 보유한 파트너입니다.</p>
                <div className="expert-grid">
                    {EXPERTS.slice(0, 3).map((expert) => (
                        <ExpertCard key={expert.id} expert={expert} />
                    ))}
                </div>
            </section>
        </main>
    );
}
