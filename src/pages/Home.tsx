/**
 * Home 페이지
 * - 기존 랜딩 레이아웃과 카드 스타일은 유지하면서 초기 런칭 기획 문구로 개편
 * - 전문가 중심 소개보다 AI 작업 상품 탐색과 의뢰 시작을 우선한다.
 */
import { Link } from 'react-router-dom';
import { AI_CATEGORIES } from '../constants/categories';
import { ROUTES } from '../constants/routes';
import { mockExpertProducts } from '../data/mockData';

const categoryIcons: Record<string, string> = {
    'ai-video-shortform': '🎬',
    'ai-image-character': '🎨',
    'ai-development-automation': '⚙️',
};

export default function Home() {
    return (
        <main>
            <section className="hero container">
                <div className="hero-content">
                    <h1 className="hero-title">
                        AI 외주를 더 쉽고<br />
                        <span className="highlight">저렴하게</span>
                    </h1>
                    <p className="hero-subtitle">
                        AI 영상, 이미지, 개발/자동화 작업을 원하는 결과물 중심으로 의뢰하세요.
                    </p>
                    <div className="home-hero-actions">
                        <Link to={ROUTES.CATEGORY} className="btn-primary">
                            AI 작업 맡기기
                        </Link>
                        <Link to={ROUTES.PROFILE} className="btn-text home-secondary-action">
                            AI 전문가로 시작하기
                        </Link>
                    </div>
                    <div className="popular-searches">
                        <span className="popular-label">추천 작업</span>
                        <div className="tag-group">
                            <Link to={ROUTES.CATEGORY} className="tag">#AI 숏폼</Link>
                            <Link to={ROUTES.CATEGORY} className="tag">#AI 이미지</Link>
                            <Link to={ROUTES.CATEGORY} className="tag">#업무 자동화</Link>
                        </div>
                    </div>
                </div>
                <div className="hero-image-container">
                    <img
                        src="https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80"
                        alt="AI 작업 협업"
                        className="hero-image"
                    />
                    <div className="floating-badge badge-1">
                        <div className="badge-icon" style={{ color: '#2563eb' }}>
                            <span className="material-symbols-outlined">view_timeline</span>
                        </div>
                        <div className="badge-text">
                            <strong>단계별</strong>
                            <span>작업 확인</span>
                        </div>
                    </div>
                    <div className="floating-badge badge-2">
                        <div className="badge-icon" style={{ color: '#10b981' }}>
                            <span className="material-symbols-outlined">payments</span>
                        </div>
                        <div className="badge-text">
                            <strong>패키지</strong>
                            <span>간편 의뢰</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="categories container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem' }}>
                    <div>
                        <h2 className="section-title">어떤 AI 작업이 필요하신가요?</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            초기에는 가장 의뢰하기 쉬운 3개 카테고리부터 시작합니다.
                        </p>
                    </div>
                    <Link to={ROUTES.CATEGORY} className="btn-text home-section-link">
                        전체보기 <span className="material-symbols-outlined">arrow_forward</span>
                    </Link>
                </div>
                <div className="category-grid home-category-grid">
                    {AI_CATEGORIES.map((category) => (
                        <Link to={ROUTES.CATEGORY} className="category-card" key={category.id}>
                            <div className="category-icon">{categoryIcons[category.id]}</div>
                            <h3 className="category-name">{category.name}</h3>
                            <p className="home-category-description">
                                {category.examples.join(', ')}
                            </p>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="recent-requests-section">
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem' }}>
                        <div>
                            <h2 className="section-title">바로 의뢰할 수 있는 AI 작업</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                샘플 결과물, 시작 가격, 사용 AI 도구를 보고 원하는 작업을 선택하세요.
                            </p>
                        </div>
                        <Link to={ROUTES.CATEGORY} className="btn-text home-section-link">
                            상품 더 보기 <span className="material-symbols-outlined">arrow_forward</span>
                        </Link>
                    </div>
                    <div className="request-mini-grid">
                        {mockExpertProducts.map((product) => (
                            <article className="request-mini-card home-product-card" key={product.id}>
                                <img
                                    src={product.sampleImageUrl}
                                    alt={`${product.title} 샘플`}
                                    className="home-product-image"
                                />
                                <div className="home-product-tools">
                                    {product.aiTools.join(' · ')}
                                </div>
                                <h3 className="home-product-title">
                                    {product.title}
                                </h3>
                                <p className="home-product-summary">
                                    {product.summary}
                                </p>
                                <div className="home-product-meta">
                                    <span>시작가 {product.startingPrice.toLocaleString()}원</span>
                                    <span>작업 {product.deliveryDays}일</span>
                                </div>
                                <div className="home-product-actions">
                                    <Link to={ROUTES.SERVICE_REQUEST} className="btn-primary home-product-primary">
                                        패키지로 의뢰하기
                                    </Link>
                                    <Link to={`/expert/${product.expertId}`} className="btn-text home-product-secondary">
                                        상세 보기
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="container">
                <div className="expert-header home-progress-panel">
                    <div className="home-progress-copy">
                        <h2 className="section-title">작업 진행표로 결과물을 확인하세요</h2>
                        <p className="section-subtitle" style={{ marginBottom: '2rem' }}>
                            작업이 어디까지 진행됐는지 단계별로 확인하세요.
                        </p>
                        <div className="tag-group">
                            <span className="tag">요구사항 작성</span>
                            <span className="tag">1차 결과물 확인</span>
                            <span className="tag">수정 요청 또는 승인</span>
                            <span className="tag">최종 완료</span>
                        </div>
                    </div>
                    <div className="home-progress-note">
                        <strong style={{ display: 'block', marginBottom: '0.75rem' }}>진행 방식</strong>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            간단한 작업은 단일 진행으로, 복잡한 작업은 단계별 진행으로 확인할 수 있습니다.
                        </p>
                    </div>
                </div>
            </section>

            <section className="featured-experts container">
                <h2 className="section-title">AI 도구를 다룰 줄 안다면 시작할 수 있습니다</h2>
                <p className="section-subtitle">
                    샘플 결과물 1개와 서비스 상품 1개만 등록하면 AI 전문가로 활동할 수 있습니다.
                </p>
                <Link to={ROUTES.PROFILE} className="btn-primary">
                    AI 전문가로 시작하기
                </Link>
            </section>
        </main>
    );
}
