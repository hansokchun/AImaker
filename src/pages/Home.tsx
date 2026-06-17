import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { mockExpertProducts } from '../data/mockData'
import { getExpertProducts } from '../lib/storage'
import type { ExpertProduct } from '../types'

const valueCards = [
    {
        title: 'AI라서 더 낮은 가격',
        description: '반복 작업과 초안 제작을 AI로 줄여 입문형 작업부터 부담 없이 시작합니다.',
    },
    {
        title: '샘플 보고 선택',
        description: '긴 설명보다 실제 샘플, 사용 도구, 시작가를 먼저 보고 고릅니다.',
    },
    {
        title: '작업방에서 진행 확인',
        description: '요구사항, 결과물 제출, 승인 상태를 한 곳에서 확인합니다.',
    },
]

const categoryCards = [
    {
        title: 'AI 영상/숏폼',
        description: '쇼츠 콘셉트, 대본, 광고 영상 시안을 빠르게 맡길 수 있어요.',
        examples: ['숏폼 시안', '영상 콘셉트', '광고 초안'],
        icon: 'movie',
    },
    {
        title: 'AI 이미지/캐릭터',
        description: '캐릭터, 프로필, 상세페이지 이미지처럼 눈에 보이는 결과물을 비교하세요.',
        examples: ['캐릭터 3장', '브랜드 이미지', '프로필 시안'],
        icon: 'palette',
    },
    {
        title: 'AI 개발/자동화',
        description: '간단한 프로그램, 업무 자동화, AI 코딩 결과물을 작은 단위로 의뢰하세요.',
        examples: ['미니 도구', '업무 자동화', 'AI 코딩'],
        icon: 'terminal',
    },
]

const flowSteps = [
    '카테고리 선택',
    '샘플 상품 확인',
    '요구사항 작성',
    '작업방에서 결과 확인',
]

function ProductThumbnail({ product }: { product: ExpertProduct }) {
    const [imageFailed, setImageFailed] = useState(false)
    const imageUrl = product.sampleImageUrl.trim()
    const showImage = imageUrl && !imageFailed

    return (
        <div
            className="home-practical-product-thumbnail"
            role="img"
            aria-label={`${product.title} 썸네일`}
        >
            <span className="home-practical-thumbnail-label" aria-hidden="true">
                AIConnect
            </span>
            {showImage && (
                <img
                    src={imageUrl}
                    alt=""
                    aria-hidden="true"
                    data-testid={`home-product-image-${product.id}`}
                    className="home-practical-product-image"
                    onError={() => setImageFailed(true)}
                />
            )}
        </div>
    )
}

