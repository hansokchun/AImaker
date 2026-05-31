import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getExpertProducts, getUserProposals, getUserReviews, getUserServiceRequests, getUserWorks, saveReview } from '../lib/storage'
import type { ExpertProduct, Proposal, Review, ServiceRequestData, Work } from '../types'

const proposalStatusText: Record<Proposal['status'], string> = {
    sent: '대기 중',
    revision_requested: '수정 요청',
    accepted: '승인됨',
    cancelled: '취소',
    expired: '만료',
}

const workStatusText: Record<Work['status'], string> = {
    in_progress: '진행 중',
    submitted: '검토 대기',
    revision_requested: '수정 요청',
    completed: '완료',
    cancelled: '취소',
}

type MyPagePanel = 'overview' | 'client' | 'expert' | 'workroom' | 'reviews'

const menuItems: Array<{ id: MyPagePanel; label: string }> = [
    { id: 'overview', label: '개요' },
    { id: 'client', label: '의뢰자 홈' },
    { id: 'expert', label: '전문가 홈' },
    { id: 'workroom', label: '작업방' },
    { id: 'reviews', label: '완료 / 리뷰' },
]

const cardStyle = {
    background: 'white',
    padding: '2rem',
    borderRadius: '1rem',
    border: '1px solid var(--border-color)',
} as const

const quickLinkStyle = { color: 'var(--text-secondary)', fontWeight: 700 } as const

