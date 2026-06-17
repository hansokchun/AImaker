import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
import { useAuth } from '../contexts/AuthContext';
import { mockExpertProducts } from '../data/mockData';
import { getExpertProducts } from '../lib/storage';
import type { ExpertProduct } from '../types';

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
                    <p className="home-minimal-kicker">AIConnect Marketplace</p>
                    <h1 className="home-minimal-title">검증된 AI 전문가를 고르는 가장 조용한 방법</h1>
                    <p className="home-minimal-subtitle">영상, 이미지, 자동화 작업을 상품 단위로 비교하고 바로 시작하세요.</p>
                    <div className="home-minimal-actions">
                        <Link to={ROUTES.CATEGORY} className="home-minimal-primary">
                            AI 작업 찾기
                        </Link>
                        <Link to={ROUTES.PROFILE} className="home-minimal-secondary">
                            전문가로 시작하기
                        </Link>
                        {user && (
                            <Link to={ROUTES.WORK_DASHBOARD} className="home-minimal-work">
                                내 작업 보기
                            </Link>
                        )}
                    </div>
                    <div className="home-minimal-proof" aria-label="AIConnect 핵심 특징">
                        <span>검증된 상품</span>
                        <span>상품 기반 의뢰</span>
                        <span>안전한 작업 관리</span>
                    </div>
                </div>
            </section>

            <section className="home-minimal-products container">
                <div className="home-minimal-section-title">
                    <p className="home-minimal-section-eyebrow">Featured work</p>
                    <h2 className="section-title">최근 등록된 AI 상품</h2>
                    <p className="home-minimal-section-copy">Stitch 미니멀 디자인에 맞춰 상품 정보만 선명하게 보여줍니다.</p>
                </div>
                <div className="home-minimal-product-grid">
                    {products.slice(0, 3).map((product) => (
                        <article className="home-minimal-product" key={product.id}>
                            <Link to={`/expert/${product.id}`} className="home-minimal-product-image-link">
                                <ProductThumbnail product={product} />
                            </Link>
                            <div className="home-minimal-product-body">
                                <h3 className="home-product-title">{product.title}</h3>
                                <p className="home-product-summary">{product.summary}</p>
                                <p className="home-minimal-price">
                                    {product.startingPrice.toLocaleString()}원부터
                                </p>
                                <div className="home-minimal-product-actions">
                                    <Link to={`/request/${product.id}`} className="home-minimal-order">
                                        주문 시작
                                    </Link>
                                    <Link to={`/expert/${product.id}`} className="home-minimal-detail">
                                        자세히 보기
                                    </Link>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </main>
    );
}
