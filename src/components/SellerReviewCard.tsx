import type { Review } from '../types'

interface SellerReviewCardProps {
    readonly review: Review
    readonly productTitle?: string
    readonly fallbackPrice?: number
    readonly fallbackDeliveryDays?: number
}

const currency = new Intl.NumberFormat('ko-KR')

const getClientName = (review: Review) => {
    const trimmedName = review.clientName?.trim()
    return trimmedName || 'AI 의뢰자'
}

const formatRelativeDate = (createdAt: string) => {
    const parsed = new Date(createdAt)
    if (Number.isNaN(parsed.getTime())) return '최근 작성'

    const elapsedDays = Math.floor((Date.now() - parsed.getTime()) / 86_400_000)
    if (elapsedDays <= 0) return '오늘'
    if (elapsedDays < 30) return `${elapsedDays}일 전`

    const elapsedMonths = Math.floor(elapsedDays / 30)
    if (elapsedMonths < 12) return `${elapsedMonths}개월 전`

    return `${Math.floor(elapsedMonths / 12)}년 전`
}

const formatPriceRange = (price?: number) => {
    if (!price || price <= 0) return '상담 후 확정'
    if (price < 10_000) return `${currency.format(price)}원대`

    return `${currency.format(Math.floor(price / 10_000))}만 원대`
}

export default function SellerReviewCard({
    review,
    productTitle,
    fallbackPrice,
    fallbackDeliveryDays,
}: SellerReviewCardProps) {
    const clientName = getClientName(review)
    const createdAtLabel = review.createdAtLabel || formatRelativeDate(review.createdAt)
    const priceRangeLabel = review.priceRangeLabel || formatPriceRange(fallbackPrice)
    const workDurationDays = review.workDurationDays ?? fallbackDeliveryDays
    const workDurationLabel = workDurationDays ? `${workDurationDays}일` : '상담 후 확정'
    const ratingLabel = `별점 ${review.rating.toFixed(1)}`

    return (
        <article className="seller-review-card" aria-label={`${clientName} 의뢰자의 리뷰`}>
            <div className="seller-review-header">
                {review.clientImageUrl ? (
                    <img className="seller-review-avatar" src={review.clientImageUrl} alt={`${clientName} 프로필`} />
                ) : (
                    <div className="seller-review-avatar" aria-hidden="true">
                        {clientName.slice(0, 1)}
                    </div>
                )}
                <div className="seller-review-heading">
                    <strong>{clientName}</strong>
                    <div className="seller-review-rating-row">
                        <span className="material-symbols-outlined seller-review-stars" aria-hidden="true">
                            star
                        </span>
                        <span>{ratingLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{createdAtLabel}</span>
                    </div>
                </div>
            </div>
            {productTitle && <p className="seller-review-service">이용 상품: {productTitle}</p>}
            <p className="seller-review-body">{review.content}</p>
            <div className="seller-review-meta" aria-label="리뷰 거래 정보">
                <span>가격대 {priceRangeLabel}</span>
                <span>작업 기간 {workDurationLabel}</span>
            </div>
        </article>
    )
}
