import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { reportTossProposalPaymentFailure } from '../lib/tossPayments'
import './Proposal.css'

export default function TossPaymentFail() {
    const [searchParams] = useSearchParams()
    const code = searchParams.get('code') || 'PAYMENT_FAILED'
    const message = searchParams.get('message') || '결제가 승인되지 않았습니다.'
    const orderId = searchParams.get('orderId')
    const [syncMessage, setSyncMessage] = useState('')

    useEffect(() => {
        let active = true
        if (!orderId) return () => {
            active = false
        }

        reportTossProposalPaymentFailure({ orderId, code, message })
            .then((result) => {
                if (!active) return
                setSyncMessage(result.status === 'approved'
                    ? '이미 승인된 결제 주문입니다.'
                    : '결제 실패 상태를 저장했습니다.')
            })
            .catch(() => {
                if (active) setSyncMessage('결제 실패 상태 저장을 확인하지 못했습니다.')
            })

        return () => {
            active = false
        }
    }, [code, message, orderId])

    return (
        <main className="proposal-page">
            <section className="container proposal-result-layout">
                <div className="proposal-main-card proposal-result-card">
                    <span className="proposal-eyebrow">Toss Payments</span>
                    <h1>결제가 완료되지 않았습니다.</h1>
                    <dl className="proposal-fail-reason">
                        <div>
                            <dt>오류 코드</dt>
                            <dd>{code}</dd>
                        </div>
                        <div>
                            <dt>사유</dt>
                            <dd>{message}</dd>
                        </div>
                    </dl>
                    {syncMessage && <p>{syncMessage}</p>}
                    <Link to={ROUTES.WORK_DASHBOARD} className="proposal-back-link">
                        요청 목록으로 돌아가기
                    </Link>
                </div>
            </section>
        </main>
    )
}
