import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { getExpertProducts, getProposal, getRequestById, saveProposal, updateProposal } from '../lib/storage'
import type { ExpertProduct, Proposal, ServiceRequestData } from '../types'
import './ServiceRequest.css'
import './Proposal.css'

const currency = new Intl.NumberFormat('ko-KR')

const splitLines = (value: string) =>
    value
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean)

export default function ProposalCreate() {
    const navigate = useNavigate()
    const location = useLocation()
    const [searchParams] = useSearchParams()
    const { user, loading } = useAuth()
    const requestId = searchParams.get('requestId') || ''
    const proposalId = searchParams.get('proposalId') || ''
    const [request, setRequest] = useState<ServiceRequestData | null>(null)
    const [proposal, setProposal] = useState<Proposal | null>(null)
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
    const isEditMode = Boolean(proposal)

    useEffect(() => {
        if (!loading && !user) {
            navigate(ROUTES.LOGIN)
        }
    }, [loading, navigate, user])

    useEffect(() => {
        let active = true
        setIsLoaded(false)
        setErrorMessage('')

        const proposalPromise = proposalId ? getProposal(proposalId) : Promise.resolve(null)

        Promise.all([proposalPromise, getExpertProducts()])
            .then(async ([loadedProposal, products]) => {
                if (!active) return
                const targetRequestId = loadedProposal?.requestId || requestId
                const loadedRequest = targetRequestId ? await getRequestById(targetRequestId) : null
                if (!active) return
                if (!loadedRequest) {
                    setErrorMessage('제안서를 작성할 의뢰서를 찾을 수 없습니다.')
                    return
                }

                const loadedProduct = products.find((item) => item.id === loadedRequest.productId) || null
                const standardPackage = loadedProduct?.packages.standard

                setRequest(loadedRequest)
                setProposal(loadedProposal)
                setProduct(loadedProduct)
                setTitle(loadedProposal?.title || `${loadedRequest.desiredResult || loadedRequest.title} 제안서`)
                setScope(loadedProposal?.scope || loadedRequest.description || loadedRequest.purpose || '의뢰 요구사항에 맞춰 작업 범위와 조건을 제안합니다.')
                setDeliverables((loadedProposal?.deliverables?.length ? loadedProposal.deliverables : standardPackage?.included?.length ? standardPackage.included : [loadedRequest.desiredResult || loadedRequest.title]).join('\n'))
                setTotalPrice(String(loadedProposal?.totalPrice || standardPackage?.price || loadedRequest.budget || loadedProduct?.startingPrice || ''))
                setDeliveryDays(String(loadedProposal?.deliveryDays || standardPackage?.deliveryDays || loadedProduct?.deliveryDays || 1))
                setRevisionCount(String(loadedProposal?.revisionCount ?? standardPackage?.revisionCount ?? loadedProduct?.revisionCount ?? 1))
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
    }, [proposalId, requestId])

    const returnTo = useMemo(() => {
        const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
        if (from && [ROUTES.MY_PAGE, ROUTES.WORK_DASHBOARD].includes(from.pathname || '')) {
            return `${from.pathname}${from.search || ''}`
        }

        const params = new URLSearchParams()
        params.set('role', 'expert')
        params.set('panel', 'client')
        const targetRequestId = request?.id || proposal?.requestId || requestId
        if (targetRequestId) params.set('expertRequest', String(targetRequestId))
        return `${ROUTES.WORK_DASHBOARD}?${params.toString()}`
    }, [location.state, proposal?.requestId, request?.id, requestId])

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
        const nextProposal: Proposal = {
            id: proposal?.id || `proposal-${request.id}-${Date.now()}`,
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
            status: proposal ? 'revision_requested' : 'sent',
            paymentStatus: proposal?.paymentStatus || 'unpaid',
            expiresAt: expiresAt.toISOString(),
        }

        setSubmitting(true)
        setErrorMessage('')
        try {
            const savedProposalId = proposal ? nextProposal.id : await saveProposal(nextProposal)
            if (proposal) await updateProposal(nextProposal)
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
        <div className="proposal-page proposal-create-page">
            <main className="container proposal-create-shell">
                <form className="proposal-create-form" onSubmit={handleSubmit}>
                    <header className="proposal-create-header">
                        <Link to={returnTo} className="proposal-back-link proposal-create-return">
                            거래관리로 돌아가기
                        </Link>
                        <span className="proposal-eyebrow">{isEditMode ? '제안서 수정' : '새 제안서'}</span>
                        <h1>{isEditMode ? '제안서 수정' : '제안서 작성'}</h1>
                        <p>
                            {isEditMode
                                ? '기존 제안서를 불러와 작성 페이지와 같은 양식으로 수정합니다. 저장하면 의뢰자에게 수정된 제안서 도착 알림이 전달됩니다.'
                                : '의뢰 내용을 확인하고 작업 범위, 제출물, 금액, 일정을 한 번에 정리합니다.'}
                        </p>
                    </header>

                    <div className="proposal-create-layout">
                        <div className="proposal-create-main">
                            <section aria-label="제안서 핵심 정보" className="proposal-create-summary">
                                <div>
                                    <span>대상 상품</span>
                                    <strong>{product?.title || request?.title}</strong>
                                </div>
                                <div>
                                    <span>제안 금액</span>
                                    <strong>{totalPrice ? `${currency.format(Number(totalPrice))}원` : '미정'}</strong>
                                </div>
                                <div>
                                    <span>작업 기간</span>
                                    <strong>{deliveryDays ? `${deliveryDays}일` : '미정'}</strong>
                                </div>
                            </section>

                            <section className="proposal-create-panel">
                                <h2>의뢰 내용</h2>
                                <p>{request?.desiredResult || request?.title}</p>
                                {request?.description && <p>{request.description}</p>}
                            </section>

                            {errorMessage && <p className="proposal-create-error">{errorMessage}</p>}

                            <section className="proposal-create-panel">
                                <h2>제안 내용</h2>
                                <label className="proposal-field">
                                    제안서 제목
                                    <input value={title} onChange={(event) => setTitle(event.target.value)} />
                                </label>

                                <label className="proposal-field">
                                    작업 범위
                                    <textarea rows={6} value={scope} onChange={(event) => setScope(event.target.value)} />
                                </label>

                                <label className="proposal-field">
                                    제출물
                                    <textarea rows={5} value={deliverables} onChange={(event) => setDeliverables(event.target.value)} />
                                </label>
                            </section>

                            <section className="proposal-create-panel">
                                <h2>금액과 일정</h2>
                                <div className="proposal-create-fields">
                                    <label className="proposal-field">
                                        금액
                                        <input type="number" min="0" value={totalPrice} onChange={(event) => setTotalPrice(event.target.value)} />
                                    </label>
                                    <label className="proposal-field">
                                        작업일
                                        <input type="number" min="1" value={deliveryDays} onChange={(event) => setDeliveryDays(event.target.value)} />
                                    </label>
                                    <label className="proposal-field">
                                        수정 횟수
                                        <input type="number" min="0" value={revisionCount} onChange={(event) => setRevisionCount(event.target.value)} />
                                    </label>
                                </div>
                            </section>
                        </div>

                        <aside className="proposal-create-side" aria-label="제출 전 확인">
                            <strong>{isEditMode ? '수정 제안서' : '보낼 제안서'}</strong>
                            <p>
                                {isEditMode
                                    ? '수정 저장 시 의뢰자에게 수정된 제안서 알림이 갑니다.'
                                    : '제안서를 보내면 의뢰자가 승인 및 테스트 결제를 진행할 수 있습니다.'}
                            </p>
                            <dl>
                                <div>
                                    <dt>금액</dt>
                                    <dd>{totalPrice ? `${currency.format(Number(totalPrice))}원` : '미정'}</dd>
                                </div>
                                <div>
                                    <dt>작업일</dt>
                                    <dd>{deliveryDays || '미정'}일</dd>
                                </div>
                                <div>
                                    <dt>수정</dt>
                                    <dd>{revisionCount || '0'}회</dd>
                                </div>
                            </dl>
                            <button type="submit" className="btn-primary" disabled={submitting}>
                                {submitting ? '저장 중' : isEditMode ? '수정해서 보내기' : '제안서 보내기'}
                            </button>
                            <Link to={returnTo} className="btn-text">
                                취소
                            </Link>
                        </aside>
                    </div>
                </form>
            </main>
        </div>
    )
}
