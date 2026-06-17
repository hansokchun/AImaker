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
        description: '전문적인 영상 편집과 숏폼 제작을 AI로 빠르게. 유튜브, 광고, SNS 콘텐츠를 더 효율적으로 생산하세요.',
    },
    {
        icon: 'palette',
        title: 'AI 이미지/캐릭터',
        description: '캐릭터 디자인부터 실사 이미지까지. Midjourney와 Stable Diffusion을 활용한 고퀄리티 아트워크를 만나보세요.',
    },
    {
        icon: 'terminal',
        title: 'AI 개발/자동화',
        description: '업무 효율을 높이는 AI 자동화 솔루션. 챗봇, API 연동, 데이터 분석 등 맞춤형 AI 툴을 구축해드립니다.',
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
                        AI 영상, 이미지, 자동화 작업을
                        <br />
                        더 저렴하게 맡기세요
                    </h1>
                    <p className="home-minimal-subtitle">
                        샘플과 가격을 보고 AI 작업자를 찾아 의뢰할 수 있어요. 전문가의 손길로 AI의 잠재력을 비즈니스에 연결하세요.
                    </p>
                    <div className="home-minimal-actions">
                        <Link to={ROUTES.CATEGORY} className="home-minimal-primary">
                            AI 전문가 찾기
                        </Link>
                        <Link to={ROUTES.CATEGORY} className="home-minimal-secondary">
                            상품 둘러보기
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
                            <span>Curated</span>
                            <h2>입문형 AI 상품</h2>
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
                <h2>How it Works</h2>
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
                    <h2>AI 도구를 다룰 줄 안다면 작업자로 시작하세요</h2>
                    <p>수천 명의 의뢰인이 당신의 기술을 기다리고 있습니다. 전문성을 수익으로 바꾸는 가장 빠른 방법.</p>
                    <Link to={ROUTES.PRODUCT_NEW}>첫 상품 등록하기</Link>
                </div>
            </section>
        </main>
    );
}
