import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import FavoriteProductButton from '../components/FavoriteProductButton'
import PackageCard from '../components/PackageCard'
import { AI_CATEGORIES } from '../constants/categories'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { createConsultation, getExpertProducts, getExpertReviews, getUserDisplayProfile } from '../lib/storage'
import type { ExpertProduct, ProductPackage, Review } from '../types'
import './ExpertDetail.css'

type SellerProfile = {
    name: string
    imageUrl: string
    isExpert: boolean
}

const getAverageRating = (reviews: Review[]) => {
    if (reviews.length === 0) return 0
    return reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
}

export default function ExpertDetail() {
    const { id } = useParams<{ id: string }>()
    const location = useLocation()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [creatingConsultation, setCreatingConsultation] = useState(false)
    const [product, setProduct] = useState<ExpertProduct | null>(null)
    const [sellerProducts, setSellerProducts] = useState<ExpertProduct[]>([])
    const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null)
    const [expertReviews, setExpertReviews] = useState<Review[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let active = true
        setLoading(true)

        getExpertProducts().then(async (products) => {
            if (!active) return

            const foundProduct = products.find((item) => item.id === id) ?? null
            const sellerId = foundProduct?.expertId || id || ''
            const productsBySeller = products.filter((item) => item.expertId === sellerId)

            setProduct(foundProduct)
            setSellerProducts(productsBySeller)

            if (foundProduct || productsBySeller.length > 0) {
                const [profile, reviews] = await Promise.all([
                    getUserDisplayProfile(sellerId),
                    getExpertReviews(sellerId),
                ])
                if (!active) return
                setSellerProfile(profile)
                setExpertReviews(reviews)
            } else {
                setSellerProfile(null)
                setExpertReviews([])
            }

            setLoading(false)
        })

        return () => {
            active = false
        }
    }, [id])

    const category = AI_CATEGORIES.find((item) => item.id === product?.category)
    const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
    const myPageReturnTo = from?.pathname === ROUTES.MY_PAGE ? `${from.pathname}${from.search || ''}` : ''
    const isSellerProfile = !product && sellerProducts.length > 0
    const sellerName = sellerProfile?.name || product?.expertName || sellerProducts[0]?.expertName || 'AI 전문가'
    const sellerImageUrl = sellerProfile?.imageUrl || ''
    const averageRating = getAverageRating(expertReviews)
    const reviewSummary = expertReviews.length > 0
        ? `평점 ${averageRating.toFixed(1)} · 리뷰 ${expertReviews.length}개`
        : '아직 받은 리뷰가 없습니다'

    const handleStartConsultation = async () => {
        if (!product) return
        if (!user) {
            navigate(ROUTES.LOGIN, { state: { from: { pathname: location.pathname, search: location.search } } })
            return
        }

        setCreatingConsultation(true)
        try {
            const consultation = await createConsultation({
                clientId: user.id,
                expertId: product.expertId,
                productId: product.id,
                title: `${product.title} 상담`,
                initialMessage: `${product.title} 작업 범위를 상담하고 싶습니다.`,
            })
            navigate(`${ROUTES.WORK_DASHBOARD}?panel=consultations&consultation=${consultation.id}`)
        } catch (error) {
            console.error('상담 시작 실패:', error)
            window.alert('상담을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.')
        } finally {
            setCreatingConsultation(false)
        }
    }

    if (loading) {
        return (
            <main className="container detail-empty-state">
                <h2>상품 정보를 불러오는 중입니다</h2>
            </main>
        )
    }

    if (!product && !isSellerProfile) {
        return (
            <main className="container detail-empty-state">
                <span className="material-symbols-outlined">inventory_2</span>
                <h2>상품을 찾을 수 없습니다</h2>
                <p>존재하지 않거나 더 이상 공개되지 않은 AI 작업입니다.</p>
                <Link to={myPageReturnTo || ROUTES.CATEGORY} className="btn-primary">
                    {myPageReturnTo ? '마이페이지로 돌아가기' : 'AI 작업 찾기로 돌아가기'}
                </Link>
            </main>
        )
    }

    if (isSellerProfile) {
        return (
            <main className="container seller-profile-page">
                <section className="seller-profile-hero">
                    {sellerImageUrl ? (
                        <img src={sellerImageUrl} alt={`${sellerName} 프로필`} />
                    ) : (
                        <div className="seller-profile-avatar-fallback" aria-hidden="true">
                            {sellerName.slice(0, 1)}
                        </div>
                    )}
                    <div>
                        <div className="product-detail-category">판매자 프로필</div>
                        <h1>{sellerName}</h1>
                        <p>{sellerProfile?.isExpert ? 'AIConnect 전문가' : '상품 등록 전문가'}</p>
                        <strong>{reviewSummary}</strong>
                    </div>
                </section>

                <section className="detail-section">
                    <h2>등록한 상품</h2>
                    <div className="seller-product-list">
                        {sellerProducts.map((sellerProduct) => (
                            <Link
                                key={sellerProduct.id}
                                to={`/expert/${sellerProduct.id}`}
                                className="seller-product-card"
                                aria-label={sellerProduct.title}
                            >
                                {sellerProduct.sampleImageUrl && (
                                    <img src={sellerProduct.sampleImageUrl} alt={`${sellerProduct.title} 대표 이미지`} />
                                )}
                                <div>
                                    <strong>{sellerProduct.title}</strong>
                                    <span>{sellerProduct.summary}</span>
                                    <small>{sellerProduct.startingPrice.toLocaleString()}원부터 · {sellerProduct.deliveryDays}일</small>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="detail-section">
                    <h2>받은 리뷰</h2>
                    {expertReviews.length > 0 ? (
                        <div className="seller-review-list">
                            {expertReviews.map((review) => (
                                <article key={review.id} className="seller-review-card">
                                    <strong>평점 {review.rating}.0</strong>
                                    <p>{review.content}</p>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <p className="seller-empty-copy">아직 받은 리뷰가 없습니다.</p>
                    )}
                </section>
            </main>
        )
    }

    if (!product) return null

    const aiTools = Array.isArray(product.aiTools) ? product.aiTools : []
    const sampleLinks = Array.isArray(product.sampleLinks) ? product.sampleLinks : []
    const fallbackPackage: ProductPackage = {
        name: 'Standard',
        price: Number(product.startingPrice) || 0,
        deliveryDays: Number(product.deliveryDays) || 1,
        revisionCount: Number(product.revisionCount) || 1,
        included: [product.summary || product.title],
    }
    const packages = product.packages?.standard
        ? product.packages
        : { standard: fallbackPackage, deluxe: null, premium: null }
    const sampleImageUrl = product.sampleImageUrl || sampleLinks[0] || ''
    const detailGalleryImages = [
        ...(product.sampleImageUrl ? [{ src: product.sampleImageUrl, alt: `${product.title} 메인 이미지`, label: '메인 이미지' }] : []),
        ...sampleLinks.map((src, index) => ({
            src,
            alt: `${product.title} 상세 이미지 ${index + 1}`,
            label: `상세 이미지 ${index + 1}`,
        })),
    ]

    return (
        <main className="container">
            {myPageReturnTo && (
                <div className="detail-owner-actions">
                    <Link to={myPageReturnTo} className="btn-text">
                        마이페이지로 돌아가기
                    </Link>
                </div>
            )}
            {user?.id === product.expertId && (
                <div className="detail-owner-actions">
                    <Link to={`/products/${product.id}/edit`} className="btn-primary">
                        <span className="material-symbols-outlined" aria-hidden="true">edit</span>
                        상품 수정하기
                    </Link>
                </div>
            )}

            <div className="detail-layout">
                <div className="content-left">
                    <section className="product-detail-hero">
                        <div className="product-detail-image">
                            {sampleImageUrl ? (
                                <img src={sampleImageUrl} alt={`${product.title} 샘플 결과물`} />
                            ) : (
                                <div className="product-detail-image-empty">대표 이미지 준비 중</div>
                            )}
                        </div>
                        <div className="product-detail-copy">
                            <div className="product-detail-category">{category?.name ?? 'AI 작업'}</div>
                            {user?.id !== product.expertId && (
                                <FavoriteProductButton
                                    productId={product.id}
                                    productTitle={product.title}
                                    className="product-detail-favorite"
                                />
                            )}
                            <h1>{product.title}</h1>
                            <p>{product.summary}</p>
                            <div className="product-detail-meta">
                                <span>시작가 {product.startingPrice.toLocaleString()}원</span>
                                <span>작업 {product.deliveryDays}일</span>
                                <span>수정 {product.revisionCount}회</span>
                            </div>
                        </div>
                    </section>

                    <section className="detail-section seller-info-section">
                        <h2>
                            <span className="material-symbols-outlined" aria-hidden="true">storefront</span>
                            판매자 정보
                        </h2>
                        <div className="seller-info-card">
                            {sellerImageUrl ? (
                                <img src={sellerImageUrl} alt={`${sellerName} 프로필`} />
                            ) : (
                                <div className="seller-avatar-fallback" aria-hidden="true">
                                    {sellerName.slice(0, 1)}
                                </div>
                            )}
                            <div>
                                <strong>{sellerName}</strong>
                                <p>{sellerProfile?.isExpert ? 'AIConnect 전문가' : '상품 등록 전문가'}</p>
                                <p>{reviewSummary}</p>
                                <Link to={`/expert/${product.expertId}`}>판매자 프로필 보기</Link>
                            </div>
                        </div>
                    </section>

                    <section className="detail-section">
                        <h2>
                            <span className="material-symbols-outlined">description</span>
                            상품 설명
                        </h2>
                        <div className="section-content">
                            <p>{product.description}</p>
                        </div>
                    </section>

                    {detailGalleryImages.length > 0 && (
                        <section className="detail-section portfolio-section">
                            <h2>
                                <span className="material-symbols-outlined" aria-hidden="true">image</span>
                                상세 이미지
                            </h2>
                            <div className="section-content sample-result-panel" data-testid="product-detail-gallery">
                                {detailGalleryImages.map((image) => (
                                    <figure key={`${image.label}-${image.src}`} className="detail-gallery-item">
                                        <img src={image.src} alt={image.alt} />
                                    </figure>
                                ))}
                            </div>
                        </section>
                    )}

                    {aiTools.length > 0 && (
                        <section className="detail-section">
                            <h2>
                                <span className="material-symbols-outlined">construction</span>
                                사용 AI 도구
                            </h2>
                            <div className="section-content tool-chip-list">
                                {aiTools.map((tool) => (
                                    <span key={tool} className="tool-chip">
                                        {tool}
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                <div className="content-right">
                    <PackageCard
                        packages={packages}
                        productId={product.id}
                        onOpenChat={handleStartConsultation}
                        chatButtonDisabled={creatingConsultation}
                        isOwner={user?.id === product.expertId}
                        requireLogin={!user}
                    />
                </div>
            </div>
        </main>
    )
}
