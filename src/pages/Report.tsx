import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { saveReport } from '../lib/storage'
import type { AdminReportTargetType } from '../lib/adminStorage'
import './Report.css'

export default function Report() {
    const navigate = useNavigate()
    const { user, loading } = useAuth()
    const [targetType, setTargetType] = useState<AdminReportTargetType>('user')
    const [targetId, setTargetId] = useState('')
    const [reason, setReason] = useState('')
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (!loading && !user) navigate(ROUTES.LOGIN)
    }, [loading, navigate, user])

    const handleTargetTypeChange = (value: string) => {
        switch (value) {
            case 'user':
            case 'product':
            case 'consultation':
            case 'work':
            case 'review':
                setTargetType(value)
                break
        }
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!user || submitting) return

        const nextReason = reason.trim()
        if (!nextReason) {
            setError('신고 내용을 입력해주세요.')
            return
        }

        setSubmitting(true)
        setError('')
        setMessage('')
        try {
            await saveReport({
                reporterId: user.id,
                targetType,
                targetId,
                reason: nextReason,
                severity: 'medium',
            })
            setMessage('신고가 접수되었습니다. 관리자가 내용을 확인합니다.')
            setTargetId('')
            setReason('')
        } catch (reportError) {
            setError(reportError instanceof Error ? reportError.message : '신고를 접수하지 못했습니다.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <main className="report-page">
            <section className="container report-shell">
                <div className="report-header">
                    <Link to={ROUTES.HOME} className="report-back-link">돌아가기</Link>
                    <h1>신고하기</h1>
                    <p>불편하거나 정책 위반이 의심되는 내용을 관리자에게 전달합니다.</p>
                </div>

                <form className="report-card" onSubmit={handleSubmit}>
                    <label className="report-field">
                        신고 유형
                        <select value={targetType} onChange={(event) => handleTargetTypeChange(event.target.value)}>
                            <option value="user">사용자</option>
                            <option value="product">상품</option>
                            <option value="consultation">상담 채팅</option>
                            <option value="work">작업방</option>
                            <option value="review">리뷰</option>
                        </select>
                    </label>

                    <label className="report-field">
                        신고 대상 ID
                        <input
                            value={targetId}
                            onChange={(event) => setTargetId(event.target.value)}
                            placeholder="모르면 비워두세요."
                        />
                    </label>

                    <label className="report-field">
                        신고 내용
                        <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            rows={7}
                            placeholder="어떤 문제가 있었는지 간단히 적어주세요."
                        />
                    </label>

                    {error && <p role="alert" className="report-feedback is-error">{error}</p>}
                    {message && <p className="report-feedback is-success">{message}</p>}

                    <button type="submit" className="btn-primary report-submit" disabled={submitting}>
                        {submitting ? '접수 중' : '신고 접수'}
                    </button>
                </form>
            </section>
        </main>
    )
}
