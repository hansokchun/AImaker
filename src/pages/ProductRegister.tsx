import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AI_CATEGORIES } from '../constants/categories'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { getExpertProducts, saveExpertProduct } from '../lib/storage'
import type { AiCategoryId, ExpertProduct, PackageTier, ProductPackage } from '../types'

const currency = new Intl.NumberFormat('ko-KR')
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png']
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
    included: productPackage?.included?.join('\n') || '',
})

const packageNames: Record<PackageTier, ProductPackage['name']> = {
    standard: 'Standard',
    deluxe: 'Deluxe',
    premium: 'Premium',
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

    const parsePackage = (tier: PackageTier, form: PackageFormState): ProductPackage => {
        const price = Number(form.price)
        const deliveryDays = Number(form.deliveryDays)
        const revisionCount = Number(form.revisionCount)
        const included = parseLineList(form.included)

        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(deliveryDays) || deliveryDays <= 0 || !Number.isFinite(revisionCount) || revisionCount < 0 || included.length === 0) {
            throw new Error(`${packageNames[tier]} 가격 정보를 모두 입력해 주세요.`)
        }

        return {
            name: packageNames[tier],
            price,
            deliveryDays,
            revisionCount,
            included,
        }
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
            const thumbnailDataUrl = await readFirstFileAsDataUrl(thumbnailFileRef.current?.files, 'main') || existingThumbnailDataUrl
            const referenceDataUrls = await readFilesAsDataUrls(referenceFilesRef.current?.files, 'detail')
            const nextReferenceDataUrls = referenceDataUrls.length > 0 ? referenceDataUrls : existingReferenceDataUrls
            const nextProductId = existingProduct?.id || crypto.randomUUID()
            const product: ExpertProduct = {
                id: nextProductId,
                expertId: user.id,
                expertName: user.email || '전문가',
                title: title.trim(),
                category,
                summary: summary.trim(),
                description: description.trim(),
                aiTools: [],
                sampleLinks: nextReferenceDataUrls,
                sampleImageUrl: thumbnailDataUrl,
                startingPrice: standardPackage.price,
                deliveryDays: standardPackage.deliveryDays,
                revisionCount: standardPackage.revisionCount,
                packages: {
                    standard: standardPackage,
                    deluxe: deluxePackage,
                    premium: premiumPackage,
                },
                status: 'published',
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

    if (loading || !session) return null

    return (
        <main style={{ background: '#f8fafc', minHeight: 'calc(100vh - 60px)', padding: '4rem 0' }}>
            <section className="container" style={{ maxWidth: '980px' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 900, margin: '0 0 0.6rem' }}>{productId ? '상품 수정' : '상품 등록'}</h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        크몽식 서비스 등록처럼 제목, 설명, 이미지, 가격 정보를 중심으로 등록합니다.
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={formStyle}>
                    <Section title="기본 정보">
                        <div style={twoColumnStyle}>
                            <Field label="상품명">
                                <input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="예: AI 숏폼 영상 콘셉트와 1차 시안을 제작해드립니다" style={inputStyle} />
                            </Field>
                            <Field label="카테고리">
                                <select value={category} onChange={(event) => setCategory(event.target.value as AiCategoryId)} required style={inputStyle}>
                                    {AI_CATEGORIES.map((item) => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                        <Field label="서비스 요약">
                            <input value={summary} onChange={(event) => setSummary(event.target.value)} required placeholder="검색 목록에서 보일 짧은 설명" style={inputStyle} />
                        </Field>
                    </Section>

                    <Section title="상세 설명">
                        <Field label="상세 설명">
                            <textarea
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                rows={8}
                                required
                                placeholder={'작업 범위, 진행 방식, 구매자가 준비할 자료, 제외되는 작업을 한 곳에 적어 주세요.\n\n예:\n- 15초 숏폼 콘셉트와 대본 초안을 제공합니다.\n- 참고 영상과 브랜드 톤을 보내주시면 반영합니다.\n- 성우 녹음과 광고 집행은 포함되지 않습니다.'}
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </Field>
                    </Section>

                    <Section title="이미지와 포트폴리오">
                        <Field label="대표 이미지 첨부">
                            <input ref={thumbnailFileRef} type="file" accept="image/jpeg,image/png" onChange={clearErrorOnFileChange(setErrorMessage)} style={inputStyle} />
                        </Field>
                        <Field label="상세 이미지/포트폴리오 첨부">
                            <input ref={referenceFilesRef} type="file" accept="image/jpeg,image/png" multiple onChange={clearErrorOnFileChange(setErrorMessage)} style={inputStyle} />
                        </Field>
                        <div style={guideBoxStyle}>
                            <strong>등록 유의사항</strong>
                            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                대표 이미지는 JPG/PNG, 최소 652x488px 이상이어야 합니다. 4:3 비율은 권장입니다. 외부 연락처, 직접 결제 안내, 최저가/무조건 보장 같은 과장 표현, 타인의 권리를 침해하는 이미지는 넣지 않습니다.
                            </p>
                            <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', fontWeight: 800 }}>
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

                    <Section title="가격 정보">
                        <label style={toggleStyle}>
                            <input
                                type="checkbox"
                                checked={usePackagePricing}
                                onChange={(event) => setUsePackagePricing(event.target.checked)}
                            />
                            패키지 가격 사용
                        </label>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            기본은 단일 가격입니다. 작업 범위가 난이도별로 명확히 나뉘는 경우에만 패키지를 켜서 Standard, Deluxe, Premium을 작성하세요.
                        </p>

                        {usePackagePricing ? (
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                <PackageFields tier="standard" state={packages.standard} onChange={updatePackage} />
                                <PackageFields tier="deluxe" state={packages.deluxe} onChange={updatePackage} />
                                <PackageFields tier="premium" state={packages.premium} onChange={updatePackage} />
                            </div>
                        ) : (
                            <SinglePriceFields state={basePackage} onChange={(updates) => setBasePackage((current) => ({ ...current, ...updates }))} />
                        )}
                    </Section>

                    {(usePackagePricing ? packages.standard.price : basePackage.price) && (
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 700 }}>
                            시작가 {currency.format(Number(usePackagePricing ? packages.standard.price : basePackage.price))}원
                        </p>
                    )}
                    {errorMessage && <p role="alert" style={{ margin: 0, color: '#e11d48', fontWeight: 800 }}>{errorMessage}</p>}

                    <button type="submit" className="btn-primary" disabled={submitting} style={{ justifySelf: 'start', padding: '0.85rem 1.1rem' }}>
                        {submitting ? (productId ? '수정 중' : '등록 중') : (productId ? '수정 저장하기' : '등록하기')}
                    </button>
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
        <div style={{ display: 'grid', gap: '0.9rem' }}>
            <div style={threeColumnStyle}>
                <Field label="가격">
                    <input type="number" min="1" value={state.price} onChange={(event) => onChange({ price: event.target.value })} required style={inputStyle} />
                </Field>
                <Field label="작업일">
                    <input type="number" min="1" value={state.deliveryDays} onChange={(event) => onChange({ deliveryDays: event.target.value })} required style={inputStyle} />
                </Field>
                <Field label="수정 횟수">
                    <input type="number" min="0" value={state.revisionCount} onChange={(event) => onChange({ revisionCount: event.target.value })} required style={inputStyle} />
                </Field>
            </div>
            <Field label="기본 제공 항목">
                <textarea value={state.included} onChange={(event) => onChange({ included: event.target.value })} required rows={3} placeholder="한 줄에 하나씩 입력" style={{ ...inputStyle, resize: 'vertical' }} />
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
        <fieldset data-testid={`package-${tier}`} style={fieldsetStyle}>
            <legend style={{ padding: '0 0.4rem', fontWeight: 900 }}>{name}</legend>
            <div style={threeColumnStyle}>
                <Field label="가격">
                    <input type="number" min="1" value={state.price} onChange={(event) => onChange(tier, { price: event.target.value })} required style={inputStyle} />
                </Field>
                <Field label="작업일">
                    <input type="number" min="1" value={state.deliveryDays} onChange={(event) => onChange(tier, { deliveryDays: event.target.value })} required style={inputStyle} />
                </Field>
                <Field label="수정 횟수">
                    <input type="number" min="0" value={state.revisionCount} onChange={(event) => onChange(tier, { revisionCount: event.target.value })} required style={inputStyle} />
                </Field>
            </div>
            <Field label="포함 항목">
                <textarea value={state.included} onChange={(event) => onChange(tier, { included: event.target.value })} required rows={3} placeholder="한 줄에 하나씩 입력" style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>
        </fieldset>
    )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>{title}</h2>
            {children}
        </section>
    )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 800 }}>
            {label}
            {children}
        </label>
    )
}

