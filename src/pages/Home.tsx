import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';
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
                    <h1 className="home-minimal-title">AI 작업, 더 간단하게.</h1>
                    <p className="home-minimal-subtitle">원하는 상품을 고르고 바로 주문하세요.</p>
                    <div className="home-minimal-actions">
                        <Link to={ROUTES.CATEGORY} className="home-minimal-primary">
                            상품 둘러보기
                        </Link>
                        <Link to={ROUTES.PROFILE} className="home-minimal-secondary">
                            전문가로 시작하기
                        </Link>
                    </div>
                </div>
            </section>

            <section className="home-minimal-products container">
                <div className="home-minimal-section-title">
                    <h2 className="section-title">추천 AI 상품</h2>
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
