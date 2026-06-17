import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { mockExpertProducts } from '../data/mockData'
import { getExpertProducts } from '../lib/storage'
import type { ExpertProduct } from '../types'

const popularWork = [
    'AI 영상/숏폼',
    'AI 이미지/캐릭터',
    'AI 개발/자동화',
    '프롬프트/콘텐츠 시안',
]

const categoryCards = [
    {
        title: 'AI 영상/숏폼',
        description: '광고 영상, 릴스, 쇼츠 콘셉트와 1차 시안을 빠르게 맡길 수 있어요.',
        examples: ['쇼츠 시안', '광고 영상', '영상 콘셉트'],
        accent: 'blue',
    },
    {
        title: 'AI 이미지/캐릭터',
        description: '캐릭터, 브랜드 이미지, 프로필 시안을 샘플 중심으로 비교하세요.',
        examples: ['캐릭터 시안', '브랜드 이미지', '상세컷'],
        accent: 'green',
    },
    {
        title: 'AI 개발/자동화',
        description: '반복 업무를 줄이는 간단한 프로그램, 자동화 도구, AI 코딩 작업을 의뢰하세요.',
        examples: ['업무 자동화', 'AI 코딩', '미니 도구'],
        accent: 'yellow',
    },
]

const processSteps = [
    {
        title: '요구사항 작성',
        description: '사용 목적, 참고자료, 스타일, 마감일을 한 번에 정리합니다.',
    },
    {
        title: '제안서 확인',
        description: '작업 범위, 기간, 수정 횟수를 확인하고 수락합니다.',
    },
    {
        title: '작업방 진행',
        description: '흐름설계, 결과물 제출, 승인 상태를 단계별로 확인합니다.',
    },
]

const trustItems = [
    {
        label: 'AI 특화',
        value: '영상, 이미지, 자동화만 집중',
    },
    {
        label: '샘플 보고 의뢰',
        value: '말보다 결과물을 먼저 확인',
    },
    {
        label: '작업방에서 진행 확인',
        value: '제안 수락 후 단계별로 관리',
    },
]

function ProductThumbnail({ product }: { product: ExpertProduct }) {
    const [imageFailed, setImageFailed] = useState(false)
    const imageUrl = product.sampleImageUrl.trim()
    const showImage = imageUrl && !imageFailed

    return (
        <div
            className="home-featured-product-thumbnail"
            role="img"
            aria-label={`${product.title} 썸네일`}
        >
            <span className="home-featured-thumbnail-label" aria-hidden="true">
                AIConnect
            </span>
            {showImage && (
                <img
                    src={imageUrl}
                    alt=""
                    aria-hidden="true"
                    data-testid={`home-product-image-${product.id}`}
                    className="home-featured-product-image"
                    onError={() => setImageFailed(true)}
                />
            )}
        </div>
    )
}

