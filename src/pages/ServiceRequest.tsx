import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AI_CATEGORIES } from '../constants/categories'
import { EXTERNAL_CONTACT_WARNING, hasExternalContactInFields } from '../constants/policies'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { PageLoading } from '../components/PageLoading'
import { getCachedExpertProducts, getRequestById, saveRequest, updateRequest } from '../lib/storage'
import { getMarketplaceProductSummaries } from '../lib/marketplaceProducts'
import type { ExpertProduct, ServiceRequestData } from '../types'
import './ServiceRequest.css'

const currency = new Intl.NumberFormat('ko-KR')

export default function ServiceRequest() {
    const navigate = useNavigate()
    const { productId } = useParams<{ productId: string }>()
    const [searchParams] = useSearchParams()
    const { user } = useAuth()
    const editRequestId = searchParams.get('requestId')
    const [products, setProducts] = useState<ExpertProduct[]>(() => getCachedExpertProducts())
    const [productsLoaded, setProductsLoaded] = useState(false)
    const selectedProduct = products.find((product) => product.id === productId)
    const selectedPackage = selectedProduct?.packages.standard
    const selectedCategoryName = useMemo(() => {
        return AI_CATEGORIES.find((category) => category.id === selectedProduct?.category)?.name
    }, [selectedProduct?.category])

    const [selectedCategories, setSelectedCategories] = useState<string[]>(
        selectedCategoryName ? [selectedCategoryName] : [],
    )
    const [desiredResult, setDesiredResult] = useState<string>('')
    const [purpose, setPurpose] = useState<string>('')
    const [referenceText, setReferenceText] = useState<string>('')
    const [deadline, setDeadline] = useState<string>('')
    const [progressType, setProgressType] = useState<'single' | 'milestone'>('single')
    const [budget, setBudget] = useState<string>(selectedPackage ? String(selectedPackage.price) : '')
    const [editingRequest, setEditingRequest] = useState<ServiceRequestData | null>(null)
    const isReceivedRequestReadonly = Boolean(editingRequest?.clientId && user?.id !== editingRequest.clientId)

    useEffect(() => {
        let active = true
        setProductsLoaded(false)
        getMarketplaceProductSummaries()
            .then((items) => {
                if (active) setProducts(items)
                if (active) setProductsLoaded(true)
            })
            .catch(() => {
                if (active) setProductsLoaded(true)
            })
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        if (selectedCategoryName) {
            setSelectedCategories([selectedCategoryName])
        }
    }, [selectedCategoryName])

    useEffect(() => {
        if (selectedPackage) {
            setBudget(String(selectedPackage.price))
        }
    }, [selectedPackage])

    useEffect(() => {
        if (!editRequestId) return
        let active = true

        getRequestById(editRequestId).then((request) => {
            if (!active || !request) return
            setEditingRequest(request)
            setSelectedCategories(request.categories || (selectedCategoryName ? [selectedCategoryName] : []))
            setDesiredResult(request.desiredResult || request.title)
            setPurpose(request.purpose || request.description)
            setReferenceText(request.referenceText || '')
            setDeadline(request.deadline || '')
            setProgressType(request.progressType || 'single')
            setBudget(request.budget || (selectedPackage ? String(selectedPackage.price) : ''))
        })

        return () => {
            active = false
        }
    }, [editRequestId, selectedCategoryName, selectedPackage])

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        if (!selectedProduct) {
            alert('상품 상세 화면에서 의뢰를 시작해주세요.')
            return
        }

        if (hasExternalContactInFields([desiredResult, purpose, referenceText])) {
            alert(EXTERNAL_CONTACT_WARNING)
            return
        }

        if (!user) {
            alert('로그인 후 의뢰 요청을 제출할 수 있습니다.')
            return
        }

        if (isReceivedRequestReadonly) {
            alert('의뢰서를 작성한 의뢰자만 수정할 수 있습니다.')
            return
        }

        const referenceLinks = referenceText
            .split(/\s+/)
            .map((item) => item.trim())
            .filter((item) => item.startsWith('http://') || item.startsWith('https://'))

        const newRequest: ServiceRequestData = {
            id: editingRequest?.id || Date.now(),
            title: selectedProduct?.title ?? desiredResult,
            description: purpose,
            budget,
            deadline,
            categories: selectedCategories,
            createdAt: editingRequest?.createdAt || new Date().toISOString(),
            updatedAt: editingRequest ? new Date().toISOString() : undefined,
            ordererEmail: '',
            clientId: editingRequest?.clientId || user.id,
            status: 'pending',
            productId: selectedProduct?.id,
            expertId: editingRequest?.expertId || selectedProduct?.expertId,
            selectedPackage: 'standard',
            desiredResult,
            purpose,
            referenceText,
            referenceLinks,
            progressType,
        }

        try {
            if (editingRequest) {
                await updateRequest(newRequest, user.id)
                alert('의뢰서를 수정했습니다. 전문가가 수정된 내용을 확인할 수 있습니다.')
                navigate(`${ROUTES.WORK_DASHBOARD}?panel=client&clientOrder=${newRequest.id}`)
                return
            }

            await saveRequest(newRequest, user.id)
            alert('요구사항이 상품 등록 전문가에게 전달되었습니다. 제안서를 기다려주세요.')
            navigate(`${ROUTES.WORK_DASHBOARD}?panel=client&clientOrder=${newRequest.id}`)
        } catch (error) {
            alert(error instanceof Error ? error.message : '요구사항 저장에 실패했습니다.')
        }
    }

    if (productId && !productsLoaded && !selectedProduct) {
        return (
            <PageLoading
                title="상품 정보를 불러오는 중입니다"
                description="의뢰서에 필요한 상품 조건을 확인하고 있습니다."
            />
        )
    }

    if (productId && productsLoaded && !selectedProduct) {
        return (
            <div className="request-page">
                <main className="container request-main">
                    <section className="content-card request-form-card">
                        <h1>상품을 찾을 수 없습니다</h1>
                        <p>존재하지 않거나 더 이상 공개되지 않은 AI 작업입니다.</p>
                        <Link to={ROUTES.CATEGORY} className="btn-primary">
                            AI 작업 찾기로 돌아가기
                        </Link>
                    </section>
                </main>
            </div>
        )
    }

    if (isReceivedRequestReadonly) {
        return (
            <div className="request-page">
                <div className="page-hero request-hero">
                    <div className="container">
                        <h1 className="page-title">받은 의뢰서 확인</h1>
                        <p>의뢰자가 보낸 요구사항을 확인하고 제안서를 작성할 수 있습니다.</p>
                    </div>
                </div>

                <main className="container request-main">
                    <section className="content-card request-form-card">
                        {selectedProduct && selectedPackage ? (
                            <div className="selected-package-summary" aria-label="선택한 패키지 요약">
                                <div>
                                    <span>의뢰 상품</span>
                                    <h2>{selectedProduct.title}</h2>
                                </div>
                                <dl>
                                    <div>
                                        <dt>패키지</dt>
                                        <dd>{selectedPackage.name}</dd>
                                    </div>
                                    <div>
                                        <dt>금액</dt>
                                        <dd>{currency.format(Number(budget || selectedPackage.price))}원</dd>
                                    </div>
                                    <div>
                                        <dt>마감</dt>
                                        <dd>{deadline || '미정'}</dd>
                                    </div>
                                </dl>
                            </div>
                        ) : null}

                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <section>
                                <h2 style={{ fontSize: '1rem', margin: '0 0 0.4rem' }}>원하는 결과물</h2>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                    {desiredResult || '입력된 내용이 없습니다.'}
                                </p>
                            </section>
                            <section>
                                <h2 style={{ fontSize: '1rem', margin: '0 0 0.4rem' }}>작업 목적</h2>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                    {purpose || '입력된 내용이 없습니다.'}
                                </p>
                            </section>
                            <section>
                                <h2 style={{ fontSize: '1rem', margin: '0 0 0.4rem' }}>참고자료</h2>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                    {referenceText || '입력된 내용이 없습니다.'}
                                </p>
                            </section>
                            <section>
                                <h2 style={{ fontSize: '1rem', margin: '0 0 0.4rem' }}>진행 방식</h2>
                                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                                    {progressType === 'milestone' ? '단계별 진행' : '단일 진행'}
                                </p>
                            </section>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
                            {selectedProduct ? (
                                <Link className="btn-text" to={`/expert/${selectedProduct.id}`}>
                                    상품 보기
                                </Link>
                            ) : null}
                            {editingRequest ? (
                                <Link className="btn-primary" to={`${ROUTES.WORK_DASHBOARD}?role=expert&panel=client&expertRequest=${editingRequest.id}`}>
                                    거래관리로 돌아가기
                                </Link>
                            ) : null}
                        </div>
                    </section>
                </main>
            </div>
        )
    }

    return (
        <div className="request-page">
            <div className="page-hero request-hero">
                <div className="container">
                    <h1 className="page-title">{editingRequest ? '의뢰서 수정' : '요구사항 작성'}</h1>
                    <p>결제 전 원하는 결과물과 진행 방식을 정리해 전문가 제안을 받습니다.</p>
                </div>
            </div>

            <main className="container request-main">
                <form onSubmit={handleSubmit} id="request-form" className="request-layout">
                    <section className="content-card request-form-card">
                        {selectedProduct && selectedPackage ? (
                            <div className="selected-package-summary" aria-label="선택한 패키지 요약">
                                <div>
                                    <span>선택한 패키지</span>
                                    <h2>{selectedProduct.title}</h2>
                                </div>
                                <dl>
                                    <div>
                                        <dt>패키지</dt>
                                        <dd>{selectedPackage.name}</dd>
                                    </div>
                                    <div>
                                        <dt>금액</dt>
                                        <dd>{currency.format(selectedPackage.price)}원</dd>
                                    </div>
                                    <div>
                                        <dt>납기</dt>
                                        <dd>{selectedPackage.deliveryDays}일</dd>
                                    </div>
                                </dl>
                            </div>
                        ) : null}

                        <div className="form-group">
                            <label htmlFor="desired-result">
                                <span className="material-symbols-outlined">target</span>
                                원하는 결과물
                            </label>
                            <textarea
                                id="desired-result"
                                aria-label="원하는 결과물"
                                className="form-control"
                                rows={4}
                                placeholder="예: 15초 숏폼 영상 1차 시안, 캐릭터 이미지 3장"
                                required
                                value={desiredResult}
                                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                                    setDesiredResult(e.target.value)
                                }
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="purpose">
                                <span className="material-symbols-outlined">flag</span>
                                작업 목적
                            </label>
                            <textarea
                                id="purpose"
                                aria-label="작업 목적"
                                className="form-control"
                                rows={4}
                                placeholder="어디에 사용할 결과물인지, 어떤 톤과 목표가 필요한지 적어주세요."
                                required
                                value={purpose}
                                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setPurpose(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="reference-text">
                                <span className="material-symbols-outlined">link</span>
                                참고자료
                            </label>
                            <textarea
                                id="reference-text"
                                aria-label="참고자료"
                                className="form-control"
                                rows={4}
                                placeholder="참고 링크, 이미지 설명, 기존 자료의 특징을 적어주세요."
                                value={referenceText}
                                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                                    setReferenceText(e.target.value)
                                }
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="deadline">
                                    <span className="material-symbols-outlined">event_available</span>
                                    마감 희망일
                                </label>
                                <input
                                    id="deadline"
                                    aria-label="마감 희망일"
                                    type="date"
                                    className="form-control"
                                    required
                                    value={deadline}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDeadline(e.target.value)}
                                />
                            </div>

                        </div>

                        <fieldset className="progress-fieldset">
                            <legend>진행 방식</legend>
                            <label>
                                <input
                                    type="radio"
                                    name="progressType"
                                    value="single"
                                    checked={progressType === 'single'}
                                    onChange={() => setProgressType('single')}
                                />
                                단일 진행
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="progressType"
                                    value="milestone"
                                    checked={progressType === 'milestone'}
                                    onChange={() => setProgressType('milestone')}
                                />
                                단계별 진행
                            </label>
                        </fieldset>

                        <p className="platform-notice">
                            플랫폼 외부 연락처를 주고받지 말고, 진행 안내는 긱온 안에서 확인합니다.
                        </p>

                        <button type="submit" className="btn-primary request-submit">
                            {editingRequest ? '의뢰서 수정하기' : '요구사항 제출하기'}
                        </button>
                    </section>
                </form>
            </main>
        </div>
    )
}
