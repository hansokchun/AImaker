import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { getExpertProducts, getRequestById, saveProposal } from '../lib/storage'
import type { ExpertProduct, Proposal, ServiceRequestData } from '../types'
import './ServiceRequest.css'

const currency = new Intl.NumberFormat('ko-KR')

const splitLines = (value: string) =>
    value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)

export default function ProposalCreate() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { user, loading } = useAuth()
    const requestId = searchParams.get('requestId') || ''
    const [request, setRequest] = useState<ServiceRequestData | null>(null)
    const [product, setProduct] = useState<ExpertProduct | null>(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [title, setTitle] = useState('')
    const [scope, setScope] = useState('')
    const [deliverables, setDeliverables] = useState('')
    const [totalPrice, setTotalPrice] = useState('')
    const [deliveryDays, setDeliveryDays] = useState('')
    const [revisionCount, setRevisionCount] = useState('')

    useEffect(() => {
        if (!loading && !user) {
            navigate(ROUTES.LOGIN)
        }
    }, [loading, navigate, user])

    useEffect(() => {
        let active = true
        setIsLoaded(false)
        setErrorMessage('')

        Promise.all([getRequestById(requestId), getExpertProducts()])
            .then(([loadedRequest, products]) => {
                if (!active) return
                if (!loadedRequest) {
                    setErrorMessage('제안서를 작성할 의뢰서를 찾을 수 없습니다.')
                    return
                }

                const loadedProduct = products.find((item) => item.id === loadedRequest.productId) || null
                const standardPackage = loadedProduct?.packages.standard

                setRequest(loadedRequest)
                setProduct(loadedProduct)
                setTitle(`${loadedRequest.desiredResult || loadedRequest.title} 제안서`)
                setScope(loadedRequest.description || loadedRequest.purpose || '의뢰 요구사항에 맞춰 작업 범위와 조건을 제안합니다.')
                setDeliverables((standardPackage?.included?.length ? standardPackage.included : [loadedRequest.desiredResult || loadedRequest.title]).join('\n'))
                setTotalPrice(String(standardPackage?.price || loadedRequest.budget || loadedProduct?.startingPrice || ''))
                setDeliveryDays(String(standardPackage?.deliveryDays || loadedProduct?.deliveryDays || 1))
                setRevisionCount(String(standardPackage?.revisionCount ?? loadedProduct?.revisionCount ?? 1))
            })
            .catch(() => {
                if (active) setErrorMessage('제안서 작성 정보를 불러오지 못했습니다.')
            })
            .finally(() => {
                if (active) setIsLoaded(true)
            })

        return () => {
            active = false
        }
    }, [requestId])

    const returnTo = useMemo(() => {
        const params = new URLSearchParams()
        params.set('role', 'expert')
        params.set('panel', 'client')
        if (requestId) params.set('expertRequest', requestId)
        return `${ROUTES.WORK_DASHBOARD}?${params.toString()}`
    }, [requestId])

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!request || !user || submitting) return

        const price = Number(totalPrice)
        const days = Number(deliveryDays)
        const revisions = Number(revisionCount)
        if (!title.trim() || !scope.trim() || !Number.isFinite(price) || price <= 0 || !Number.isFinite(days) || days <= 0) {
            setErrorMessage('제안서 제목, 작업 범위, 금액, 작업일을 확인해 주세요.')
            return
        }

        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 3)
        const proposal: Proposal = {
            id: `proposal-${request.id}-${Date.now()}`,
            requestId: String(request.id),
            clientId: request.clientId || '',
            expertId: user.id,
            title: title.trim(),
            scope: scope.trim(),
            deliverables: splitLines(deliverables).length ? splitLines(deliverables) : [request.desiredResult || request.title],
            totalPrice: price,
            deliveryDays: days,
            revisionCount: Number.isFinite(revisions) && revisions >= 0 ? revisions : 0,
            progressType: request.progressType || 'single',
            milestones: [],
            commercialUseAllowed: true,
            sourceFileIncluded: false,
            status: 'sent',
            paymentStatus: 'unpaid',
            expiresAt: expiresAt.toISOString(),
        }

        setSubmitting(true)
        setErrorMessage('')
        try {
            const savedProposalId = await saveProposal(proposal)
            navigate(`/proposal/${savedProposalId}`, {
                state: {
                    from: {
                        pathname: ROUTES.WORK_DASHBOARD,
                        search: `?role=expert&panel=client&expertRequest=${request.id}`,
                    },
                },
            })
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '제안서 저장에 실패했습니다.')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isLoaded) {
        return (
            <div className="request-page">
                <main className="container request-main">
                    <section className="content-card request-form-card">
                        <h1>제안서 작성 정보를 불러오는 중입니다</h1>
                    </section>
                </main>
            </div>
        )
    }

    if (errorMessage && !request) {
        return (
            <div className="request-page">
                <main className="container request-main">
                    <section className="content-card request-form-card">
                        <h1>제안서를 작성할 수 없습니다</h1>
                        <p>{errorMessage}</p>
                        <Link to={returnTo} className="btn-primary">
                            거래관리로 돌아가기
                        </Link>
                    </section>
                </main>
            </div>
        )
    }

    return (
        <div className="request-page">
            <main className="container request-main">
                <form className="content-card request-form-card" onSubmit={handleSubmit}>
                    <h1>제안서 작성</h1>
                    <p>
                        {product?.title || request?.title} · 예상 금액 {totalPrice ? `${currency.format(Number(totalPrice))}원` : '미정'}
                    </p>

                    {errorMessage && <p style={{ color: '#dc2626', fontWeight: 800 }}>{errorMessage}</p>}

                    <label>
                        제안서 제목
                        <input value={title} onChange={(event) => setTitle(event.target.value)} />
                    </label>

                    <label>
                        작업 범위
                        <textarea rows={6} value={scope} onChange={(event) => setScope(event.target.value)} />
                    </label>

                    <label>
                        제출물
                        <textarea rows={5} value={deliverables} onChange={(event) => setDeliverables(event.target.value)} />
                    </label>

                    <div className="request-inline-grid">
                        <label>
                            금액
                            <input type="number" min="0" value={totalPrice} onChange={(event) => setTotalPrice(event.target.value)} />
                        </label>
                        <label>
                            작업일
                            <input type="number" min="1" value={deliveryDays} onChange={(event) => setDeliveryDays(event.target.value)} />
                        </label>
                        <label>
                            수정 횟수
                            <input type="number" min="0" value={revisionCount} onChange={(event) => setRevisionCount(event.target.value)} />
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button type="submit" className="btn-primary" disabled={submitting}>
                            {submitting ? '저장 중' : '제안서 보내기'}
                        </button>
                        <Link to={returnTo} className="btn-text">
                            취소
                        </Link>
                    </div>
                </form>
            </main>
        </div>
    )
}
