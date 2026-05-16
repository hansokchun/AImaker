import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function MyPage() {
    const { session, user, loading, signOut } = useAuth()
    const navigate = useNavigate()
    const [isExpert, setIsExpert] = useState(false)
    const [name, setName] = useState('')
    const [reviewOpen, setReviewOpen] = useState(false)
    const [reviewSubmitted, setReviewSubmitted] = useState(false)
    const [reviewRating, setReviewRating] = useState('5')
    const [reviewContent, setReviewContent] = useState('')

    useEffect(() => {
        if (!loading && !session) {
            navigate(ROUTES.LOGIN)
        }
    }, [session, loading, navigate])

    useEffect(() => {
        if (user && supabase) {
            fetchProfile()
        }
    }, [user])

    const fetchProfile = async () => {
        if (!supabase || !user) return
        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (data) {
            setIsExpert(data.is_expert)
            setName(data.name || '')
        } else if (error && error.code !== 'PGRST116') {
            console.error('프로필 로딩 오류:', error)
        }
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
                            의뢰, 제안, 진행 중인 작업을 한 곳에서 확인합니다.
                        </p>
                    </div>
                    <Link to={ROUTES.PROFILE} className="btn-primary" style={{ padding: '0.9rem 1.2rem' }}>
                        프로필 수정하기
                    </Link>
                </div>

                <section style={{ background: 'white', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem' }}>
                        <div>
                            <span style={{ display: 'block', fontWeight: 800, color: '#64748b', fontSize: '0.85rem', marginBottom: '0.4rem' }}>닉네임</span>
                            <strong style={{ color: '#1e293b' }}>{name || '미설정'}</strong>
                        </div>
                        <div>
                            <span style={{ display: 'block', fontWeight: 800, color: '#64748b', fontSize: '0.85rem', marginBottom: '0.4rem' }}>접속 계정</span>
                            <strong style={{ color: '#1e293b' }}>{user?.email || ''}</strong>
                        </div>
                        <div>
                            <span style={{ display: 'block', fontWeight: 800, color: '#64748b', fontSize: '0.85rem', marginBottom: '0.4rem' }}>회원 유형</span>
                            <strong style={{ color: isExpert ? '#1e40af' : '#166534' }}>
                                {isExpert ? '전문가' : '의뢰자'}
                            </strong>
                        </div>
                    </div>
                </section>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1.5rem' }}>
                    <section style={{ background: 'white', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem' }}>의뢰자</h2>
                        <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <Link className="btn-text" to={ROUTES.REQUEST_BOARD}>내 의뢰 요청</Link>
                            <Link className="btn-text" to="/proposal/proposal-demo-01">받은 제안서</Link>
                            <Link className="btn-text" to="/workroom/work-demo-01">진행 중인 작업</Link>
                        </div>

                        <div data-testid="active-work" style={{ padding: '1rem', borderRadius: '0.75rem', background: '#f8fafc', marginBottom: '0.75rem' }}>
                            <strong>AI 숏폼 영상 제작</strong>
                            <p style={{ color: 'var(--text-secondary)', margin: '0.4rem 0 0' }}>진행 중</p>
                        </div>
                        <div data-testid="completed-work" style={{ padding: '1rem', borderRadius: '0.75rem', background: '#f0fdf4' }}>
                            <strong>AI 캐릭터 이미지 제작</strong>
                            <p style={{ color: 'var(--text-secondary)', margin: '0.4rem 0 0.8rem' }}>완료</p>
                            <button
                                type="button"
                                className="btn-primary"
                                style={{ padding: '0.65rem 0.9rem' }}
                                onClick={() => {
                                    setReviewOpen(true)
                                    setReviewSubmitted(false)
                                }}
                            >
                                리뷰 작성
                            </button>
                            {reviewSubmitted && (
                                <p style={{ color: '#166534', fontWeight: 800, margin: '0.8rem 0 0' }}>
                                    리뷰가 등록되었습니다.
                                </p>
                            )}
                        </div>
                    </section>

                    <section style={{ background: 'white', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
                        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem' }}>전문가</h2>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            <Link className="btn-text" to={ROUTES.PROFILE}>내가 등록한 상품</Link>
                            <Link className="btn-text" to={ROUTES.REQUEST_BOARD}>받은 요청</Link>
                            <Link className="btn-text" to="/proposal/proposal-demo-01">보낸 제안서</Link>
                            <Link className="btn-text" to={`/expert/${user?.id}`}>공개 프로필 보기</Link>
                        </div>
                    </section>
                </div>

                {reviewOpen && (
                    <section
                        aria-label="리뷰 작성"
                        style={{
                            marginTop: '1.5rem',
                            background: 'white',
                            padding: '2rem',
                            borderRadius: '1rem',
                            border: '1px solid var(--border-color)',
                        }}
                    >
                        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem' }}>리뷰 작성하기</h2>
                        <form
                            onSubmit={(event) => {
                                event.preventDefault()
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

                <button
                    onClick={() => {
                        signOut()
                        navigate(ROUTES.HOME)
                    }}
                    style={{ marginTop: '1.5rem', padding: '0.85rem 1.2rem', borderRadius: '0.5rem', fontSize: '1rem', background: '#ffe4e6', color: '#e11d48', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                >
                    로그아웃
                </button>
            </main>
        </div>
    )
}
