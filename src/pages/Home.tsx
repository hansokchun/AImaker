import { useEffect, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../contexts/AuthContext';
import { mockExpertProducts } from '../data/mockData';
import { getExpertProducts } from '../lib/storage';
import type { ExpertProduct } from '../types';

const categoryCards = [
    {
        id: 'ai-video-shortform',
        title: 'AI 영상',
        imageClassName: 'home-minimal-category-card--video',
    },
    {
        id: 'ai-image-character',
        title: 'AI 이미지',
        imageClassName: 'home-minimal-category-card--image',
    },
    {
        id: 'ai-development-automation',
        title: 'AI 개발',
        imageClassName: 'home-minimal-category-card--development',
    },
];

const processSteps = [
    { icon: 'gallery_thumbnail', label: '샘플 확인' },
    { icon: 'edit_note', label: '요구사항 작성' },
    { icon: 'description', label: '제안서 확인' },
    { icon: 'check_circle', label: '작업 진행 확인' },
    { icon: 'download_done', label: '작업물 수령' },
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
    const navigate = useNavigate();
    const [products, setProducts] = useState<ExpertProduct[]>(mockExpertProducts);
    const [searchKeyword, setSearchKeyword] = useState('');
    const featuredProducts = products.slice(0, 4);

    const openProductDetail = (productId: string) => {
        navigate(`/expert/${productId}`);
    };

    const openProductDetailWithKeyboard = (event: KeyboardEvent<HTMLElement>, productId: string) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openProductDetail(productId);
        }
    };

    const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const keyword = searchKeyword.trim();
        navigate(keyword ? `${ROUTES.CATEGORY}?q=${encodeURIComponent(keyword)}` : ROUTES.CATEGORY);
    };

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
                        AI로 더 싸고 빠르게,
                        <br />
                        필요한 작업을 의뢰하세요
                    </h1>
                    <form className="home-minimal-search" onSubmit={handleSearchSubmit}>
                        <label htmlFor="home-product-search">상품 검색</label>
                        <div className="home-minimal-search-box">
                            <span className="material-symbols-outlined" aria-hidden="true">search</span>
                            <input
                                id="home-product-search"
                                type="search"
                                value={searchKeyword}
                                onChange={(event) => setSearchKeyword(event.target.value)}
                                placeholder="어떤 AI 작업이 필요하신가요?"
                            />
                            <button type="submit">검색</button>
                        </div>
                    </form>
                    <div className="home-minimal-actions">
                        <Link to={ROUTES.CATEGORY} className="home-minimal-primary">
                            AI 전문가 찾기
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
                        <Link
                            to={`${ROUTES.CATEGORY}?category=${category.id}`}
                            className={`home-minimal-category-card ${category.imageClassName}`}
                            key={category.title}
                        >
                            <h2>{category.title}</h2>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="home-minimal-products">
                <div className="container">
                    <div className="home-minimal-products-header">
                        <div>
                            <h2>AI 상품</h2>
                        </div>
                        <Link to={ROUTES.CATEGORY}>전체 상품 보기</Link>
                    </div>
                    <div className="home-minimal-product-grid">
                        {featuredProducts.map((product) => (
                            <article
                                className="home-minimal-product"
                                key={product.id}
                                role="link"
                                tabIndex={0}
                                aria-label={`${product.title} 상품 정보 보기`}
                                onClick={() => openProductDetail(product.id)}
                                onKeyDown={(event) => openProductDetailWithKeyboard(event, product.id)}
                            >
                                <Link
                                    to={`/expert/${product.id}`}
                                    className="home-minimal-product-image-link"
                                    onClick={(event) => event.stopPropagation()}
                                >
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
                                        <Link
                                            to={`/request/${product.id}`}
                                            className="home-minimal-order"
                                            onClick={(event) => event.stopPropagation()}
                                        >
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
                <div className="home-minimal-creator-panel">
                    <h2>AI를 쓸 줄 안다면? 작업자로 활동해보세요!</h2>
                    <p>당신의 능력을 필요로 합니다!</p>
                    <Link to={ROUTES.PRODUCT_NEW}>첫 상품 등록하기</Link>
                </div>
            </section>
        </main>
    );
}