const parseCommaList = (value: string) =>
    value.split(',').map((item) => item.trim()).filter(Boolean)

const parseLineList = (value: string) =>
    value.split('\n').map((item) => item.trim()).filter(Boolean)

const clearErrorOnFileChange = (setErrorMessage: (message: string) => void) => (_event: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage('')
}

type ProductImageKind = 'main' | 'detail'

const readFirstFileAsDataUrl = async (files?: FileList | null, kind: ProductImageKind = 'detail') => {
    if (!files || files.length === 0) return ''
    return readFileAsDataUrl(files[0], kind)
}

const readFilesAsDataUrls = async (files?: FileList | null, kind: ProductImageKind = 'detail') => {
    if (!files || files.length === 0) return []
    return Promise.all(Array.from(files).map((file) => readFileAsDataUrl(file, kind)))
}

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
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        throw new Error('이미지는 JPG 또는 PNG 파일만 등록할 수 있습니다.')
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

const formStyle = {
    display: 'grid',
    gap: '1rem',
    background: 'white',
    padding: '2rem',
    borderRadius: '1rem',
    border: '1px solid var(--border-color)',
} as const

const sectionStyle = {
    display: 'grid',
    gap: '1rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid var(--border-color)',
} as const

const sectionTitleStyle = {
    fontSize: '1.2rem',
    fontWeight: 900,
    margin: 0,
} as const

const twoColumnStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '1rem',
} as const

const threeColumnStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.75rem',
} as const

const toggleStyle = {
    display: 'flex',
    gap: '0.55rem',
    alignItems: 'center',
    fontWeight: 900,
} as const

const guideBoxStyle = {
    display: 'grid',
    gap: '0.7rem',
    padding: '1rem',
    borderRadius: '0.85rem',
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
} as const

const fieldsetStyle = {
    display: 'grid',
    gap: '0.9rem',
    padding: '1rem',
    borderRadius: '0.85rem',
    border: '1px solid var(--border-color)',
} as const

const inputStyle = {
    width: '100%',
    padding: '0.85rem 1rem',
    borderRadius: '0.75rem',
    border: '1px solid var(--border-color)',
    font: 'inherit',
} as const
