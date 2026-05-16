import { Link } from 'react-router-dom'
import type { ExpertProduct } from '../types'
import './ProductCard.css'

interface ProductCardProps {
    product: ExpertProduct
}

const currency = new Intl.NumberFormat('ko-KR')

export default function ProductCard({ product }: ProductCardProps) {
    const detailUrl = `/expert/${product.id}`
    const requestUrl = `/request/${product.id}`

    return (
        <article className="product-card">
            <div className="product-card-image">
                <img src={product.sampleImageUrl} alt={`${product.title} 샘플`} />
            </div>

            <div className="product-card-body">
                <div className="product-card-tools">{product.aiTools.join(' · ')}</div>
                <h3>
                    <Link className="product-card-title-link" to={detailUrl}>
                        {product.title}
                    </Link>
                </h3>
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
                    <span>{product.expertName}</span>
                    <Link className="btn-primary product-card-cta" to={requestUrl}>
                        패키지로 의뢰하기
                    </Link>
                </div>
            </div>
        </article>
    )
}
