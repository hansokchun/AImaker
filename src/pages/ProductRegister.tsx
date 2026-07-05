import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AI_CATEGORIES } from '../constants/categories'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { deleteExpertProduct, getExpertProducts, saveExpertProduct } from '../lib/storage'
import { attachOptionValuesToPackage, getPackageOptionRows as getPackageComparisonRows } from '../lib/packageOptions'
import type { AiCategoryId, ExpertProduct, PackageTier, ProductPackage } from '../types'
import './ProductRegister.css'

const currency = new Intl.NumberFormat('ko-KR')
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png']
const ACCEPTED_DETAIL_MEDIA_TYPES = ['image/jpeg', 'image/png', 'video/mp4', 'video/webm']
const MAIN_IMAGE_MIN_WIDTH = 652
const MAIN_IMAGE_MIN_HEIGHT = 488

type PackageFormState = {
    price: string
    deliveryDays: string
    revisionCount: string
    included: string
}

const createPackageState = (): PackageFormState => ({
    price: '',
    deliveryDays: '',
    revisionCount: '',
    included: '',
})

const productPackageToFormState = (productPackage?: ProductPackage | null): PackageFormState => ({
    price: productPackage?.price ? String(productPackage.price) : '',
    deliveryDays: productPackage?.deliveryDays ? String(productPackage.deliveryDays) : '',
    revisionCount: productPackage?.revisionCount !== undefined ? String(productPackage.revisionCount) : '',
    included: productPackage?.optionValues
        ? Object.entries(productPackage.optionValues).map(([label, value]) => `${label}: ${value}`).join('\n')
        : productPackage?.included?.join('\n') || '',
})

const packageNames: Record<PackageTier, ProductPackage['name']> = {
    standard: 'Standard',
    deluxe: 'Deluxe',
    premium: 'Premium',
}

const productStatusLabels: Record<ExpertProduct['status'], string> = {
    published: '공개',
    hidden: '숨김',
    draft: '임시저장',
}

