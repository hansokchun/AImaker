import { Link, useNavigate } from 'react-router-dom'
import type { ExpertProduct } from '../types'
import FavoriteProductButton from './FavoriteProductButton'
import './ProductCard.css'

interface ProductCardProps {
    product: ExpertProduct
}

const currency = new Intl.NumberFormat('ko-KR')

export default function ProductCard({ product }: ProductCardProps) {
    const navigate = useNavigate()
    const detailUrl = `/expert/${product.id}`
    const expertUrl = `/expert/${product.expertId}`
    const openDetail = () => navigate(detailUrl)

    return (
        <article
            aria-label={`${product.title} 상세 보기`}
            className="product-card"
            role="link"
            tabIndex={0}
            onClick={openDetail}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openDetail()
                }
            }}
        >
            <FavoriteProductButton
                productId={product.id}
                productTitle={product.title}
                className="product-card-favorite"
            />
            <div className="product-card-image">
                {product.sampleImageUrl ? (
                    <img src={product.sampleImageUrl} alt={`${product.title} 샘플`} />
                ) : (
                    <div className="product-card-image-placeholder">이미지 준비 중</div>
                )}
            </div>

            <div className="product-card-body">
                <div className="product-card-tools">{product.aiTools.join(' · ')}</div>
                <h3>{product.title}</h3>
                <p className="product-card-summary">{product.summary}</p>

                <dl className="product-card-meta">
                    <div>
                        <dt>시작가</dt>
                        <dd>시작가 {currency.format(product.startingPrice)}원</dd>
                    </div>
                    <div>
                        <dt>작업 기간</dt>
                        <dd>{product.deliveryDays}일</dd>
                    </div>
                    <div>
                        <dt>수정</dt>
                        <dd>{product.revisionCount}회</dd>
                    </div>
                </dl>

                <div className="product-card-footer">
                    <Link
                        className="product-card-expert-link"
                        to={expertUrl}
                        aria-label={`${product.expertName} 프로필 보기`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <span>작업 등록 전문가</span>
                        <strong>{product.expertName}</strong>
                    </Link>
                </div>
            </div>
        </article>
    )
}
