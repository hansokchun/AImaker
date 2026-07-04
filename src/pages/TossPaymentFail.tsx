import { Link, useSearchParams } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import './Proposal.css'

export default function TossPaymentFail() {
    const [searchParams] = useSearchParams()
    const code = searchParams.get('code') || 'PAYMENT_FAILED'
    const message = searchParams.get('message') || '결제가 승인되지 않았습니다.'

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
                    <Link to={ROUTES.WORK_DASHBOARD} className="proposal-back-link">
                        요청 목록으로 돌아가기
                    </Link>
                </div>
            </section>
        </main>
    )
}
