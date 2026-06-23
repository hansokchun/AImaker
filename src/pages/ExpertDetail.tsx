import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import FavoriteProductButton from '../components/FavoriteProductButton'
import PackageCard from '../components/PackageCard'
import { AI_CATEGORIES } from '../constants/categories'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { createConsultation, getExpertProducts, getExpertReviews, getStoredProfile, getUserDisplayProfile } from '../lib/storage'
import type { ExpertProduct, ExpertProfile, ProductPackage, Review } from '../types'
import './ExpertDetail.css'

type SellerProfile = {
    name: string
    imageUrl: string
    isExpert: boolean
    profession?: string
    oneLiner?: string
    greeting?: string
    activities: string[]
    awards: string[]
    aiTools: string[]
    editTools: string[]
    contactAvailableTime?: string
    averageResponseTime?: string
}

type ProductGalleryMedia = {
    src: string
    alt: string
    label: string
    type: 'image' | 'video'
}

const getAverageRating = (reviews: Review[]) => {
    if (reviews.length === 0) return 0
    return reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
}

const mergeSellerProfile = (
    displayProfile: { name: string; imageUrl: string; isExpert: boolean } | null,
    storedProfile: ExpertProfile | null,
    fallbackName: string,
): SellerProfile => ({
    name: displayProfile?.name || storedProfile?.name || fallbackName,
    imageUrl: displayProfile?.imageUrl || storedProfile?.imageUrl || '',
    isExpert: Boolean(displayProfile?.isExpert || storedProfile),
    profession: storedProfile?.profession || '',
    oneLiner: storedProfile?.oneLiner || '',
    greeting: storedProfile?.greeting || '',
    activities: storedProfile?.activities || [],
    awards: storedProfile?.awards || [],
    aiTools: storedProfile?.aiTools || [],
    editTools: storedProfile?.editTools || [],
    contactAvailableTime: storedProfile?.contactAvailableTime || '',
    averageResponseTime: storedProfile?.averageResponseTime || '',
})

const formatProductCreatedAt = (createdAt?: string) => {
    if (!createdAt) return ''
    const parsed = new Date(createdAt)
    if (Number.isNaN(parsed.getTime())) return ''
    return parsed.toLocaleDateString('ko-KR')
}

const isVideoMedia = (src: string) =>
    /^data:video\//i.test(src) || /\.(mp4|webm|ogg)(\?|#|$)/i.test(src)

const getReviewClientName = (clientId: string) => `의뢰자 ${clientId}`

const getPackageComparisonFeatures = (packageEntries: readonly (readonly ['standard' | 'deluxe' | 'premium', ProductPackage])[]) => {
    const features = new Set<string>()
    packageEntries.forEach(([, packageInfo]) => {
        packageInfo.included.forEach((feature) => {
            if (feature.trim()) features.add(feature.trim())
        })
    })

    return Array.from(features)
}