export default function Home() {
    const { user } = useAuth()
    const [products, setProducts] = useState<ExpertProduct[]>(mockExpertProducts)

    useEffect(() => {
        let active = true
        getExpertProducts()
            .then((items) => {
                if (active) setProducts(items.length ? items : mockExpertProducts)
            })
            .catch(() => {
                if (active) setProducts(mockExpertProducts)
            })
        return () => {
            active = false
        }
    }, [])

    return (
        <main className="home-page home-practical-page">
            <section className="home-practical-hero">
                <div className="container home-practical-hero-inner">
                    <div className="home-practical-hero-copy">
                        <p className="home-practical-eyebrow">AI 전용 외주 마켓</p>
                        <h1>AI 작업을 싸고 쉽게 맡기세요</h1>
                        <p>
                            누구나 저렴하게 의뢰하고, AI 도구를 다룰 줄 아는 사람은 누구나 작업자로
                            시작할 수 있는 실용형 마켓입니다.
                        </p>
                        <div className="home-practical-actions">
                            <Link to={ROUTES.CATEGORY} className="home-practical-primary">
                                AI 작업 둘러보기
                            </Link>
                            <Link to={ROUTES.PROFILE} className="home-practical-secondary">
                                작업자로 시작하기
                            </Link>
                            {user && (
                                <Link to={ROUTES.WORK_DASHBOARD} className="home-practical-work">
                                    내 작업 보기
                                </Link>
                            )}
                        </div>
                    </div>

                    <aside className="home-practical-snapshot" aria-label="AIConnect 핵심 구조">
                        <strong>처음 런칭 구조</strong>
                        <ul>
                            <li>상품 구매를 메인으로 노출</li>
                            <li>영상, 이미지, 개발/자동화 3개 카테고리 집중</li>
                            <li>마일스톤 결제보다 진행표를 먼저 검증</li>
                        </ul>
                    </aside>
                </div>
            </section>

            <section className="home-practical-values" aria-label="AIConnect 핵심 가치">
                <div className="container home-practical-value-grid">
                    {valueCards.map((item) => (
                        <article key={item.title} className="home-practical-value-card">
                            <h2>{item.title}</h2>
                            <p>{item.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="home-practical-section container">
                <div className="home-practical-section-heading">
                    <p className="home-practical-eyebrow">Start Here</p>
                    <h2 className="section-title">먼저 필요한 AI 작업을 고르세요</h2>
                    <p>
                        초기에는 선택지를 늘리기보다 수요가 가장 빠른 세 분야를 크게 보여주고,
                        각 분야 안에서 입문형 상품을 쉽게 비교하게 합니다.
                    </p>
                </div>
                <div className="home-practical-category-grid">
                    {categoryCards.map((category) => (
                        <article key={category.title} className="home-practical-category-card">
                            <span className="material-symbols-outlined" aria-hidden="true">
                                {category.icon}
                            </span>
                            <h3>{category.title}</h3>
                            <p>{category.description}</p>
                            <div className="home-practical-tags">
                                {category.examples.map((example) => (
                                    <small key={example}>{example}</small>
                                ))}
                            </div>
                            <Link to={ROUTES.CATEGORY}>상품 보기</Link>
                        </article>
                    ))}
                </div>
            </section>

            <section className="home-practical-section home-practical-products-band">
                <div className="container">
                    <div className="home-practical-section-heading">
                        <p className="home-practical-eyebrow">Low-cost AI Services</p>
                        <h2 className="section-title">입문형 AI 상품</h2>
                        <p>
                            비싼 외주보다 작은 결과물을 먼저 거래하게 만들고, 샘플과 가격으로 빠르게
                            판단하게 합니다.
                        </p>
                    </div>
                    <div className="home-practical-product-grid">
                        {products.slice(0, 3).map((product) => (
                            <article className="home-practical-product" key={product.id}>
                                <Link to={`/expert/${product.id}`} className="home-practical-product-image-link">
                                    <ProductThumbnail product={product} />
                                </Link>
                                <div className="home-practical-product-body">
                                    <div className="home-practical-product-tools">
                                        {product.aiTools.slice(0, 3).join(' · ')}
                                    </div>
                                    <h3 className="home-product-title">{product.title}</h3>
                                    <p className="home-product-summary">{product.summary}</p>
                                    <div className="home-practical-product-meta">
                                        <span>{product.expertName}</span>
                                        <strong>{product.startingPrice.toLocaleString()}원부터</strong>
                                    </div>
                                    <div className="home-practical-product-actions">
                                        <Link to={`/request/${product.id}`} className="home-practical-order">
                                            의뢰 시작
                                        </Link>
                                        <Link to={`/expert/${product.id}`} className="home-practical-detail">
                                            상세 보기
                                        </Link>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="home-practical-section container">
                <div className="home-practical-flow">
                    <div>
                        <p className="home-practical-eyebrow">Simple Flow</p>
                        <h2 className="section-title">의뢰 흐름은 단순하게 유지합니다</h2>
                        <p>
                            초기 사용자는 복잡한 견적 시스템보다 바로 이해되는 흐름이 중요합니다.
                            상품을 고르고 요구사항을 작성한 뒤 작업방에서 상태를 확인합니다.
                        </p>
                    </div>
                    <ol>
                        {flowSteps.map((step, index) => (
                            <li key={step}>
                                <span>{index + 1}</span>
                                <strong>{step}</strong>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <section className="home-practical-maker">
                <div className="container home-practical-maker-inner">
                    <div>
                        <p className="home-practical-eyebrow">For Makers</p>
                        <h2>AI를 다룰 줄 안다면 작업자로 시작하세요</h2>
                        <p>
                            사용 AI 도구, 샘플 결과물 1개, 서비스 상품 1개만 있으면 첫 상품을 등록할 수
                            있습니다.
                        </p>
                    </div>
                    <Link to={ROUTES.PROFILE} className="home-practical-primary">
                        프로필 만들기
                    </Link>
                </div>
            </section>
        </main>
    )
}
