import { Link, useParams } from 'react-router-dom'
import ChatModal from '../components/ChatModal'
import PackageCard from '../components/PackageCard'
import { AI_CATEGORIES } from '../constants/categories'
import { ROUTES } from '../constants/routes'
import { mockExpertProducts } from '../data/mockData'
import { useAuth } from '../contexts/AuthContext'
import { useState } from 'react'
import './ExpertDetail.css'

export default function ExpertDetail() {
    const { id } = useParams<{ id: string }>()
    const { user } = useAuth()
    const [chatOpen, setChatOpen] = useState<boolean>(false)

    const product = mockExpertProducts.find((item) => item.id === id || item.expertId === id)
    const category = AI_CATEGORIES.find((item) => item.id === product?.category)

    if (!product) {
        return (
            <main className="container detail-empty-state">
                <span className="material-symbols-outlined">inventory_2</span>
                <h2>상품을 찾을 수 없습니다</h2>
                <p>존재하지 않거나 더 이상 공개되지 않은 AI 작업입니다.</p>
                <Link to={ROUTES.CATEGORY} className="btn-primary">
                    AI 작업 찾기로 돌아가기
                </Link>
            </main>
        )
    }

    return (
        <main className="container">
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
                        onOpenChat={() => setChatOpen(true)}
                    />
                </div>
            </div>

            {chatOpen && <ChatModal onClose={() => setChatOpen(false)} />}
        </main>
    )
}
