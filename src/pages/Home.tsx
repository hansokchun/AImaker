import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../contexts/AuthContext';
import { mockExpertProducts } from '../data/mockData';
import { getExpertProducts } from '../lib/storage';
import type { ExpertProduct } from '../types';

const categoryCards = [
    {
        icon: 'video_settings',
        title: 'AI 영상/숏폼',
        description: '숏폼, 광고, 유튜브 콘텐츠 제작.',
    },
    {
        icon: 'palette',
        title: 'AI 이미지/캐릭터',
        description: '캐릭터, 프로필, 브랜드 이미지 제작.',
    },
    {
        icon: 'terminal',
        title: 'AI 개발/자동화',
        description: '챗봇, API 연동, 업무 자동화 구축.',
    },
];

const processSteps = [
    { icon: 'gallery_thumbnail', label: '샘플 확인' },
    { icon: 'edit_note', label: '요구사항 작성' },
    { icon: 'check_circle', label: '작업 진행 확인' },
];

function ProductThumbnail({ product }: { product: ExpertProduct }) {
    const [imageFailed, setImageFailed] = useState(false);
    const imageUrl = product.sampleImageUrl.trim();
    const showImage = imageUrl && !imageFailed;

    return (
        <div
            className="home-minimal-product-thumbnail"
            role="img"
            aria-label={`${product.title} 썸네일`}
        >
            <span className="home-minimal-thumbnail-label" aria-hidden="true">
                AIConnect
            </span>
            {showImage && (
                <img
                    src={imageUrl}
                    alt=""
                    aria-hidden="true"
                    data-testid={`home-product-image-${product.id}`}
                    className="home-minimal-product-image"
                    onError={() => setImageFailed(true)}
                />
            )}
        </div>
    );
}

export default function Home() {
    const { user } = useAuth();
    const [products, setProducts] = useState<ExpertProduct[]>(mockExpertProducts);
    const featuredProducts = products.slice(0, 4);

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
        <main className="home-page home-page-minimal">
            <section className="home-minimal-hero">
                <div className="container home-minimal-hero-inner">
                    <h1 className="home-minimal-title">
                        AI 작업을 더 쉽게 맡기세요
                    </h1>
                    <p className="home-minimal-subtitle">
                        샘플과 가격을 보고 바로 의뢰하세요.
                    </p>
                    <div className="home-minimal-actions">
                        <Link to={ROUTES.CATEGORY} className="home-minimal-primary">
                            AI 작업 찾기
                        </Link>
                        <Link to={ROUTES.CATEGORY} className="home-minimal-secondary">
                            상품 보기
                        </Link>
                        {user && (
                            <Link to={ROUTES.WORK_DASHBOARD} className="home-minimal-work">
                                내 작업 보기
                            </Link>
                        )}
                    </div>
                </div>
            </section>

            <section className="home-minimal-categories container" aria-label="AI 작업 카테고리">
                <div className="home-minimal-category-grid">
                    {categoryCards.map((category) => (
                        <article className="home-minimal-category-card" key={category.title}>
                            <div className="home-minimal-category-icon" aria-hidden="true">
                                <span className="material-symbols-outlined">{category.icon}</span>
                            </div>
                            <h2>{category.title}</h2>
                            <p>{category.description}</p>
                            <Link to={ROUTES.CATEGORY} className="home-minimal-category-link">
                                전문가 찾기
                                <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                            </Link>
                        </article>
                    ))}
                </div>
            </section>

            <section className="home-minimal-products">
                <div className="container">
                    <div className="home-minimal-products-header">
                        <div>
                            <span>추천</span>
                            <h2>추천 상품</h2>
                        </div>
                        <Link to={ROUTES.CATEGORY}>전체 상품 보기</Link>
                    </div>
                    <div className="home-minimal-product-grid">
                        {featuredProducts.map((product) => (
                            <article className="home-minimal-product" key={product.id}>
                                <Link to={`/expert/${product.id}`} className="home-minimal-product-image-link">
                                    <ProductThumbnail product={product} />
                                </Link>
                                <div className="home-minimal-product-body">
                                    <p className="home-minimal-product-label">{product.aiTools[0] || 'AI Service'}</p>
                                    <h3 className="home-product-title">{product.title}</h3>
                                    <div className="home-minimal-product-footer">
                                        <div>
                                            <span className="home-minimal-expert-name">{product.expertName}</span>
                                            <strong>{product.startingPrice.toLocaleString()}원~</strong>
                                        </div>
                                        <Link to={`/request/${product.id}`} className="home-minimal-order">
                                            의뢰하기
                                        </Link>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="home-minimal-process">
                <h2>진행 방식</h2>
                <div className="home-minimal-process-list">
                    {processSteps.map((step, index) => (
                        <div className="home-minimal-process-item" key={step.label}>
                            <div className="home-minimal-process-icon" aria-hidden="true">
                                <span className="material-symbols-outlined">{step.icon}</span>
                            </div>
                            <p>{step.label}</p>
                            {index < processSteps.length - 1 && <span className="home-minimal-process-line" aria-hidden="true" />}
                        </div>
                    ))}
                </div>
            </section>

            <section className="home-minimal-creator-cta container">
                <div>
                    <h2>전문가로 시작하기</h2>
                    <p>AI 도구 활용 능력을 상품으로 등록해보세요.</p>
                    <Link to={ROUTES.PRODUCT_NEW}>상품 등록하기</Link>
                </div>
            </section>
        </main>
    );
}