export default function Home() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [products, setProducts] = useState<ExpertProduct[]>(mockExpertProducts)
    const [searchKeyword, setSearchKeyword] = useState('')

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

    const handleSearch = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const query = searchKeyword.trim()
        navigate(query ? `${ROUTES.CATEGORY}?q=${encodeURIComponent(query)}` : ROUTES.CATEGORY)
    }

    return (
        <main className="home-page home-marketplace-page">
            <section className="home-market-hero">
                <div className="home-market-hero-overlay">
                    <div className="container home-market-hero-inner">
                        <div className="home-market-hero-copy">
                            <p className="home-market-eyebrow">AI 전용 외주 마켓</p>
                            <h1>AI 작업을 싸고 쉽게 맡기세요</h1>
                            <p>
                                샘플과 시작가를 보고 영상, 이미지, 자동화 작업을 고른 뒤
                                작업방에서 진행 상황까지 확인하세요.
                            </p>
                            <form className="home-market-search" role="search" onSubmit={handleSearch}>
                                <span className="material-symbols-outlined" aria-hidden="true">
                                    search
                                </span>
                                <input
                                    type="search"
                                    placeholder="어떤 AI 작업이 필요하세요?"
                                    aria-label="AI 작업 검색"
                                    value={searchKeyword}
                                    onChange={(event) => setSearchKeyword(event.target.value)}
                                />
                                <button type="submit">검색</button>
                            </form>
                            <div className="home-market-popular" aria-label="인기 AI 작업">
                                {popularWork.map((item) => (
                                    <Link key={item} to={ROUTES.CATEGORY}>
                                        {item}
                                    </Link>
                                ))}
                            </div>
                            <div className="home-market-actions">
                                <Link to={ROUTES.CATEGORY} className="home-market-primary">
                                    AI 작업 찾기
                                </Link>
                                <Link to={ROUTES.PROFILE} className="home-market-secondary">
                                    작업자로 시작하기
                                </Link>
                                {user && (
                                    <Link to={ROUTES.WORK_DASHBOARD} className="home-market-work">
                                        내 작업 보기
                                    </Link>
                                )}
                            </div>
                        </div>

                        <div className="home-market-hero-samples" aria-label="AI 작업 샘플">
                            <article className="home-market-sample-card sample-video">
                                <span>AI 영상</span>
                                <strong>15초 쇼츠 시안</strong>
                                <small>30,000원부터</small>
                            </article>
                            <article className="home-market-sample-card sample-image">
                                <span>AI 이미지</span>
                                <strong>캐릭터 3장</strong>
                                <small>25,000원부터</small>
                            </article>
                            <article className="home-market-sample-card sample-dev">
                                <span>AI 자동화</span>
                                <strong>반복 업무 도구</strong>
                                <small>80,000원부터</small>
                            </article>
                        </div>
                    </div>
                </div>
            </section>

            <section className="home-trust-strip" aria-label="AIConnect 핵심 강점">
                <div className="container home-trust-grid">
                    {trustItems.map((item) => (
                        <div key={item.label} className="home-trust-item">
                            <strong>{item.label}</strong>
                            <span>{item.value}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="home-section container">
                <div className="home-section-heading">
                    <p className="home-section-eyebrow">Browse AI Work</p>
                    <h2 className="section-title">AI 작업 카테고리</h2>
                    <p className="home-section-copy">
                        처음에는 가장 수요가 빠른 3개 분야만 크게 보여주고, 상품과 샘플이 쌓이면 세부 카테고리를 확장합니다.
                    </p>
                </div>
                <div className="home-market-category-grid">
                    {categoryCards.map((category) => (
                        <article className={`home-market-category-card ${category.accent}`} key={category.title}>
                            <span className="material-symbols-outlined" aria-hidden="true">
                                auto_awesome
                            </span>
                            <h3>{category.title}</h3>
                            <p>{category.description}</p>
                            <div>
                                {category.examples.map((example) => (
                                    <small key={example}>{example}</small>
                                ))}
                            </div>
                            <Link to={ROUTES.CATEGORY}>상품 보기</Link>
                        </article>
                    ))}
                </div>
            </section>

            <section className="home-section home-featured-band">
                <div className="container">
                    <div className="home-section-heading">
                        <p className="home-section-eyebrow">Popular AI Services</p>
                        <h2 className="section-title">바로 의뢰할 수 있는 AI 상품</h2>
                        <p className="home-section-copy">
                            리뷰가 적은 초기에는 평점보다 샘플 결과물, 시작가, 사용 AI 도구를 먼저 보여줍니다.
                        </p>
                    </div>
                    <div className="home-featured-product-grid">
                        {products.slice(0, 3).map((product) => (
                            <article className="home-featured-product" key={product.id}>
                                <Link to={`/expert/${product.id}`} className="home-featured-product-image-link">
                                    <ProductThumbnail product={product} />
                                </Link>
                                <div className="home-featured-product-body">
                                    <div className="home-featured-tools">{product.aiTools.slice(0, 3).join(' · ')}</div>
                                    <h3 className="home-product-title">{product.title}</h3>
                                    <p className="home-product-summary">{product.summary}</p>
                                    <div className="home-featured-meta">
                                        <span>{product.expertName}</span>
                                        <strong>{product.startingPrice.toLocaleString()}원부터</strong>
                                    </div>
                                    <div className="home-featured-product-actions">
                                        <Link to={`/request/${product.id}`} className="home-featured-order">
                                            의뢰 시작
                                        </Link>
                                        <Link to={`/expert/${product.id}`} className="home-featured-detail">
                                            상세 보기
                                        </Link>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="home-section container">
                <div className="home-process-panel">
                    <div className="home-section-heading">
                        <p className="home-section-eyebrow">Workroom Flow</p>
                        <h2 className="section-title">작업은 작업방에서 단계별로 확인하세요</h2>
                        <p className="home-section-copy">
                            결제 기능은 테스트 이후로 미루고, 지금은 의뢰부터 결과물 승인까지의 흐름을 먼저 검증합니다.
                        </p>
                    </div>
                    <ol className="home-process-list">
                        {processSteps.map((step, index) => (
                            <li key={step.title}>
                                <span>{index + 1}</span>
                                <div>
                                    <strong>{step.title}</strong>
                                    <p>{step.description}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <section className="home-maker-cta">
                <div className="container home-maker-cta-inner">
                    <div>
                        <p className="home-section-eyebrow">Start as Maker</p>
                        <h2>AI 도구를 다룰 줄 안다면 작업자로 시작할 수 있어요</h2>
                        <p>
                            사용 AI 도구, 샘플 결과물 1개, 서비스 상품 1개만 있으면 첫 상품을 등록할 수 있습니다.
                        </p>
                    </div>
                    <Link to={ROUTES.PROFILE} className="home-market-primary">
                        작업자 프로필 만들기
                    </Link>
                </div>
            </section>
        </main>
    )
}
