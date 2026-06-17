import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../contexts/AuthContext';
import { mockExpertProducts } from '../data/mockData';
import { getExpertProducts } from '../lib/storage';
import type { ExpertProduct } from '../types';

const launchCategories = [
    {
        title: 'AI 영상/숏폼',
        description: '쇼츠, 광고 영상, 영상 콘셉트처럼 빠르게 확인할 수 있는 결과물을 맡겨보세요.',
        examples: ['쇼츠 시안', '영상 콘셉트', '광고 초안'],
        icon: 'movie',
    },
    {
        title: 'AI 이미지/캐릭터',
        description: '캐릭터, 프로필, 브랜드 이미지처럼 샘플로 비교하기 좋은 작업을 찾아보세요.',
        examples: ['캐릭터 3장', '프로필 이미지', '브랜드 시안'],
        icon: 'palette',
    },
    {
        title: 'AI 개발/자동화',
        description: '반복 업무를 줄이는 간단한 프로그램과 AI 코딩 작업을 작은 단위로 시작하세요.',
        examples: ['업무 자동화', '미니 도구', 'AI 코딩'],
        icon: 'terminal',
    },
];

function ProductThumbnail({ product }: { product: ExpertProduct }) {
    const [imageFailed, setImageFailed] = useState(false);
    const imageUrl = product.sampleImageUrl.trim();
    const showImage = imageUrl && !imageFailed;

    return (
        <div
            className="home-clean-product-thumbnail"
            role="img"
            aria-label={`${product.title} 썸네일`}
        >
            <span className="home-clean-thumbnail-label" aria-hidden="true">
                AIConnect
            </span>
            {showImage && (
                <img
                    src={imageUrl}
                    alt=""
                    aria-hidden="true"
                    data-testid={`home-product-image-${product.id}`}
                    className="home-clean-product-image"
                    onError={() => setImageFailed(true)}
                />
            )}
        </div>
    );
}

export default function Home() {
    const { user } = useAuth();
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
        <main className="home-page home-clean-page">
            <section className="home-clean-hero">
                <div className="container home-clean-hero-inner">
                    <p className="home-clean-kicker">AI 특화 외주 마켓</p>
                    <h1>AI 영상, 이미지, 자동화 작업을 더 저렴하게 맡기세요</h1>
                    <p className="home-clean-subtitle">
                        샘플과 가격을 보고 AI 작업자를 찾아 의뢰할 수 있어요.
                    </p>
                    <div className="home-clean-actions">
                        <Link to={ROUTES.CATEGORY} className="home-clean-primary">
                            AI 전문가 찾기
                        </Link>
                        <Link to={ROUTES.CATEGORY} className="home-clean-secondary">
                            상품 둘러보기
                        </Link>
                        {user && (
                            <Link to={ROUTES.WORK_DASHBOARD} className="home-clean-work">
                                내 작업 보기
                            </Link>
                        )}
                    </div>
                </div>
            </section>

            <section className="home-clean-section container">
                <div className="home-clean-section-heading">
                    <h2 className="section-title">어떤 AI 작업이 필요하세요?</h2>
                    <p>처음에는 가장 많이 찾을 세 분야만 크게 보여줍니다.</p>
                </div>
                <div className="home-clean-category-grid">
                    {launchCategories.map((category) => (
                        <article className="home-clean-category-card" key={category.title}>
                            <span className="material-symbols-outlined" aria-hidden="true">
                                {category.icon}
                            </span>
                            <h3>{category.title}</h3>
                            <p>{category.description}</p>
                            <div className="home-clean-tags">
                                {category.examples.map((example) => (
                                    <small key={example}>{example}</small>
                                ))}
                            </div>
                            <Link to={ROUTES.CATEGORY}>전문가 찾기</Link>
                        </article>
                    ))}
                </div>
            </section>

            <section className="home-clean-section home-clean-products">
                <div className="container">
                    <div className="home-clean-section-heading">
                        <h2 className="section-title">입문형 AI 상품</h2>
                        <p>비싼 외주보다 작은 결과물부터 맡겨보고, 샘플과 시작가로 빠르게 비교하세요.</p>
                    </div>
                    <div className="home-clean-product-grid">
                        {products.slice(0, 3).map((product) => (
                            <article className="home-clean-product" key={product.id}>
                                <Link to={`/expert/${product.id}`} className="home-clean-product-image-link">
                                    <ProductThumbnail product={product} />
                                </Link>
                                <div className="home-clean-product-body">
                                    <div className="home-clean-product-tools">
                                        {product.aiTools.slice(0, 3).join(' · ')}
                                    </div>
                                    <h3 className="home-product-title">{product.title}</h3>
                                    <p className="home-product-summary">{product.summary}</p>
                                    <div className="home-clean-product-meta">
                                        <span>{product.expertName}</span>
                                        <strong>{product.startingPrice.toLocaleString()}원부터</strong>
                                    </div>
                                    <div className="home-clean-product-actions">
                                        <Link to={`/expert/${product.id}`} className="home-clean-detail">
                                            전문가 보기
                                        </Link>
                                        <Link to={`/request/${product.id}`} className="home-clean-order">
                                            의뢰하기
                                        </Link>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="home-clean-trust" aria-label="AIConnect 의뢰 흐름">
                <div className="container home-clean-trust-inner">
                    <span className="material-symbols-outlined" aria-hidden="true">
                        verified
                    </span>
                    <p>샘플 확인 · 요구사항 작성 · 작업방에서 진행 확인</p>
                </div>
            </section>

            <section className="home-clean-maker">
                <div className="container home-clean-maker-inner">
                    <div>
                        <p className="home-clean-kicker">작업자 모집</p>
                        <h2>AI 도구를 다룰 줄 안다면 작업자로 시작하세요</h2>
                        <p>샘플 결과물 1개와 서비스 상품 1개만 준비해 첫 의뢰를 받을 수 있습니다.</p>
                    </div>
                    <Link to={ROUTES.PROFILE} className="home-clean-primary">
                        첫 상품 등록하기
                    </Link>
                </div>
            </section>
        </main>
    );
}