export default function MyPage() {
    const { session, user, loading, signOut } = useAuth()
    const navigate = useNavigate()
    const [activePanel, setActivePanel] = useState<MyPagePanel>('overview')
    const [isExpert, setIsExpert] = useState(false)
    const [name, setName] = useState('')
    const [reviewOpen, setReviewOpen] = useState(false)
    const [reviewSubmitted, setReviewSubmitted] = useState(false)
    const [reviewRating, setReviewRating] = useState('5')
    const [reviewContent, setReviewContent] = useState('')
    const [products, setProducts] = useState<ExpertProduct[]>([])
    const [proposals, setProposals] = useState<Proposal[]>([])
    const [serviceRequests, setServiceRequests] = useState<ServiceRequestData[]>([])
    const [reviews, setReviews] = useState<Review[]>([])
    const [works, setWorks] = useState<Work[]>([])
    const [selectedReviewWork, setSelectedReviewWork] = useState<Work | null>(null)

    const fetchProfile = useCallback(async () => {
        if (!supabase || !user) return
        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (data) {
            setIsExpert(data.is_expert)
            setName(data.name || '')
        } else if (error && error.code !== 'PGRST116') {
            console.error('프로필 로딩 오류:', error)
        }
    }, [user])

    useEffect(() => {
        if (!loading && !session) {
            navigate(ROUTES.LOGIN)
        }
    }, [session, loading, navigate])

    useEffect(() => {
        if (user && supabase) {
            fetchProfile()
        }
        if (user) {
            getUserProposals(user.id).then(setProposals).catch((error) => {
                console.error('제안서 목록 로딩 오류:', error)
                setProposals([])
            })
            getUserServiceRequests(user.id).then(setServiceRequests).catch((error) => {
                console.error('의뢰 요청 목록 로딩 오류:', error)
                setServiceRequests([])
            })
            getUserWorks(user.id).then(setWorks).catch((error) => {
                console.error('작업 목록 로딩 오류:', error)
                setWorks([])
            })
            getUserReviews(user.id).then(setReviews).catch((error) => {
                console.error('리뷰 목록 로딩 오류:', error)
                setReviews([])
            })
            getExpertProducts().then(setProducts).catch((error) => {
                console.error('상품 목록 로딩 오류:', error)
                setProducts([])
            })
        }
    }, [fetchProfile, user])

    const activeWork = works.find((work) => work.status !== 'completed') || null
    const completedWork = works.find((work) => work.status === 'completed') || null
    const receivedProposals = proposals.filter((proposal) => proposal.clientId === user?.id)
    const sentProposals = proposals.filter((proposal) => proposal.expertId === user?.id)
    const receivedProductRequests = serviceRequests.filter((request) => request.expertId === user?.id && request.productId)
    const myProducts = products.filter((product) => product.expertId === user?.id)
    const activeWorks = works.filter((work) => work.status !== 'completed')
    const completedWorks = works.filter((work) => work.status === 'completed')
    const receivedProposal = receivedProposals[0] || null
    const sentProposal = sentProposals[0] || null
    const publicProduct = myProducts[0] || null

    const renderProposalCards = (items: Proposal[], emptyText: string) => (
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
            {items.length > 0 ? (
                items.map((proposal) => (
                    <div
                        key={proposal.id}
                        style={{
                            padding: '1rem',
                            borderRadius: '0.75rem',
                            background: '#f8fafc',
                            border: '1px solid var(--border-color)',
                        }}
                    >
                        <Link
                            to={`/proposal/${proposal.id}`}
                            style={{
                                display: 'inline-block',
                                color: '#0f172a',
                                fontWeight: 800,
                                textDecoration: 'none',
                                marginBottom: '0.45rem',
                            }}
                        >
                            {proposal.title}
                        </Link>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ color: '#475569', fontSize: '0.9rem' }}>
                                {proposal.totalPrice.toLocaleString()}원 · {proposal.deliveryDays}일
                            </span>
                            <span
                                style={{
                                    padding: '0.25rem 0.55rem',
                                    borderRadius: '999px',
                                    background: proposal.status === 'expired' ? '#fee2e2' : '#e0f2fe',
                                    color: proposal.status === 'expired' ? '#b91c1c' : '#0369a1',
                                    fontSize: '0.8rem',
                                    fontWeight: 800,
                                }}
                            >
                                {proposalStatusText[proposal.status]}
                            </span>
                        </div>
                    </div>
                ))
            ) : (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{emptyText}</p>
            )}
        </div>
    )

    const renderWorkCards = (items: Work[], emptyText: string) => (
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
            {items.length > 0 ? (
                items.map((work) => (
                    <div
                        key={work.id}
                        data-testid={work.status === 'completed' ? 'completed-work' : 'active-work'}
                        style={{
                            padding: '1rem',
                            borderRadius: '0.75rem',
                            background: work.status === 'completed' ? '#f0fdf4' : '#f8fafc',
                            border: '1px solid var(--border-color)',
                        }}
                    >
                        <Link
                            to={`/workroom/${work.id}`}
                            style={{
                                display: 'inline-block',
                                color: '#0f172a',
                                fontWeight: 800,
                                textDecoration: 'none',
                                marginBottom: '0.45rem',
                            }}
                        >
                            {work.title}
                        </Link>
                        <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.8rem' }}>
                            {workStatusText[work.status]}
                        </p>
                        {work.status === 'completed' && !reviews.some((review) => review.workId === work.id && review.clientId === user?.id) && (
                            <button
                                type="button"
                                className="btn-primary"
                                style={{ padding: '0.65rem 0.9rem' }}
                                onClick={() => {
                                    setSelectedReviewWork(work)
                                    setReviewOpen(true)
                                    setReviewSubmitted(false)
                                }}
                            >
                                리뷰 작성
                            </button>
                        )}
                        {work.status === 'completed' && reviews.some((review) => review.workId === work.id && review.clientId === user?.id) && (
                            <p style={{ color: '#166534', fontWeight: 800, margin: '0.8rem 0 0' }}>
                                리뷰 등록 완료
                            </p>
                        )}
                        {reviewSubmitted && selectedReviewWork?.id === work.id && (
                            <p style={{ color: '#166534', fontWeight: 800, margin: '0.8rem 0 0' }}>
                                리뷰가 등록되었습니다.
                            </p>
                        )}
                    </div>
                ))
            ) : (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{emptyText}</p>
            )}
        </div>
    )

    const renderProductCards = (items: ExpertProduct[]) => (
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
            {items.length > 0 ? (
                items.map((product) => (
                    <div
                        key={product.id}
                        style={{
                            padding: '1rem',
                            borderRadius: '0.75rem',
                            background: '#f8fafc',
                            border: '1px solid var(--border-color)',
                        }}
                    >
                        <Link
                            to={`/expert/${product.id}`}
                            style={{
                                display: 'inline-block',
                                color: '#0f172a',
                                fontWeight: 800,
                                textDecoration: 'none',
                                marginBottom: '0.45rem',
                            }}
                        >
                            {product.title}
                        </Link>
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                            {product.startingPrice.toLocaleString()}원부터 · {product.deliveryDays}일
                        </p>
                    </div>
                ))
            ) : (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>아직 등록한 상품이 없습니다.</p>
            )}
        </div>
    )

    const renderRequestCards = (items: ServiceRequestData[]) => (
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
            {items.length > 0 ? (
                items.map((request) => (
                    <div
                        key={request.id}
                        style={{
                            padding: '1rem',
                            borderRadius: '0.75rem',
                            background: '#f8fafc',
                            border: '1px solid var(--border-color)',
                        }}
                    >
                        <strong style={{ display: 'block', color: '#0f172a', marginBottom: '0.45rem' }}>
                            {request.desiredResult || request.title}
                        </strong>
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                            {request.budget ? `${Number(request.budget).toLocaleString()}원 · ` : ''}
                            마감 {request.deadline || '미정'}
                        </p>
                    </div>
                ))
            ) : (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>아직 받은 상품 의뢰가 없습니다.</p>
            )}
        </div>
    )

    const renderPanel = () => {
        if (activePanel === 'overview') {
            return (
                <section style={cardStyle}>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 1rem' }}>전체 현황</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div style={{ padding: '1rem', borderRadius: '0.75rem', background: '#f8fafc', border: '1px solid var(--border-color)' }}>
                            <strong style={{ display: 'block', color: '#0f172a', marginBottom: '0.4rem' }}>의뢰자 홈</strong>
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                의뢰자 영역은 내가 맡긴 일을 관리하는 곳입니다.
                            </p>
                        </div>
                        <div style={{ padding: '1rem', borderRadius: '0.75rem', background: '#f8fafc', border: '1px solid var(--border-color)' }}>
                            <strong style={{ display: 'block', color: '#0f172a', marginBottom: '0.4rem' }}>전문가 홈</strong>
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                전문가 영역은 내가 받거나 제안한 일을 관리하는 곳입니다.
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem' }}>
                        {[
                            ['받은 제안서', receivedProposals.length],
                            ['진행 중인 작업', activeWorks.length],
                            ['받은 상품 의뢰', receivedProductRequests.length],
                            ['완료된 작업', completedWorks.length],
                        ].map(([label, count]) => (
                            <div key={label} style={{ padding: '1rem', borderRadius: '0.75rem', background: '#f8fafc', border: '1px solid var(--border-color)' }}>
                                <span style={{ display: 'block', color: '#64748b', fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.45rem' }}>
                                    {label}
                                </span>
                                <strong style={{ color: '#0f172a', fontSize: '1.6rem' }}>{count}</strong>
                            </div>
                        ))}
                    </div>
                </section>
            )
        }

        if (activePanel === 'client') {
            return (
                <section style={cardStyle}>
                    <span style={{ display: 'inline-block', color: '#1d4ed8', fontWeight: 800, marginBottom: '0.6rem' }}>
                        내가 맡긴 일
                    </span>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.35rem' }}>의뢰자 홈</h2>
                    <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem' }}>
                        요청을 올린 뒤 받은 제안서와 승인된 작업방을 확인합니다.
                    </p>
                    <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <Link className="btn-text" to={ROUTES.REQUEST_BOARD}>공개 요청 보기</Link>
                        {receivedProposal ? (
                            <Link className="btn-text" to={`/proposal/${receivedProposal.id}`}>제안서 검토하기</Link>
                        ) : (
                            <span style={quickLinkStyle}>받은 제안서 없음</span>
                        )}
                        {activeWork ? (
                            <Link className="btn-text" to={`/workroom/${activeWork.id}`}>작업방 들어가기</Link>
                        ) : (
                            <span style={quickLinkStyle}>진행 중인 작업 없음</span>
                        )}
                    </div>

                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.75rem' }}>제안 단계</h3>
                    {renderProposalCards(receivedProposals, '아직 받은 제안서가 없습니다.')}

                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '1.5rem 0 0.75rem' }}>작업방</h3>
                    {renderWorkCards(activeWorks, '진행 중인 작업이 없습니다.')}
                </section>
            )
        }

        if (activePanel === 'expert') {
            return (
                <section style={cardStyle}>
                    <span style={{ display: 'inline-block', color: '#166534', fontWeight: 800, marginBottom: '0.6rem' }}>
                        내가 수행할 일
                    </span>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.35rem' }}>전문가 홈</h2>
                    <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem' }}>
                        내 상품으로 들어온 의뢰와 내가 보낸 제안서를 확인합니다.
                    </p>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        <Link className="btn-text" to={ROUTES.PROFILE}>내가 등록한 상품</Link>
                        <Link className="btn-text" to={ROUTES.REQUEST_BOARD}>공개 요청 게시판 보기</Link>
                        {sentProposal ? (
                            <Link className="btn-text" to={`/proposal/${sentProposal.id}`}>보낸 제안서 보기</Link>
                        ) : (
                            <span style={quickLinkStyle}>보낸 제안서 없음</span>
                        )}
                        {publicProduct ? (
                            <Link className="btn-text" to={`/expert/${publicProduct.id}`}>공개 상품 보기</Link>
                        ) : (
                            <span style={quickLinkStyle}>공개 상품 없음</span>
                        )}
                    </div>

                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '1.5rem 0 0.75rem' }}>내가 등록한 상품</h3>
                    {renderProductCards(myProducts)}
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '1.5rem 0 0.75rem' }}>전문가 응답 필요</h3>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.75rem', color: '#334155' }}>받은 상품 의뢰</h4>
                    {renderRequestCards(receivedProductRequests)}
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '1.5rem 0 0.75rem' }}>보낸 제안서</h3>
                    {renderProposalCards(sentProposals, '아직 보낸 제안서가 없습니다.')}
                </section>
            )
        }

        if (activePanel === 'workroom') {
            return (
                <section style={cardStyle}>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 1rem' }}>작업방</h2>
                    {renderWorkCards(activeWorks, '진행 중인 작업이 없습니다.')}
                </section>
            )
        }

        return (
            <section style={cardStyle}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 1rem' }}>완료 / 리뷰</h2>
                {renderWorkCards(completedWorks, '완료된 작업이 없습니다.')}
            </section>
        )
    }

    if (loading) {
        return (
            <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
                로딩 중...
            </div>
        )
    }

    if (!session) return null

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 60px)', padding: '4rem 0' }}>
            <main className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>마이페이지</h1>
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                            왼쪽 메뉴에서 필요한 업무 영역을 선택해 확인합니다.
                        </p>
                    </div>
                    <Link to={ROUTES.PROFILE} className="btn-primary" style={{ padding: '0.9rem 1.2rem' }}>
                        프로필 수정하기
                    </Link>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
                    <aside style={{ ...cardStyle, padding: '1.25rem', position: 'sticky', top: '1rem' }}>
                        <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.25rem' }}>
                            <div>
                                <span style={{ display: 'block', fontWeight: 800, color: '#64748b', fontSize: '0.8rem', marginBottom: '0.35rem' }}>닉네임</span>
                                <strong style={{ color: '#1e293b' }}>{name || '미설정'}</strong>
                            </div>
                            <div>
                                <span style={{ display: 'block', fontWeight: 800, color: '#64748b', fontSize: '0.8rem', marginBottom: '0.35rem' }}>접속 계정</span>
                                <strong style={{ color: '#1e293b', wordBreak: 'break-all' }}>{user?.email || ''}</strong>
                            </div>
                            <div>
                                <span style={{ display: 'block', fontWeight: 800, color: '#64748b', fontSize: '0.8rem', marginBottom: '0.35rem' }}>회원 유형</span>
                                <strong style={{ color: isExpert ? '#1e40af' : '#166534' }}>
                                    {isExpert ? '전문가' : '의뢰자'}
                                </strong>
                            </div>
                        </div>

                        <nav aria-label="마이페이지 메뉴" style={{ display: 'grid', gap: '0.45rem' }}>
                            {menuItems.map((item) => {
                                const selected = activePanel === item.id
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => setActivePanel(item.id)}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '0.8rem 0.9rem',
                                            borderRadius: '0.5rem',
                                            border: selected ? '1px solid #2563eb' : '1px solid transparent',
                                            background: selected ? '#eff6ff' : 'transparent',
                                            color: selected ? '#1d4ed8' : '#334155',
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                )
                            })}
                        </nav>

                        <button
                            onClick={() => {
                                signOut()
                                navigate(ROUTES.HOME)
                            }}
                            style={{
                                width: '100%',
                                marginTop: '1.25rem',
                                padding: '0.85rem 1rem',
                                borderRadius: '0.5rem',
                                fontSize: '1rem',
                                background: '#ffe4e6',
                                color: '#e11d48',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 700,
                            }}
                        >
                            로그아웃
                        </button>
                    </aside>

                    <div>
                        {renderPanel()}

                        {reviewOpen && (
                            <section
                                aria-label="리뷰 작성"
                                style={{
                                    marginTop: '1.5rem',
                                    ...cardStyle,
                                }}
                            >
                                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem' }}>리뷰 작성하기</h2>
                                <form
                                    onSubmit={async (event) => {
                                        event.preventDefault()
                                        const reviewWork = selectedReviewWork || completedWork
                                        if (!reviewWork) return
                                        const newReview: Review = {
                                            id: `review-${Date.now()}`,
                                            workId: reviewWork.id,
                                            clientId: reviewWork.clientId || user?.id || '',
                                            expertId: reviewWork.expertId,
                                            rating: Number(reviewRating) as 1 | 2 | 3 | 4 | 5,
                                            content: reviewContent,
                                            createdAt: new Date().toISOString(),
                                        }
                                        await saveReview(newReview)
                                        setReviews((current) => [newReview, ...current])
                                        setReviewSubmitted(true)
                                        setReviewOpen(false)
                                        setReviewRating('5')
                                        setReviewContent('')
                                    }}
                                    style={{ display: 'grid', gap: '1rem' }}
                                >
                                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                                        <label htmlFor="review-rating" style={{ fontWeight: 800 }}>
                                            별점
                                        </label>
                                        <select
                                            id="review-rating"
                                            value={reviewRating}
                                            onChange={(event) => setReviewRating(event.target.value)}
                                            style={{
                                                maxWidth: '12rem',
                                                padding: '0.75rem',
                                                borderRadius: '0.5rem',
                                                border: '1px solid var(--border-color)',
                                            }}
                                        >
                                            <option value="5">5점</option>
                                            <option value="4">4점</option>
                                            <option value="3">3점</option>
                                            <option value="2">2점</option>
                                            <option value="1">1점</option>
                                        </select>
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                                        <label htmlFor="review-content" style={{ fontWeight: 800 }}>
                                            리뷰 내용
                                        </label>
                                        <textarea
                                            id="review-content"
                                            value={reviewContent}
                                            onChange={(event) => setReviewContent(event.target.value)}
                                            rows={4}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '0.85rem',
                                                borderRadius: '0.5rem',
                                                border: '1px solid var(--border-color)',
                                                resize: 'vertical',
                                            }}
                                        />
                                    </div>
                                    <button type="submit" className="btn-primary" style={{ justifySelf: 'start', padding: '0.75rem 1rem' }}>
                                        리뷰 등록
                                    </button>
                                </form>
                            </section>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
