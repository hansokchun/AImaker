import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AiCategoryId, ExpertProduct } from '../types'
import FavoriteProductButton from './FavoriteProductButton'
import './ProductCard.css'

interface ProductCardProps {
    product: ExpertProduct
}

const currency = new Intl.NumberFormat('ko-KR')

const categoryLabels: Record<AiCategoryId, string> = {
    'ai-video-shortform': 'AI 영상/숏폼',
    'ai-image-character': 'AI 이미지',
    'ai-development-automation': 'AI 개발/자동화',
}

export default function ProductCard({ product }: ProductCardProps) {
    const navigate = useNavigate()
    const [imageFailed, setImageFailed] = useState(false)
    const detailUrl = `/expert/${product.id}`
    const expertUrl = `/expert/${product.expertId}`
    const showSampleImage = Boolean(product.sampleImageUrl) && !imageFailed
    const openDetail = () => navigate(detailUrl)

    useEffect(() => {
        setImageFailed(false)
    }, [product.sampleImageUrl])

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
                {showSampleImage ? (
                    <img
                        src={product.sampleImageUrl}
                        alt={`${product.title} 샘플`}
                        onError={() => setImageFailed(true)}
                    />
                ) : (
                    <div className="product-card-image-placeholder">이미지 준비 중</div>
                )}
            </div>

            <div className="product-card-body">
                <div className="product-card-topline">
                    <span className="product-card-category">{categoryLabels[product.category] || 'AI 작업'}</span>
                    <span className="product-card-rating">
                        <span className="material-symbols-outlined" aria-hidden="true">star</span>
                        평점 신규
                    </span>
                </div>

                <h3>{product.title}</h3>
                <p className="product-card-summary">{product.summary}</p>

                <div className="product-card-footer">
                    <Link
                        className="product-card-expert-link"
                        to={expertUrl}
                        aria-label={`${product.expertName} 프로필 보기`}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <span className="product-card-avatar" aria-hidden="true">{product.expertName.slice(0, 1)}</span>
                        <strong>{product.expertName}</strong>
                    </Link>

                    <div className="product-card-tags" aria-label="상품 조건">
                        <span>{product.deliveryDays}일 납기</span>
                        <span>수정 {product.revisionCount}회</span>
                        {product.taxInvoiceAvailable && <span>세금계산서 가능</span>}
                    </div>
                </div>

                <div className="product-card-bottom">
                    <span className="product-card-tools">{product.aiTools.slice(0, 3).join(' · ')}</span>
                    <strong>시작가 {currency.format(product.startingPrice)}원</strong>
                </div>
            </div>
        </article>
    )
}