export default function ExpertDetail() {
    const { id } = useParams<{ id: string }>()
    const location = useLocation()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [creatingConsultation, setCreatingConsultation] = useState(false)
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
    const [activeGalleryIndex, setActiveGalleryIndex] = useState(0)
    const [allProducts, setAllProducts] = useState<ExpertProduct[]>([])
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

            setAllProducts(products)
            setProduct(foundProduct)
            setSellerProducts(productsBySeller)

            if (foundProduct || productsBySeller.length > 0) {
                const [displayProfile, storedProfile, reviews] = await Promise.all([
                    getUserDisplayProfile(sellerId),
                    getStoredProfile(sellerId),
                    getExpertReviews(sellerId),
                ])
                if (!active) return
                setSellerProfile(mergeSellerProfile(displayProfile, storedProfile, foundProduct?.expertName || productsBySeller[0]?.expertName || 'AI 전문가'))
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

    useEffect(() => {
        setActiveGalleryIndex(0)
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
    const productCreatedAt = formatProductCreatedAt(product?.createdAt)

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

    const handleShareProduct = async () => {
        if (!product) return

        const productUrl = `${window.location.origin}/expert/${product.id}`
        try {
            if (navigator.share) {
                await navigator.share({ title: product.title, url: productUrl })
                return
            }

            await navigator.clipboard?.writeText(productUrl)
            window.alert('상품 링크를 복사했습니다.')
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                window.alert('상품 링크를 복사하지 못했습니다.')
            }
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
                        {sellerProfile?.contactAvailableTime && (
                            <p>연락 가능 시간 {sellerProfile.contactAvailableTime}</p>
                        )}
                        {sellerProfile?.averageResponseTime && (
                            <p>평균 응답 시간 {sellerProfile.averageResponseTime}</p>
                        )}
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
    const categoryUrl = `${ROUTES.CATEGORY}?category=${encodeURIComponent(product.category)}`
    const detailGalleryImages: ProductGalleryMedia[] = [
        ...(product.sampleImageUrl ? [{ src: product.sampleImageUrl, alt: `${product.title} 메인 이미지`, label: '메인 이미지', type: 'image' as const }] : []),
        ...sampleLinks.map((src, index) => ({
            src,
            alt: `${product.title} 미디어 ${index + 1}`,
            label: `미디어 ${index + 1}`,
            type: isVideoMedia(src) ? 'video' as const : 'image' as const,
        })),
    ]
    const activeGalleryImage = detailGalleryImages[activeGalleryIndex] ?? detailGalleryImages[0]
    const packageEntries = (['standard', 'deluxe', 'premium'] as const)
        .map((tier) => packages[tier] ? [tier, packages[tier] as ProductPackage] as const : null)
        .filter((entry): entry is readonly ['standard' | 'deluxe' | 'premium', ProductPackage] => Boolean(entry))
    const packageTierLabels = {
        standard: 'Standard',
        deluxe: 'Deluxe',
        premium: 'Premium',
    }
    const packageComparisonFeatures = getPackageComparisonFeatures(packageEntries)
    const sellerPortfolioProducts = sellerProducts
        .filter((sellerProduct) => sellerProduct.id !== product.id)
        .slice(0, 4)
    const similarProducts = allProducts
        .filter((candidate) => candidate.id !== product.id && candidate.category === product.category)
        .slice(0, 4)
    const sellerTools = [
        ...(sellerProfile?.aiTools || []),
        ...(sellerProfile?.editTools || []),
    ].filter(Boolean)

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
                <div className="content-left" data-testid="product-detail-flow">
                    <section className="product-detail-hero" data-testid="product-detail-header">
                        <div className="product-detail-image">
                            {sampleImageUrl ? (
                                <img src={sampleImageUrl} alt={`${product.title} 샘플 결과물`} />
                            ) : (
                                <div className="product-detail-image-empty">대표 이미지 준비 중</div>
                            )}
                        </div>
                        <div className="product-detail-copy">
                            <nav className="product-breadcrumbs" data-testid="product-detail-breadcrumbs" aria-label="상품 위치">
                                <Link to="/">홈</Link>
                                <span aria-hidden="true">/</span>
                                <Link to={ROUTES.CATEGORY}>AI 작업 찾기</Link>
                                <span aria-hidden="true">/</span>
                                <Link to={categoryUrl}>{category?.name ?? 'AI 작업'}</Link>
                                <span aria-hidden="true">/</span>
                                <Link to={`/expert/${product.id}`}>{product.title}</Link>
                            </nav>
                            <h1>{product.title}</h1>
                            <p>{product.summary}</p>
                            <div className="product-detail-seller-inline">
                                {sellerImageUrl ? (
                                    <img src={sellerImageUrl} alt={`${sellerName} 프로필`} />
                                ) : (
                                    <div className="seller-avatar-fallback" aria-hidden="true">
                                        {sellerName.slice(0, 1)}
                                    </div>
                                )}
                                <div>
                                    <Link to={`/expert/${product.expertId}`}>{sellerName}</Link>
                                    <span>{reviewSummary}</span>
                                </div>
                            </div>
                            <div className="product-detail-meta">
                                <span>시작가 {product.startingPrice.toLocaleString()}원</span>
                                <span>작업 {product.deliveryDays}일</span>
                                <span>수정 {product.revisionCount}회</span>
                                {productCreatedAt && <span>등록일 {productCreatedAt}</span>}
                                <span>{product.taxInvoiceAvailable ? '세금계산서 발행 가능' : '세금계산서 발행 불가'}</span>
                            </div>
                        </div>
                    </section>

                    {detailGalleryImages.length > 0 && (
                        <section className="detail-section media-gallery-section">
                            <div className="product-gallery-shell" data-testid="product-detail-gallery">
                                <div className="product-gallery-stage">
                                    {detailGalleryImages.length > 1 && (
                                        <button
                                            type="button"
                                            className="gallery-nav-button gallery-nav-prev"
                                            aria-label="이전 미디어"
                                            onClick={() => setActiveGalleryIndex((index) => (index === 0 ? detailGalleryImages.length - 1 : index - 1))}
                                        >
                                            <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
                                        </button>
                                    )}
                                    {activeGalleryImage?.type === 'video' ? (
                                        <video
                                            className="product-gallery-image product-gallery-video"
                                            src={activeGalleryImage.src}
                                            aria-label={activeGalleryImage.alt}
                                            controls
                                            data-testid="product-gallery-video"
                                        />
                                    ) : activeGalleryImage ? (
                                        <img className="product-gallery-image" src={activeGalleryImage.src} alt={activeGalleryImage.alt} />
                                    ) : null}
                                    {detailGalleryImages.length > 1 && (
                                        <button
                                            type="button"
                                            className="gallery-nav-button gallery-nav-next"
                                            aria-label="다음 미디어"
                                            onClick={() => setActiveGalleryIndex((index) => (index + 1) % detailGalleryImages.length)}
                                        >
                                            <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                                        </button>
                                    )}
                                </div>
                                {detailGalleryImages.length > 1 && (
                                    <div className="product-gallery-footer">
                                        <span>{activeGalleryIndex + 1} / {detailGalleryImages.length}</span>
                                        <div className="product-gallery-dots" aria-label="이미지 선택">
                                            {detailGalleryImages.map((image, index) => (
                                                <button
                                                    key={`${image.label}-${image.src}`}
                                                    type="button"
                                                    aria-label={`${index + 1}번 미디어 보기`}
                                                    className={index === activeGalleryIndex ? 'active' : ''}
                                                    onClick={() => setActiveGalleryIndex(index)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    <section className="detail-section" data-testid="product-service-description">
                        <h2>
                            <span className="material-symbols-outlined" aria-hidden="true">description</span>
                            서비스 설명
                        </h2>
                        <div className="section-content">
                            <p>{product.description}</p>
                        </div>
                    </section>

                    <section className="detail-section product-portfolio-section" data-testid="product-portfolio">
                        <h2>
                            <span className="material-symbols-outlined" aria-hidden="true">work</span>
                            포트폴리오
                        </h2>
                        <div className="portfolio-preview-grid">
                            {detailGalleryImages.map((image) => (
                                <figure key={`portfolio-${image.label}-${image.src}`} className="portfolio-preview-item">
                                    {image.type === 'video' ? (
                                        <video src={image.src} aria-label={image.alt} controls data-testid="product-portfolio-video" />
                                    ) : (
                                        <img src={image.src} alt={image.alt} />
                                    )}
                                </figure>
                            ))}
                        </div>
                    </section>

                    <section className="detail-section price-comparison-section" data-testid="product-price-comparison">
                        <h2>
                            <span className="material-symbols-outlined" aria-hidden="true">payments</span>
                            가격 비교
                        </h2>
                        <div className="price-comparison-table" role="table" aria-label="패키지 가격 비교">
                            <div className="price-comparison-row price-comparison-head" role="row">
                                <div role="columnheader">패키지</div>
                                <div role="columnheader">가격</div>
                                <div role="columnheader">작업일</div>
                                <div role="columnheader">수정</div>
                                <div role="columnheader">포함 항목</div>
                            </div>
                            {packageEntries.map(([tier, packageInfo]) => (
                                <div key={tier} className="price-comparison-row" role="row">
                                    <div role="cell">{packageTierLabels[tier]}</div>
                                    <div role="cell">{packageInfo.price.toLocaleString()}원</div>
                                    <div role="cell">{packageInfo.deliveryDays}일</div>
                                    <div role="cell">{packageInfo.revisionCount}회</div>
                                    <div role="cell">
                                        <ul className="price-comparison-feature-list">
                                            {packageComparisonFeatures.map((feature) => {
                                                const included = packageInfo.included.includes(feature)

                                                return (
                                                    <li key={`${tier}-${feature}`} className={included ? 'available' : 'unavailable'}>
                                                        <span className="material-symbols-outlined" aria-hidden="true">
                                                            {included ? 'check' : 'remove'}
                                                        </span>
                                                        <span>{feature}</span>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

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

                    <section className="detail-section seller-info-section" data-testid="product-detail-seller">
                        <h2 className="seller-clean-heading">
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
                                <div className="seller-clean-details">
                                    <p>{sellerProfile?.profession || (sellerProfile?.isExpert ? 'AIConnect 전문가' : '상품 등록 전문가')}</p>
                                    <p>{reviewSummary}</p>
                                    {sellerProfile?.contactAvailableTime && (
                                        <p>연락 가능 시간 {sellerProfile.contactAvailableTime}</p>
                                    )}
                                    {sellerProfile?.averageResponseTime && (
                                        <p>평균 응답 시간 {sellerProfile.averageResponseTime}</p>
                                    )}
                                    <Link to={`/expert/${product.expertId}`} className="seller-profile-clean-link">
                                        판매자 프로필 보기
                                    </Link>
                                </div>
                            </div>
                        </div>
                        <div className="seller-profile-detail-card">
                            {sellerProfile?.oneLiner && (
                                <p className="seller-profile-one-liner">{sellerProfile.oneLiner}</p>
                            )}
                            {sellerProfile?.greeting && (
                                <p className="seller-profile-greeting">{sellerProfile.greeting}</p>
                            )}
                            {sellerTools.length > 0 && (
                                <div className="seller-profile-block">
                                    <strong>사용 도구</strong>
                                    <div className="tool-chip-list">
                                        {sellerTools.map((tool) => (
                                            <span key={tool} className="tool-chip">{tool}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {sellerProfile?.activities && sellerProfile.activities.length > 0 && (
                                <div className="seller-profile-block">
                                    <strong>주요 활동</strong>
                                    <ul className="seller-profile-list">
                                        {sellerProfile.activities.map((activity) => (
                                            <li key={activity}>{activity}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {sellerProfile?.awards && sellerProfile.awards.length > 0 && (
                                <div className="seller-profile-block">
                                    <strong>수상/경력</strong>
                                    <ul className="seller-profile-list">
                                        {sellerProfile.awards.map((award) => (
                                            <li key={award}>{award}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </section>

                    {sellerPortfolioProducts.length > 0 && (
                        <section className="detail-section seller-portfolio-products-section" data-testid="seller-portfolio-products">
                            <h2>
                                <span className="material-symbols-outlined" aria-hidden="true">dashboard</span>
                                마이 포트폴리오
                            </h2>
                            <div className="recommendation-grid">
                                {sellerPortfolioProducts.map((portfolioProduct) => (
                                    <Link
                                        key={portfolioProduct.id}
                                        to={`/expert/${portfolioProduct.id}`}
                                        className="recommendation-card"
                                        aria-label={portfolioProduct.title}
                                    >
                                        {portfolioProduct.sampleImageUrl && (
                                            <img src={portfolioProduct.sampleImageUrl} alt={`${portfolioProduct.title} 대표 이미지`} />
                                        )}
                                        <strong>{portfolioProduct.title}</strong>
                                        <span>{portfolioProduct.startingPrice.toLocaleString()}원부터 · {portfolioProduct.deliveryDays}일</span>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="detail-section seller-review-section" data-testid="product-detail-reviews">
                        <h2>
                            <span className="material-symbols-outlined" aria-hidden="true">star</span>
                            받은 리뷰
                        </h2>
                        {expertReviews.length > 0 ? (
                            <div className="seller-review-list">
                                {expertReviews.map((review) => (
                                    <article key={review.id} className="seller-review-card">
                                        <div className="seller-review-header">
                                            <div className="seller-review-avatar" aria-hidden="true">
                                                {getReviewClientName(review.clientId).slice(-1)}
                                            </div>
                                            <div>
                                                <strong>{getReviewClientName(review.clientId)}</strong>
                                                <span>평점 {review.rating}.0 · 주문 상품: {product.title}</span>
                                            </div>
                                        </div>
                                        <p>{review.content}</p>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <p className="seller-empty-copy">아직 받은 리뷰가 없습니다.</p>
                        )}
                    </section>

                    {similarProducts.length > 0 && (
                        <section className="detail-section similar-products-section" data-testid="similar-product-recommendations">
                            <h2>
                                <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
                                비슷한 AI 상품
                            </h2>
                            <div className="recommendation-grid">
                                {similarProducts.map((similarProduct) => (
                                    <Link
                                        key={similarProduct.id}
                                        to={`/expert/${similarProduct.id}`}
                                        className="recommendation-card"
                                        aria-label={similarProduct.title}
                                    >
                                        {similarProduct.sampleImageUrl && (
                                            <img src={similarProduct.sampleImageUrl} alt={`${similarProduct.title} 대표 이미지`} />
                                        )}
                                        <strong>{similarProduct.title}</strong>
                                        <span>{similarProduct.expertName}</span>
                                        <small>{similarProduct.startingPrice.toLocaleString()}원부터 · {similarProduct.deliveryDays}일</small>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                <div className="content-right" data-testid="product-package-sidebar">
                    <div className="product-package-actions" data-testid="product-package-actions">
                        {user?.id !== product.expertId && (
                            <FavoriteProductButton
                                productId={product.id}
                                productTitle={product.title}
                                className="product-detail-favorite product-sidebar-favorite"
                            />
                        )}
                        <button type="button" className="package-icon-action" aria-label="상품 공유" onClick={handleShareProduct}>
                            <span className="material-symbols-outlined" aria-hidden="true">ios_share</span>
                        </button>
                        <div className="package-more-action">
                            <button
                                type="button"
                                className="package-icon-action"
                                aria-label="더보기"
                                aria-expanded={isMoreMenuOpen}
                                onClick={() => setIsMoreMenuOpen((open) => !open)}
                            >
                                <span className="material-symbols-outlined" aria-hidden="true">more_horiz</span>
                            </button>
                            {isMoreMenuOpen && (
                                <div className="package-more-menu">
                                    <Link to={`/expert/${product.expertId}`}>판매자 프로필 보기</Link>
                                    <button type="button" onClick={handleShareProduct}>상품 링크 복사</button>
                                    <button type="button" onClick={() => window.alert('신고 기능은 준비 중입니다.')}>상품 신고</button>
                                </div>
                            )}
                        </div>
                    </div>
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
