import { useEffect, useState } from 'react'
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
    const [imageFailed, setImageFailed] = useState(false)
    const [avatarFailed, setAvatarFailed] = useState(false)
    const detailUrl = `/expert/${product.id}`
    const expertUrl = `/expert/${product.expertId}`
    const showSampleImage = Boolean(product.sampleImageUrl) && !imageFailed
    const expertImageUrl = product.expertImageUrl || ''
    const showExpertImage = expertImageUrl.length > 0 && !avatarFailed
    const openDetail = () => navigate(detailUrl)

    useEffect(() => {
        setImageFailed(false)
    }, [product.sampleImageUrl])

    useEffect(() => {
        setAvatarFailed(false)
    }, [product.expertImageUrl])

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
                <FavoriteProductButton
                    productId={product.id}
                    productTitle={product.title}
                    className="product-card-favorite"
                    variant="icon"
                />
            </div>

            <div className="product-card-body">
                <Link
                    className="product-card-expert-link"
                    to={expertUrl}
                    aria-label={`${product.expertName} 프로필 보기`}
                    onClick={(event) => event.stopPropagation()}
                >
                    {showExpertImage ? (
                        <img
                            className="product-card-avatar"
                            src={expertImageUrl}
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            onError={() => setAvatarFailed(true)}
                        />
                    ) : (
                        <span className="product-card-avatar" aria-hidden="true">{product.expertName.slice(0, 1)}</span>
                    )}
                    <strong>{product.expertName}</strong>
                </Link>

                <h3>{product.title}</h3>
                <p className="product-card-summary">{product.summary}</p>
                <div className="product-card-bottom">
                    <strong>{currency.format(product.startingPrice)}원부터</strong>
                </div>
            </div>
        </article>
    )
}
