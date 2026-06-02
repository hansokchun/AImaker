import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import PackageCard from '../components/PackageCard'
import { AI_CATEGORIES } from '../constants/categories'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { useEffect, useState } from 'react'
import { createConsultation, getExpertProducts } from '../lib/storage'
import type { ExpertProduct } from '../types'
import './ExpertDetail.css'

export default function ExpertDetail() {
    const { id } = useParams<{ id: string }>()
    const location = useLocation()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [creatingConsultation, setCreatingConsultation] = useState<boolean>(false)
    const [product, setProduct] = useState<ExpertProduct | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let active = true
        setLoading(true)
        getExpertProducts().then((products) => {
            if (!active) return
            setProduct(products.find((item) => item.id === id || item.expertId === id) ?? null)
            setLoading(false)
        })
        return () => {
            active = false
        }
    }, [id])

    const category = AI_CATEGORIES.find((item) => item.id === product?.category)
    const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
    const myPageReturnTo = from?.pathname === ROUTES.MY_PAGE ? `${from.pathname}${from.search || ''}` : ''

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
                initialMessage: `${product.title} 작업 범위와 예상 가격을 상담하고 싶습니다.`,
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

    if (!product) {
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
                    <Link to={ROUTES.PROFILE} className="btn-primary">
                        <span className="material-symbols-outlined">edit</span>
                        프로필 수정하기
                    </Link>
                </div>
            )}

            <div className="detail-layout">
                <div className="content-left">
                    <section className="product-detail-hero">
                        <div className="product-detail-image">
                            <img src={product.sampleImageUrl} alt={`${product.title} 샘플 결과물`} />
                        </div>
                        <div className="product-detail-copy">
                            <div className="product-detail-category">{category?.name ?? 'AI 작업'}</div>
                            <h1>{product.title}</h1>
                            <p>{product.description}</p>
                            <div className="product-detail-meta">
                                <span>시작가 {product.startingPrice.toLocaleString()}원</span>
                                <span>작업 {product.deliveryDays}일</span>
                                <span>수정 {product.revisionCount}회</span>
                            </div>
                            <div className="product-detail-expert">{product.expertName}</div>
                        </div>
                    </section>

                    <section className="detail-section">
                        <h2>
                            <span className="material-symbols-outlined">description</span>
                            상품 설명
                        </h2>
                        <div className="section-content">
                            <p>{product.summary}</p>
                        </div>
                    </section>

                    <section className="detail-section">
                        <h2>
                            <span className="material-symbols-outlined">image</span>
                            샘플 결과물
                        </h2>
                        <div className="section-content sample-result-panel">
                            <img src={product.sampleImageUrl} alt={`${product.title} 샘플 미리보기`} />
                            {product.sampleLinks.length > 0 && (
                                <a href={product.sampleLinks[0]} target="_blank" rel="noreferrer">
                                    샘플 링크 보기
                                </a>
                            )}
                        </div>
                    </section>

                    <section className="detail-section">
                        <h2>
                            <span className="material-symbols-outlined">construction</span>
                            사용 AI 도구
                        </h2>
                        <div className="section-content tool-chip-list">
                            {product.aiTools.map((tool) => (
                                <span key={tool} className="tool-chip">
                                    {tool}
                                </span>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="content-right">
                    <PackageCard
                        packages={product.packages}
                        productId={product.id}
                        onOpenChat={handleStartConsultation}
                        chatButtonDisabled={creatingConsultation}
                    />
                </div>
            </div>
        </main>
    )
}
