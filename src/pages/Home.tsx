import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AI_CATEGORIES } from '../constants/categories';
import { ROUTES } from '../constants/routes';
import { mockExpertProducts } from '../data/mockData';
import { getExpertProducts } from '../lib/storage';
import type { ExpertProduct } from '../types';

const categoryIcons: Record<string, string> = {
    'ai-video-shortform': 'movie',
    'ai-image-character': 'palette',
    'ai-development-automation': 'smart_toy',
};

const heroSteps = ['상품 탐색', '요구사항 작성', '제안서 확인'];

export default function Home() {
    const [products, setProducts] = useState<ExpertProduct[]>(mockExpertProducts);

    useEffect(() => {
        let active = true;
        getExpertProducts()
            .then((items) => {
                if (active) setProducts(items.length ? items : mockExpertProducts);
            })
            .catch(() => {
                if (active) setProducts(mockExpertProducts);
            });
        return () => {
            active = false;
        };
    }, []);

    return (
        <main className="home-page">
            <section className="home-hero">
                <div className="home-hero-inner container">
                    <p className="home-hero-kicker">AI 외주를 상품 단위로</p>
                    <h1 className="home-hero-title">AI 작업을 고르고 바로 주문하세요</h1>
                    <p className="home-hero-subtitle">
                        전문가가 올린 상품의 샘플, 가격, 작업일을 확인하고 요구사항을 보내세요.
                        제안서 확인과 결제 이후에는 작업방에서 진행 과정을 관리합니다.
                    </p>
                    <div className="home-hero-actions">
                        <Link to={ROUTES.CATEGORY} className="btn-primary">
                            AI 작업 둘러보기
                        </Link>
                        <Link to={ROUTES.PROFILE} className="home-hero-secondary">
                            전문가 상품 등록
                        </Link>
                    </div>
                    <ol className="home-hero-steps" aria-label="주문 흐름">
                        {heroSteps.map((step, index) => (
                            <li className="home-hero-step" key={step}>
                                <span>{index + 1}</span>
                                {step}
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <section className="home-section container">
                <div className="home-section-heading">
                    <p className="home-section-eyebrow">카테고리</p>
                    <h2 className="section-title">필요한 작업을 빠르게 좁혀보세요</h2>
                    <p className="home-section-copy">
                        영상, 이미지, 개발 자동화처럼 자주 의뢰되는 AI 작업부터 살펴볼 수 있습니다.
                    </p>
                </div>
                <div className="category-grid home-category-grid">
                    {AI_CATEGORIES.map((category) => (
                        <Link to={ROUTES.CATEGORY} className="category-card home-category-card" key={category.id}>
                            <span className="material-symbols-outlined home-category-icon">
                                {categoryIcons[category.id]}
                            </span>
                            <h3 className="category-name">{category.name}</h3>
                            <p className="home-category-description">{category.examples.join(', ')}</p>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="home-section home-products-band">
                <div className="container">
                    <div className="home-section-heading">
                        <p className="home-section-eyebrow">상품</p>
                        <h2 className="section-title">바로 주문 가능한 AI 상품</h2>
                        <p className="home-section-copy">
                            가격과 작업일이 정리된 상품을 선택하면 요구사항 작성으로 이어집니다.
                        </p>
                    </div>
                    <div className="request-mini-grid">
                        {products.slice(0, 3).map((product) => (
                            <article className="request-mini-card home-product-card" key={product.id}>
                                <img
                                    src={product.sampleImageUrl}
                                    alt={`${product.title} 샘플`}
                                    className="home-product-image"
                                />
                                <div className="home-product-tools">{product.aiTools.join(' · ')}</div>
                                <h3 className="home-product-title">{product.title}</h3>
                                <p className="home-product-summary">{product.summary}</p>
                                <div className="home-product-meta">
                                    <span>{product.startingPrice.toLocaleString()}원부터</span>
                                    <span>{product.deliveryDays}일</span>
                                </div>
                                <div className="home-product-actions">
                                    <Link to={`/request/${product.id}`} className="btn-primary home-product-primary">
                                        주문 시작
                                    </Link>
                                    <Link to={`/expert/${product.id}`} className="btn-text home-product-secondary">
                                        상품 자세히 보기
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="home-section container">
                <div className="home-progress-band">
                    <div>
                        <p className="home-section-eyebrow">진행 관리</p>
                        <h2 className="section-title">주문 후에도 단계가 보입니다</h2>
                        <p className="home-section-copy">
                            의뢰서, 제안서 승인과 결제, 작업방, 완료 확인을 한 흐름으로 이어서 확인합니다.
                        </p>
                    </div>
                    <div className="home-progress-steps" aria-label="작업 진행 단계">
                        {['의뢰서 작성', '제안서 승인 및 결제', '작업방 진행', '완료 확인'].map((step) => (
                            <div className="home-progress-step" key={step}>
                                <span className="material-symbols-outlined">check_circle</span>
                                {step}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="featured-experts container home-expert-cta">
                <h2 className="section-title">AI 상품을 등록하고 전문가로 시작하세요</h2>
                <p className="section-subtitle">
                    샘플 결과물과 패키지 가격을 정리하면 의뢰자가 상품을 보고 바로 주문할 수 있습니다.
                </p>
                <Link to={ROUTES.PROFILE} className="btn-primary">
                    전문가로 시작하기
                </Link>
            </section>
        </main>
    );
}
