import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { acceptProposal, getProposal } from '../lib/storage'
import { confirmTossProposalPayment } from '../lib/tossPayments'
import './Proposal.css'

type PaymentResultState =
    | { readonly status: 'confirming' }
    | { readonly status: 'done'; readonly workId: string }
    | { readonly status: 'error'; readonly message: string }

const parseAmount = (value: string | null): number | null => {
    if (!value) return null
    const amount = Number(value)
    return Number.isInteger(amount) && amount > 0 ? amount : null
}

export default function TossPaymentSuccess() {
    const [searchParams] = useSearchParams()
    const [result, setResult] = useState<PaymentResultState>({ status: 'confirming' })

    useEffect(() => {
        let active = true

        const confirmPayment = async () => {
            const paymentKey = searchParams.get('paymentKey')
            const orderId = searchParams.get('orderId')
            const amount = parseAmount(searchParams.get('amount'))

            if (!paymentKey || !orderId || !amount) {
                setResult({ status: 'error', message: '결제 승인 정보가 올바르지 않습니다.' })
                return
            }

            try {
                const confirmation = await confirmTossProposalPayment({ paymentKey, orderId, amount })
                const proposal = await getProposal(confirmation.proposalId)

                if (!proposal) {
                    setResult({ status: 'error', message: '결제된 제안서를 찾을 수 없습니다.' })
                    return
                }

                const workId = await acceptProposal({
                    ...proposal,
                    status: 'accepted',
                    paymentStatus: 'paid',
                    platformFeeRate: 0.12,
                })

                if (active) setResult({ status: 'done', workId })
            } catch (error) {
                if (!active) return

                if (error instanceof Error) {
                    setResult({ status: 'error', message: error.message })
                    return
                }

                setResult({ status: 'error', message: '결제 승인 중 오류가 발생했습니다.' })
            }
        }

        void confirmPayment()

        return () => {
            active = false
        }
    }, [searchParams])

    return (
        <main className="proposal-page">
            <section className="container proposal-result-layout">
                <div className="proposal-main-card proposal-result-card">
                    {result.status === 'confirming' && (
                        <>
                            <span className="proposal-eyebrow">Toss Payments</span>
                            <h1>결제를 승인하고 있습니다.</h1>
                            <p>창을 닫지 말고 잠시만 기다려 주세요.</p>
                        </>
                    )}
                    {result.status === 'done' && (
                        <>
                            <span className="proposal-eyebrow">결제 완료</span>
                            <h1>프로젝트가 열렸습니다.</h1>
                            <p>결제 승인과 작업방 생성이 완료되었습니다.</p>
                            <Link to={`/workroom/${result.workId}`} className="btn-primary">
                                프로젝트로 이동
                            </Link>
                        </>
                    )}
                    {result.status === 'error' && (
                        <>
                            <span className="proposal-eyebrow">결제 확인 필요</span>
                            <h1>결제 승인에 실패했습니다.</h1>
                            <p>{result.message}</p>
                            <Link to={ROUTES.WORK_DASHBOARD} className="proposal-back-link">
                                요청 목록으로 돌아가기
                            </Link>
                        </>
                    )}
                </div>
            </section>
        </main>
    )
}
