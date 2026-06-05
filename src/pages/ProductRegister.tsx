import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AI_CATEGORIES } from '../constants/categories'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { saveExpertProduct } from '../lib/storage'
import type { AiCategoryId, PackageTier, ProductPackage, ExpertProduct } from '../types'

const currency = new Intl.NumberFormat('ko-KR')
const MAX_ATTACHMENT_BYTES = 1024 * 1024

type PackageFormState = {
    enabled: boolean
    price: string
    deliveryDays: string
    revisionCount: string
    included: string
}

const createPackageState = (enabled = false): PackageFormState => ({
    enabled,
    price: '',
    deliveryDays: '',
    revisionCount: '',
    included: '',
})

const packageNames: Record<PackageTier, ProductPackage['name']> = {
    standard: 'Standard',
    deluxe: 'Deluxe',
    premium: 'Premium',
}

export default function ProductRegister() {
    const { session, user, loading } = useAuth()
    const navigate = useNavigate()
    const thumbnailFileRef = useRef<HTMLInputElement | null>(null)
    const referenceFilesRef = useRef<HTMLInputElement | null>(null)
    const [title, setTitle] = useState('')
    const [category, setCategory] = useState<AiCategoryId>('ai-video-shortform')
    const [summary, setSummary] = useState('')
    const [description, setDescription] = useState('')
    const [thumbnailUrl, setThumbnailUrl] = useState('')
    const [aiTools, setAiTools] = useState('')
    const [sampleLinks, setSampleLinks] = useState('')
    const [packages, setPackages] = useState<Record<PackageTier, PackageFormState>>({
        standard: createPackageState(true),
        deluxe: createPackageState(false),
        premium: createPackageState(false),
    })
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        if (!loading && !session) {
            navigate(ROUTES.LOGIN)
        }
    }, [loading, navigate, session])

    const updatePackage = (tier: PackageTier, updates: Partial<PackageFormState>) => {
        setPackages((current) => ({
            ...current,
            [tier]: { ...current[tier], ...updates },
        }))
    }

    const parsePackage = (tier: PackageTier): ProductPackage | null => {
        const form = packages[tier]
        if (!form.enabled) return null

        const price = Number(form.price)
        const deliveryDays = Number(form.deliveryDays)
        const revisionCount = Number(form.revisionCount)
        const included = form.included
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean)

        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(deliveryDays) || deliveryDays <= 0 || !Number.isFinite(revisionCount) || revisionCount < 0 || included.length === 0) {
            throw new Error(`${packageNames[tier]} 패키지 정보를 모두 입력해 주세요.`)
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

        let parsedStandard: ProductPackage
        let parsedDeluxe: ProductPackage | null
        let parsedPremium: ProductPackage | null
        try {
            parsedStandard = parsePackage('standard') as ProductPackage
            parsedDeluxe = parsePackage('deluxe')
            parsedPremium = parsePackage('premium')
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '패키지 정보를 확인해 주세요.')
            return
        }

        setSubmitting(true)
        setErrorMessage('')
        try {
            const thumbnailDataUrl = await readFirstFileAsDataUrl(thumbnailFileRef.current?.files)
            const referenceDataUrls = await readFilesAsDataUrls(referenceFilesRef.current?.files)
            const productId = `product-${user.id}-${Date.now()}`
            const product: ExpertProduct = {
                id: productId,
                expertId: user.id,
                expertName: user.email || '전문가',
                title: title.trim(),
                category,
                summary: summary.trim(),
                description: description.trim(),
                aiTools: parseCommaList(aiTools),
                sampleLinks: [...parseLineList(sampleLinks), ...referenceDataUrls],
                sampleImageUrl: thumbnailDataUrl || thumbnailUrl.trim(),
                startingPrice: parsedStandard.price,
                deliveryDays: parsedStandard.deliveryDays,
                revisionCount: parsedStandard.revisionCount,
                packages: {
                    standard: parsedStandard,
                    deluxe: parsedDeluxe,
                    premium: parsedPremium,
                },
                status: 'published',
            }

            await saveExpertProduct(product)
            navigate(`/expert/${productId}`)
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
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 900, margin: '0 0 0.6rem' }}>상품 등록</h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        샘플 상품과 같은 수준으로 AI 도구, 결과물, 패키지 옵션을 등록합니다.
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={formStyle}>
                    <section style={sectionStyle}>
                        <h2 style={sectionTitleStyle}>기본 정보</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
                            <Field label="상품명">
                                <input value={title} onChange={(event) => setTitle(event.target.value)} required style={inputStyle} />
                            </Field>
                            <Field label="카테고리">
                                <select value={category} onChange={(event) => setCategory(event.target.value as AiCategoryId)} required style={inputStyle}>
                                    {AI_CATEGORIES.map((item) => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                        <Field label="상품 요약">
                            <input value={summary} onChange={(event) => setSummary(event.target.value)} required style={inputStyle} />
                        </Field>
                        <Field label="상품 설명">
                            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} required style={{ ...inputStyle, resize: 'vertical' }} />
                        </Field>
                        <Field label="사용 도구">
                            <input value={aiTools} onChange={(event) => setAiTools(event.target.value)} placeholder="ChatGPT, Runway, Premiere Pro" style={inputStyle} />
                        </Field>
                    </section>

                    <section style={sectionStyle}>
                        <h2 style={sectionTitleStyle}>샘플과 참고자료</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
                            <Field label="썸네일 이미지 URL">
                                <input value={thumbnailUrl} onChange={(event) => setThumbnailUrl(event.target.value)} placeholder="https://example.com/sample.jpg" style={inputStyle} />
                            </Field>
                            <Field label="썸네일 이미지 첨부">
                                <input ref={thumbnailFileRef} type="file" accept="image/*" onChange={clearErrorOnFileChange(setErrorMessage)} style={inputStyle} />
                            </Field>
                        </div>
                        <Field label="샘플 링크">
                            <textarea value={sampleLinks} onChange={(event) => setSampleLinks(event.target.value)} rows={3} placeholder="https://example.com/samples/ai-shortform" style={{ ...inputStyle, resize: 'vertical' }} />
                        </Field>
                        <Field label="참고자료 첨부">
                            <input ref={referenceFilesRef} type="file" multiple onChange={clearErrorOnFileChange(setErrorMessage)} style={inputStyle} />
                        </Field>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 700 }}>
                            첨부 파일은 파일당 1MB 이하의 작은 이미지, 텍스트, PDF 등 참고용 자료만 등록합니다.
                        </p>
                    </section>

                    <section style={sectionStyle}>
                        <h2 style={sectionTitleStyle}>요금 패키지</h2>
                        <PackageFields tier="standard" state={packages.standard} onChange={updatePackage} locked />
                        <PackageFields tier="deluxe" state={packages.deluxe} onChange={updatePackage} />
                        <PackageFields tier="premium" state={packages.premium} onChange={updatePackage} />
                    </section>

                    {packages.standard.price && Number(packages.standard.price) > 0 && (
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 700 }}>
                            시작가 {currency.format(Number(packages.standard.price))}원
                        </p>
                    )}
                    {errorMessage && <p role="alert" style={{ margin: 0, color: '#e11d48', fontWeight: 800 }}>{errorMessage}</p>}

                    <button type="submit" className="btn-primary" disabled={submitting} style={{ justifySelf: 'start', padding: '0.85rem 1.1rem' }}>
                        {submitting ? '등록 중' : '등록하기'}
                    </button>
                </form>
            </section>
        </main>
    )
}

