import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { saveExpertProduct } from '../lib/storage'
import type { AiCategoryId, ExpertProduct } from '../types'

const currency = new Intl.NumberFormat('ko-KR')

export default function ProductRegister() {
    const { session, user, loading } = useAuth()
    const navigate = useNavigate()
    const [title, setTitle] = useState('')
    const [summary, setSummary] = useState('')
    const [description, setDescription] = useState('')
    const [thumbnailUrl, setThumbnailUrl] = useState('')
    const [aiTools, setAiTools] = useState('')
    const [startingPrice, setStartingPrice] = useState('')
    const [deliveryDays, setDeliveryDays] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        if (!loading && !session) {
            navigate(ROUTES.LOGIN)
        }
    }, [loading, navigate, session])

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!user) return

        const price = Number(startingPrice)
        const days = Number(deliveryDays)
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(days) || days <= 0) {
            setErrorMessage('가격과 작업 기간을 올바르게 입력해 주세요.')
            return
        }

        const productId = `product-${user.id}-${Date.now()}`
        const included = [summary.trim() || title.trim()]
        const standardPackage = {
            name: 'Standard' as const,
            price,
            deliveryDays: days,
            revisionCount: 1,
            included,
        }
        const product: ExpertProduct = {
            id: productId,
            expertId: user.id,
            expertName: user.email || '전문가',
            title: title.trim(),
            category: 'ai-video-shortform' as AiCategoryId,
            summary: summary.trim(),
            description: description.trim(),
            aiTools: aiTools
                .split(',')
                .map((tool) => tool.trim())
                .filter(Boolean),
            sampleLinks: [],
            sampleImageUrl: thumbnailUrl.trim(),
            startingPrice: price,
            deliveryDays: days,
            revisionCount: 1,
            packages: {
                standard: standardPackage,
                deluxe: null,
                premium: null,
            },
            status: 'published',
        }

        setSubmitting(true)
        setErrorMessage('')
        try {
            await saveExpertProduct(product)
            navigate(`/expert/${productId}`)
        } catch (error) {
            console.error('상품 등록 실패:', error)
            setErrorMessage('상품을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading || !session) return null

    return (
        <main style={{ background: '#f8fafc', minHeight: 'calc(100vh - 60px)', padding: '4rem 0' }}>
            <section className="container" style={{ maxWidth: '920px' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <h1 style={{ fontSize: '2.25rem', fontWeight: 900, margin: '0 0 0.6rem' }}>상품 등록</h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        등록한 상품은 AI 작업 찾기와 내 상품관리에서 공개됩니다.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    style={{
                        display: 'grid',
                        gap: '1rem',
                        background: 'white',
                        padding: '2rem',
                        borderRadius: '1rem',
                        border: '1px solid var(--border-color)',
                    }}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
                        <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 800 }}>
                            상품명
                            <input value={title} onChange={(event) => setTitle(event.target.value)} required style={inputStyle} />
                        </label>
                        <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 800 }}>
                            썸네일 이미지 URL
                            <input value={thumbnailUrl} onChange={(event) => setThumbnailUrl(event.target.value)} placeholder="https://example.com/sample.jpg" style={inputStyle} />
                        </label>
                    </div>
                    <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 800 }}>
                        상품 요약
                        <input value={summary} onChange={(event) => setSummary(event.target.value)} required style={inputStyle} />
                    </label>
                    <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 800 }}>
                        상품 설명
                        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} required style={{ ...inputStyle, resize: 'vertical' }} />
                    </label>
                    <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 800 }}>
                        사용 도구
                        <input value={aiTools} onChange={(event) => setAiTools(event.target.value)} placeholder="Runway, ChatGPT" style={inputStyle} />
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
                        <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 800 }}>
                            시작 가격
                            <input type="number" min="1" value={startingPrice} onChange={(event) => setStartingPrice(event.target.value)} required style={inputStyle} />
                        </label>
                        <label style={{ display: 'grid', gap: '0.45rem', fontWeight: 800 }}>
                            작업 기간
                            <input type="number" min="1" value={deliveryDays} onChange={(event) => setDeliveryDays(event.target.value)} required style={inputStyle} />
                        </label>
                    </div>

                    {startingPrice && Number(startingPrice) > 0 && (
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 700 }}>
                            시작가 {currency.format(Number(startingPrice))}원
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

const inputStyle = {
    width: '100%',
    padding: '0.85rem 1rem',
    borderRadius: '0.75rem',
    border: '1px solid var(--border-color)',
    font: 'inherit',
} as const