export default function ProductRegister() {
    const { session, user, loading } = useAuth()
    const { productId } = useParams<{ productId: string }>()
    const navigate = useNavigate()
    const thumbnailFileRef = useRef<HTMLInputElement | null>(null)
    const referenceFilesRef = useRef<HTMLInputElement | null>(null)
    const [title, setTitle] = useState('')
    const [category, setCategory] = useState<AiCategoryId>('ai-video-shortform')
    const [summary, setSummary] = useState('')
    const [description, setDescription] = useState('')
    const [taxInvoiceAvailable, setTaxInvoiceAvailable] = useState(false)
    const [productStatus, setProductStatus] = useState<ExpertProduct['status']>('published')
    const [usePackagePricing, setUsePackagePricing] = useState(false)
    const [basePackage, setBasePackage] = useState<PackageFormState>(createPackageState)
    const [packages, setPackages] = useState<Record<PackageTier, PackageFormState>>({
        standard: createPackageState(),
        deluxe: createPackageState(),
        premium: createPackageState(),
    })
    const [imageGuideAccepted, setImageGuideAccepted] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [existingProduct, setExistingProduct] = useState<ExpertProduct | null>(null)
    const [existingThumbnailDataUrl, setExistingThumbnailDataUrl] = useState('')
    const [existingReferenceDataUrls, setExistingReferenceDataUrls] = useState<string[]>([])
    const [selectedThumbnailFile, setSelectedThumbnailFile] = useState<File | null>(null)
    const [selectedThumbnailPreviewUrl, setSelectedThumbnailPreviewUrl] = useState('')
    const [selectedReferenceFiles, setSelectedReferenceFiles] = useState<Array<{ file: File; previewUrl: string }>>([])

    useEffect(() => {
        if (!loading && !session) {
            navigate(ROUTES.LOGIN)
        }
    }, [loading, navigate, session])

    useEffect(() => {
        if (!productId || !user) return

        let active = true
        getExpertProducts()
            .then((products) => {
                if (!active) return
                const targetProduct = products.find((item) => item.id === productId) || null
                if (!targetProduct) {
                    setErrorMessage('수정할 상품을 찾을 수 없습니다.')
                    return
                }
                if (targetProduct.expertId !== user.id) {
                    setErrorMessage('내가 등록한 상품만 수정할 수 있습니다.')
                    return
                }

                setExistingProduct(targetProduct)
                setTitle(targetProduct.title)
                setCategory(targetProduct.category)
                setSummary(targetProduct.summary)
                setDescription(targetProduct.description)
                setTaxInvoiceAvailable(Boolean(targetProduct.taxInvoiceAvailable))
                setProductStatus(targetProduct.status)
                setExistingThumbnailDataUrl(targetProduct.sampleImageUrl || '')
                setExistingReferenceDataUrls(targetProduct.sampleLinks || [])

                const hasPackagePricing = Boolean(targetProduct.packages.deluxe || targetProduct.packages.premium)
                setUsePackagePricing(hasPackagePricing)
                if (hasPackagePricing) {
                    setPackages({
                        standard: productPackageToFormState(targetProduct.packages.standard),
                        deluxe: productPackageToFormState(targetProduct.packages.deluxe),
                        premium: productPackageToFormState(targetProduct.packages.premium),
                    })
                } else {
                    setBasePackage(productPackageToFormState(targetProduct.packages.standard))
                }
            })
            .catch(() => {
                if (active) setErrorMessage('상품 정보를 불러오지 못했습니다.')
            })

        return () => {
            active = false
        }
    }, [productId, user])

    const updatePackage = (tier: PackageTier, updates: Partial<PackageFormState>) => {
        setPackages((current) => ({
            ...current,
            [tier]: { ...current[tier], ...updates },
        }))
    }

    const handleThumbnailFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        setErrorMessage('')
        const file = event.target.files?.[0] || null
        setSelectedThumbnailFile(file)
        setSelectedThumbnailPreviewUrl(file ? URL.createObjectURL(file) : '')
    }

    const handleReferenceFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
        setErrorMessage('')
        const nextFiles = Array.from(event.target.files || []).map((file) => ({
            file,
            previewUrl: URL.createObjectURL(file),
        }))
        setSelectedReferenceFiles((current) => [...current, ...nextFiles])
        event.target.value = ''
    }

    const removeExistingReferenceImage = (index: number) => {
        setExistingReferenceDataUrls((current) => current.filter((_, itemIndex) => itemIndex !== index))
    }

    const removeSelectedReferenceImage = (index: number) => {
        setSelectedReferenceFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))
    }

    const parsePackage = (tier: PackageTier, form: PackageFormState): ProductPackage => {
        const price = Number(form.price)
        const deliveryDays = Number(form.deliveryDays)
        const revisionCount = Number(form.revisionCount)
        const included = parseLineList(form.included)

        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(deliveryDays) || deliveryDays <= 0 || !Number.isFinite(revisionCount) || revisionCount < 0 || included.length === 0) {
            throw new Error(`${packageNames[tier]} 가격 정보를 모두 입력해 주세요.`)
        }

        return attachOptionValuesToPackage({
            name: packageNames[tier],
            price,
            deliveryDays,
            revisionCount,
            included,
        })
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!user) return

        let standardPackage: ProductPackage
        let deluxePackage: ProductPackage | null = null
        let premiumPackage: ProductPackage | null = null
        try {
            if (usePackagePricing) {
                standardPackage = parsePackage('standard', packages.standard)
                deluxePackage = parsePackage('deluxe', packages.deluxe)
                premiumPackage = parsePackage('premium', packages.premium)
            } else {
                standardPackage = parsePackage('standard', basePackage)
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '가격 정보를 확인해 주세요.')
            return
        }

        setSubmitting(true)
        setErrorMessage('')
        try {
            const thumbnailDataUrl = selectedThumbnailFile
                ? await readFileAsDataUrl(selectedThumbnailFile, 'main')
                : existingThumbnailDataUrl
            const referenceDataUrls = await Promise.all(selectedReferenceFiles.map((entry) => readFileAsDataUrl(entry.file, 'detail')))
            const nextReferenceDataUrls = referenceDataUrls.length > 0 ? [...existingReferenceDataUrls, ...referenceDataUrls] : existingReferenceDataUrls
            const nextProductId = existingProduct?.id || crypto.randomUUID()
            const product: ExpertProduct = {
                id: nextProductId,
                expertId: user.id,
                expertName: user.email || '전문가',
                title: title.trim(),
                category,
                summary: summary.trim(),
                description: description.trim(),
                sampleLinks: nextReferenceDataUrls,
                sampleImageUrl: thumbnailDataUrl,
                startingPrice: standardPackage.price,
                deliveryDays: standardPackage.deliveryDays,
                revisionCount: standardPackage.revisionCount,
                taxInvoiceAvailable,
                packages: {
                    standard: standardPackage,
                    deluxe: deluxePackage,
                    premium: premiumPackage,
                },
                status: productStatus,
            }

            await saveExpertProduct(product)
            navigate(`/expert/${nextProductId}`)
        } catch (error) {
            console.error('상품 등록 실패:', error)
            setErrorMessage(error instanceof Error ? error.message : '상품을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDeleteProduct = async () => {
        if (!existingProduct) return
        setSubmitting(true)
        setErrorMessage('')
        try {
            await deleteExpertProduct(existingProduct.id)
            navigate(`${ROUTES.WORK_DASHBOARD}?role=expert&panel=products`)
        } catch (error) {
            console.error('상품 삭제 실패:', error)
            setErrorMessage(error instanceof Error ? error.message : '상품을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading || !session) return null

    const pageTitle = productId ? '상품 수정' : '상품 등록'

    return (
        <main className="product-register-page" data-testid="product-register-page">
            <section className="product-register-hero">
                <div className="container product-register-hero-inner">
                    <nav className="product-register-breadcrumb" aria-label="현재 위치">
                        <Link to="/">홈</Link>
                        <span aria-hidden="true">/</span>
                        <span>AI 작업 등록</span>
                    </nav>
                    <p className="product-register-eyebrow">AIConnect Marketplace</p>
                    <h1>{pageTitle}</h1>
                    <p>
                        AI 작업 찾기와 상품 상세에서 바로 비교될 수 있도록 제목, 샘플, 가격, 납기를 명확하게 정리합니다.
                    </p>
                </div>
            </section>

            <section className="container product-register-shell" aria-label={pageTitle}>
                <aside className="product-register-guide" aria-labelledby="product-register-guide-title">
                    <span className="product-register-guide-label">등록 가이드</span>
                    <h2 id="product-register-guide-title">등록 전 확인</h2>
                    <p>AI 작업 찾기에서 비교하기 쉬운 제목, 대표 이미지, 시작가를 먼저 정리하세요.</p>
                    <ol className="product-register-guide-list">
                        <li>
                            <span>1</span>
                            <div>
                                <strong>결과물이 보이는 샘플</strong>
                                <small>대표 이미지는 목록에서 가장 먼저 보입니다.</small>
                            </div>
                        </li>
                        <li>
                            <span>2</span>
                            <div>
                                <strong>작업 범위와 제외 항목</strong>
                                <small>의뢰자가 오해하지 않도록 한 번에 확인하게 합니다.</small>
                            </div>
                        </li>
                        <li>
                            <span>3</span>
                            <div>
                                <strong>시작가와 수정 횟수</strong>
                                <small>저렴한 AI 외주라는 장점을 가격에서 드러냅니다.</small>
                            </div>
                        </li>
                    </ol>
                </aside>

                <form className="product-register-form" aria-label="AI 상품 등록 폼" onSubmit={handleSubmit}>
                    <Section step="1" title="기본 정보">
                        <div className="product-register-two-column">
                            <Field label="상품명">
                                <input className="product-register-input" value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="예: AI 숏폼 영상 콘셉트와 1차 시안을 제작해드립니다" />
                            </Field>
                            <Field label="카테고리">
                                <select className="product-register-input" value={category} onChange={(event) => setCategory(event.target.value as AiCategoryId)} required>
                                    {AI_CATEGORIES.map((item) => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                        <Field label="서비스 요약">
                            <input className="product-register-input" value={summary} onChange={(event) => setSummary(event.target.value)} required placeholder="검색 목록에서 보일 짧은 설명" />
                        </Field>
                    </Section>

                    <Section step="2" title="상세 설명">
                        <Field label="상세 설명">
                            <textarea
                                className="product-register-input product-register-textarea"
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                rows={8}
                                required
                                placeholder={'작업 범위, 진행 방식, 구매자가 준비할 자료, 제외되는 작업을 한 곳에 적어 주세요.\n\n예:\n- 15초 숏폼 콘셉트와 대본 초안을 제공합니다.\n- 참고 영상과 브랜드 톤을 보내주시면 반영합니다.\n- 성우 녹음과 광고 집행은 포함되지 않습니다.'}
                            />
                        </Field>
                    </Section>

                    <Section step="3" title="이미지 등록">
                        <Field label="메인 이미지 첨부">
                            <input className="product-register-input" ref={thumbnailFileRef} type="file" accept="image/jpeg,image/png" onChange={handleThumbnailFileChange} />
                        </Field>
                        {(existingThumbnailDataUrl || selectedThumbnailPreviewUrl) && (
                            <div className="product-register-preview-grid">
                                {selectedThumbnailPreviewUrl ? (
                                    <ImagePreviewCard src={selectedThumbnailPreviewUrl} alt="새 메인 이미지 미리보기" label="교체 예정 메인 이미지" />
                                ) : existingThumbnailDataUrl && (
                                    <ImagePreviewCard src={existingThumbnailDataUrl} alt="현재 대표 이미지" label="현재 메인 이미지" />
                                )}
                            </div>
                        )}
                        <Field label="상세 미디어 첨부">
                            <input className="product-register-input" ref={referenceFilesRef} type="file" accept="image/jpeg,image/png,video/mp4,video/webm" multiple onChange={handleReferenceFilesChange} />
                        </Field>
                        {(existingReferenceDataUrls.length > 0 || selectedReferenceFiles.length > 0) && (
                            <div className="product-register-preview-grid">
                                {existingReferenceDataUrls.map((src, index) => (
                                    <ImagePreviewCard
                                        key={`existing-reference-${src}-${index}`}
                                        src={src}
                                        alt={`현재 상세 미디어 ${index + 1}`}
                                        label={`현재 상세 미디어 ${index + 1}`}
                                        mediaType={isVideoMediaSource(src) ? 'video' : 'image'}
                                        onRemove={() => removeExistingReferenceImage(index)}
                                        removeLabel={`현재 상세 미디어 ${index + 1} 삭제`}
                                    />
                                ))}
                                {selectedReferenceFiles.map((entry, index) => (
                                    <ImagePreviewCard
                                        key={`selected-reference-${entry.previewUrl}-${index}`}
                                        src={entry.previewUrl}
                                        alt={`새 상세 미디어 ${index + 1}`}
                                        label={`추가 예정 상세 미디어 ${index + 1}`}
                                        mediaType={entry.file.type.startsWith('video/') ? 'video' : 'image'}
                                        onRemove={() => removeSelectedReferenceImage(index)}
                                        removeLabel={`새 상세 미디어 ${index + 1} 삭제`}
                                    />
                                ))}
                            </div>
                        )}
                        <div className="product-register-notice">
                            <strong>등록 유의사항</strong>
                            <p>
                                대표 이미지는 JPG/PNG, 최소 652x488px 이상이어야 합니다. 상세 미디어는 JPG/PNG 이미지와 MP4/WebM 영상을 등록할 수 있습니다. 외부 연락처, 직접 결제 안내, 최저가/무조건 보장 같은 과장 표현, 타인의 권리를 침해하는 자료는 넣지 않습니다.
                            </p>
                            <label className="product-register-check-label">
                                <input
                                    type="checkbox"
                                    checked={imageGuideAccepted}
                                    onChange={(event) => setImageGuideAccepted(event.target.checked)}
                                    required
                                />
                                이미지와 설명 등록 유의사항을 확인했습니다
                            </label>
                        </div>
                    </Section>

                    <Section step="4" title="가격 정보">
                        <label className="product-register-toggle">
                            <input
                                type="checkbox"
                                checked={usePackagePricing}
                                onChange={(event) => setUsePackagePricing(event.target.checked)}
                            />
                            패키지 가격 사용
                        </label>
                        <p className="product-register-help-text">
                            기본은 단일 가격입니다. 작업 범위가 난이도별로 명확히 나뉘는 경우에만 패키지를 켜서 Standard, Deluxe, Premium을 작성하세요.
                        </p>

                        {usePackagePricing ? (
                            <div className="product-register-stack">
                                <PackageFields tier="standard" state={packages.standard} onChange={updatePackage} />
                                <PackageFields tier="deluxe" state={packages.deluxe} onChange={updatePackage} />
                                <PackageFields tier="premium" state={packages.premium} onChange={updatePackage} />
                                <PackageOptionPreview packages={packages} />
                            </div>
                        ) : (
                            <SinglePriceFields state={basePackage} onChange={(updates) => setBasePackage((current) => ({ ...current, ...updates }))} />
                        )}
                    </Section>

                    {(usePackagePricing ? packages.standard.price : basePackage.price) && (
                        <p className="product-register-start-price">
                            시작가 {currency.format(Number(usePackagePricing ? packages.standard.price : basePackage.price))}원
                        </p>
                    )}
                    <Section step="5" title="운영 정보">
                        <div className="product-register-two-column">
                            <label className="product-register-toggle">
                                <input
                                    type="checkbox"
                                    checked={taxInvoiceAvailable}
                                    onChange={(event) => setTaxInvoiceAvailable(event.target.checked)}
                                />
                                세금계산서 발행 가능
                            </label>
                            <Field label="공개 상태">
                                <select
                                    className="product-register-input"
                                    value={productStatus}
                                    onChange={(event) => setProductStatus(event.target.value as ExpertProduct['status'])}
                                >
                                    {Object.entries(productStatusLabels).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                    </Section>
                    {errorMessage && <p className="product-register-error" role="alert">{errorMessage}</p>}

                    <div className="product-register-actions">
                        <button type="submit" className="btn-primary product-register-submit" disabled={submitting}>
                            {submitting ? (productId ? '수정 중' : '등록 중') : (productId ? '수정 저장하기' : '등록하기')}
                        </button>
                    </div>

                    {existingProduct && (
                        <section className="product-register-danger-zone">
                            <strong>상품 삭제</strong>
                            <p>
                                삭제한 상품은 AI 작업 찾기와 상품 상세에서 더 이상 공개되지 않습니다.
                            </p>
                            <button
                                className="product-register-danger-button"
                                type="button"
                                onClick={handleDeleteProduct}
                                disabled={submitting}
                            >
                                상품 삭제하기
                            </button>
                        </section>
                    )}
                </form>
            </section>
        </main>
    )
}

function SinglePriceFields({
    state,
    onChange,
}: {
    state: PackageFormState
    onChange: (updates: Partial<PackageFormState>) => void
}) {
    return (
        <div className="product-register-stack product-register-stack-compact">
            <div className="product-register-three-column">
                <Field label="가격">
                    <input className="product-register-input" type="number" min="1" value={state.price} onChange={(event) => onChange({ price: event.target.value })} required />
                </Field>
                <Field label="작업일">
                    <input className="product-register-input" type="number" min="1" value={state.deliveryDays} onChange={(event) => onChange({ deliveryDays: event.target.value })} required />
                </Field>
                <Field label="수정 횟수">
                    <input className="product-register-input" type="number" min="0" value={state.revisionCount} onChange={(event) => onChange({ revisionCount: event.target.value })} required />
                </Field>
            </div>
            <Field label="기본 제공 항목">
                <textarea className="product-register-input product-register-textarea" value={state.included} onChange={(event) => onChange({ included: event.target.value })} required rows={3} placeholder="한 줄에 하나씩 입력" />
            </Field>
        </div>
    )
}

function PackageFields({
    tier,
    state,
    onChange,
}: {
    tier: PackageTier
    state: PackageFormState
    onChange: (tier: PackageTier, updates: Partial<PackageFormState>) => void
}) {
    const name = packageNames[tier]

    return (
        <fieldset className="product-register-package-fieldset" data-testid={`package-${tier}`}>
            <legend>{name}</legend>
            <div className="product-register-three-column">
                <Field label="가격">
                    <input className="product-register-input" type="number" min="1" value={state.price} onChange={(event) => onChange(tier, { price: event.target.value })} required />
                </Field>
                <Field label="작업일">
                    <input className="product-register-input" type="number" min="1" value={state.deliveryDays} onChange={(event) => onChange(tier, { deliveryDays: event.target.value })} required />
                </Field>
                <Field label="수정 횟수">
                    <input className="product-register-input" type="number" min="0" value={state.revisionCount} onChange={(event) => onChange(tier, { revisionCount: event.target.value })} required />
                </Field>
            </div>
            <Field label="포함 항목">
                <textarea className="product-register-input product-register-textarea" value={state.included} onChange={(event) => onChange(tier, { included: event.target.value })} required rows={3} placeholder="한 줄에 하나씩 입력" />
            </Field>
        </fieldset>
    )
}

function PackageOptionPreview({ packages }: { packages: Record<PackageTier, PackageFormState> }) {
    const rows = getPackageOptionRows(packages)

    return (
        <div className="product-register-package-preview" data-testid="package-option-preview">
            <div className="product-register-package-preview-copy">
                <strong>패키지별 포함 항목 비교</strong>
                <span>
                    상위 패키지에만 들어가는 항목은 하위 패키지에서 회색 미포함으로 표시됩니다.
                </span>
            </div>
            <div className="product-register-package-table" role="table" aria-label="패키지 포함 항목 미리보기">
                <div className="product-register-package-row" role="row">
                    <strong role="columnheader">항목</strong>
                    <strong role="columnheader">Standard</strong>
                    <strong role="columnheader">Deluxe</strong>
                    <strong role="columnheader">Premium</strong>
                </div>
                {rows.length > 0 ? rows.map((row) => (
                    <div className="product-register-package-row" key={row.label} role="row">
                        <span className="product-register-package-label" role="cell">{row.label}</span>
                        <PackageOptionCell included={row.available.standard} value={row.values.standard} />
                        <PackageOptionCell included={row.available.deluxe} value={row.values.deluxe} />
                        <PackageOptionCell included={row.available.premium} value={row.values.premium} />
                    </div>
                )) : (
                    <div className="product-register-package-empty">
                        포함 항목을 입력하면 패키지별 비교가 여기에 표시됩니다.
                    </div>
                )}
            </div>
        </div>
    )
}

function PackageOptionCell({ included, value }: { included: boolean; value: string }) {
    return (
        <span className={`product-register-package-cell ${included ? 'is-included' : 'is-excluded'}`} role="cell">
            <span className="material-symbols-outlined" aria-hidden="true">
                {included ? 'check' : 'remove'}
            </span>
            {value}
        </span>
    )
}

function Section({ step, title, children }: { step: string; title: string; children: ReactNode }) {
    return (
        <section className="product-register-section">
            <h2>
                <span>{step}.</span>
                {' '}
                {title}
            </h2>
            {children}
        </section>
    )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="product-register-field">
            {label}
            {children}
        </label>
    )
}

const parseLineList = (value: string) =>
    value.split('\n').map((item) => item.trim()).filter(Boolean)

const getPackageOptionRows = (packages: Record<PackageTier, PackageFormState>) =>
    getPackageComparisonRows({
        standard: createPreviewPackage('standard', packages.standard),
        deluxe: createPreviewPackage('deluxe', packages.deluxe),
        premium: createPreviewPackage('premium', packages.premium),
    })

const createPreviewPackage = (tier: PackageTier, state: PackageFormState): ProductPackage =>
    attachOptionValuesToPackage({
        name: packageNames[tier],
        price: Number(state.price) || 1,
        deliveryDays: Number(state.deliveryDays) || 1,
        revisionCount: Number(state.revisionCount) || 0,
        included: parseLineList(state.included),
    })

const isVideoMediaSource = (src: string) =>
    /^data:video\//i.test(src) || /\.(mp4|webm|ogg)(\?|#|$)/i.test(src)

function ImagePreviewCard({
    src,
    alt,
    label,
    mediaType = 'image',
    onRemove,
    removeLabel,
}: {
    src: string
    alt: string
    label: string
    mediaType?: 'image' | 'video'
    onRemove?: () => void
    removeLabel?: string
}) {
    return (
        <figure className="product-register-preview-card">
            {mediaType === 'video' ? (
                <video src={src} aria-label={alt} controls />
            ) : (
                <img src={src} alt={alt} />
            )}
            <figcaption>
                <span>{label}</span>
                {onRemove && (
                    <button type="button" aria-label={removeLabel || `${label} 삭제`} onClick={onRemove}>
                        삭제
                    </button>
                )}
            </figcaption>
        </figure>
    )
}

type ProductImageKind = 'main' | 'detail'

const readFileAsDataUrl = async (file: File, kind: ProductImageKind) => {
    await validateProductImageFile(file, kind)

    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('첨부 파일을 읽지 못했습니다.'))
        reader.readAsDataURL(file)
    })
}

const validateProductImageFile = async (file: File, _kind: ProductImageKind) => {
    const acceptedTypes = _kind === 'main' ? ACCEPTED_IMAGE_TYPES : ACCEPTED_DETAIL_MEDIA_TYPES
    if (!acceptedTypes.includes(file.type)) {
        throw new Error(_kind === 'main'
            ? '대표 이미지는 JPG 또는 PNG 파일만 등록할 수 있습니다.'
            : '상세 미디어는 JPG, PNG, MP4, WebM 파일만 등록할 수 있습니다.')
    }

    if (_kind === 'main') {
        const { width, height } = await readImageDimensions(file)
        if (
            width < MAIN_IMAGE_MIN_WIDTH ||
            height < MAIN_IMAGE_MIN_HEIGHT
        ) {
            throw new Error('대표 이미지는 크몽 기준에 맞춰 JPG 또는 PNG, 최소 652x488px 이상이어야 합니다.')
        }
    }
}

const readImageDimensions = (file: File) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image()
        const objectUrl = URL.createObjectURL(file)
        image.onload = () => {
            URL.revokeObjectURL(objectUrl)
            resolve({ width: image.width, height: image.height })
        }
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            reject(new Error('이미지 파일을 확인하지 못했습니다. JPG 또는 PNG 파일을 다시 선택해 주세요.'))
        }
        image.src = objectUrl
    })
