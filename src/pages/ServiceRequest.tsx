import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CategorySelector from '../components/CategorySelector'
import { AI_CATEGORIES } from '../constants/categories'
import { ROUTES } from '../constants/routes'
import { mockExpertProducts } from '../data/mockData'
import { useAuth } from '../contexts/AuthContext'
import { getExpertProducts, saveRequest } from '../lib/storage'
import type { ExpertProduct, ServiceRequestData } from '../types'
import './ServiceRequest.css'

const currency = new Intl.NumberFormat('ko-KR')

export default function ServiceRequest() {
    const navigate = useNavigate()
    const { productId } = useParams<{ productId: string }>()
    const { user } = useAuth()
    const [products, setProducts] = useState<ExpertProduct[]>(mockExpertProducts)
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

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        if (!selectedProduct && selectedCategories.length === 0) {
            alert('최소 하나 이상의 카테고리를 선택해주세요.')
            return
        }

        const referenceLinks = referenceText
            .split(/\s+/)
            .map((item) => item.trim())
            .filter((item) => item.startsWith('http://') || item.startsWith('https://'))

        const newRequest: ServiceRequestData = {
            id: Date.now(),
            title: selectedProduct?.title ?? desiredResult,
            description: purpose,
            budget,
            deadline,
            categories: selectedCategories,
            createdAt: new Date().toLocaleDateString(),
            ordererEmail: '',
            status: 'pending',
            productId: selectedProduct?.id,
            selectedPackage: selectedProduct ? 'standard' : undefined,
            desiredResult,
            purpose,
            referenceText,
            referenceLinks,
            progressType,
        }

        try {
            await saveRequest(newRequest, user?.id)
            alert('요구사항이 제출되었습니다. 전문가 제안을 기다려주세요.')
            navigate(ROUTES.REQUEST_BOARD)
        } catch (error) {
            alert(error instanceof Error ? error.message : '요구사항 저장에 실패했습니다.')
        }
    }

    return (
        <div className="request-page">
            <div className="page-hero request-hero">
                <div className="container">
                    <h1 className="page-title">요구사항 작성</h1>
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
                        ) : (
                            <div className="form-group">
                                <label>
                                    <span className="material-symbols-outlined">category</span>
                                    카테고리 선택
                                </label>
                                <CategorySelector
                                    selected={selectedCategories}
                                    onChange={setSelectedCategories}
                                />
                            </div>
                        )}

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

                            {!selectedPackage && (
                                <div className="form-group">
                                    <label htmlFor="budget">
                                        <span className="material-symbols-outlined">payments</span>
                                        희망 예산
                                    </label>
                                    <input
                                        id="budget"
                                        type="text"
                                        className="form-control"
                                        placeholder="예: 500,000"
                                        required
                                        value={budget ? Number(budget).toLocaleString() : ''}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                            setBudget(e.target.value.replace(/[^\d]/g, ''))
                                        }
                                    />
                                </div>
                            )}
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
                            플랫폼 외부 연락처를 주고받지 말고, 진행 안내는 AIConnect 안에서 확인합니다.
                        </p>

                        <button type="submit" className="btn-primary request-submit">
                            요구사항 제출하기
                        </button>
                    </section>
                </form>
            </main>
        </div>
    )
}