function PackageFields({
    tier,
    state,
    onChange,
    locked = false,
}: {
    tier: PackageTier
    state: PackageFormState
    onChange: (tier: PackageTier, updates: Partial<PackageFormState>) => void
    locked?: boolean
}) {
    const name = packageNames[tier]
    const disabled = !state.enabled

    return (
        <fieldset data-testid={`package-${tier}`} style={{ display: 'grid', gap: '0.9rem', padding: '1rem', borderRadius: '0.85rem', border: '1px solid var(--border-color)' }}>
            <legend style={{ padding: '0 0.4rem', fontWeight: 900 }}>{name}</legend>
            {!locked && (
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontWeight: 800 }}>
                    <input
                        type="checkbox"
                        checked={state.enabled}
                        onChange={(event) => onChange(tier, { enabled: event.target.checked })}
                    />
                    {name} 사용
                </label>
            )}
            {locked && <input type="hidden" value="true" readOnly />}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem' }}>
                <Field label="가격">
                    <input type="number" min="1" value={state.price} onChange={(event) => onChange(tier, { price: event.target.value })} disabled={disabled} required={state.enabled} style={inputStyle} />
                </Field>
                <Field label="작업일">
                    <input type="number" min="1" value={state.deliveryDays} onChange={(event) => onChange(tier, { deliveryDays: event.target.value })} disabled={disabled} required={state.enabled} style={inputStyle} />
                </Field>
                <Field label="수정 횟수">
                    <input type="number" min="0" value={state.revisionCount} onChange={(event) => onChange(tier, { revisionCount: event.target.value })} disabled={disabled} required={state.enabled} style={inputStyle} />
                </Field>
            </div>
            <Field label="포함 항목">
                <textarea value={state.included} onChange={(event) => onChange(tier, { included: event.target.value })} disabled={disabled} required={state.enabled} rows={3} placeholder="한 줄에 하나씩 입력" style={{ ...inputStyle, resize: 'vertical' }} />
            </Field>
        </fieldset>
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

const readFirstFileAsDataUrl = async (files?: FileList | null) => {
    if (!files || files.length === 0) return ''
    return readFileAsDataUrl(files[0])
}

const readFilesAsDataUrls = async (files?: FileList | null) => {
    if (!files || files.length === 0) return []
    return Promise.all(Array.from(files).map(readFileAsDataUrl))
}

const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
        if (file.size > MAX_ATTACHMENT_BYTES) {
            reject(new Error('첨부 파일은 파일당 1MB 이하만 등록할 수 있습니다.'))
            return
        }
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('첨부 파일을 읽지 못했습니다.'))
        reader.readAsDataURL(file)
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

const inputStyle = {
    width: '100%',
    padding: '0.85rem 1rem',
    borderRadius: '0.75rem',
    border: '1px solid var(--border-color)',
    font: 'inherit',
} as const
