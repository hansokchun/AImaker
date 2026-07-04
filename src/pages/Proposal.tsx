import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { getProposal, getWorkByProposal } from '../lib/storage'
import { startTossProposalPayment } from '../lib/tossPayments'
import type { Proposal as ProposalData } from '../types'
import './Proposal.css'

const futureExpiry = new Date()
futureExpiry.setDate(futureExpiry.getDate() + 3)

const mockProposals: ProposalData[] = [
    {
        id: 'proposal-demo-01',
        requestId: 'request-demo-01',
        clientId: 'client-demo-01',
        expertId: 'expert-video-01',
        title: 'AI 숏폼 영상 1차 제작 제안',
        scope: '15초 숏폼 영상 콘셉트 정리, 기본 스토리보드, AI 영상 시안 1개 제작',
        deliverables: ['15초 AI 숏폼 영상 시안', '기획 콘셉트 요약', '썸네일 이미지 1장'],
        totalPrice: 70000,
        deliveryDays: 4,
        revisionCount: 2,
        progressType: 'milestone',
        milestones: ['콘셉트 확인', '1차 영상 시안 제출', '수정 반영 후 최종 제출'],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'sent',
        paymentStatus: 'unpaid',
        expiresAt: futureExpiry.toISOString(),
    },
]

const currency = new Intl.NumberFormat('ko-KR')
const PAYMENT_START_TIMEOUT_MS = 20_000

const statusText: Record<ProposalData['status'], string> = {
    sent: '제안 대기',
    revision_requested: '수정 요청됨',
    accepted: '승인됨',
    cancelled: '취소됨',
    expired: '만료된 제안서입니다.',
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(new Date(value))
}

const isMyPageReturnPath = (pathname?: string) =>
    pathname === ROUTES.MY_PAGE || pathname === ROUTES.WORK_DASHBOARD

const withPaymentStartTimeout = async (paymentPromise: Promise<void>) => {
    let timeoutId: number | undefined
    paymentPromise.catch(() => undefined)

    try {
        await Promise.race([
            paymentPromise,
            new Promise<never>((_, reject) => {
                timeoutId = window.setTimeout(() => {
                    reject(new Error('토스페이먼츠 결제창 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'))
                }, PAYMENT_START_TIMEOUT_MS)
            }),
        ])
    } finally {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
}

export default function Proposal() {
    const { proposalId } = useParams<{ proposalId: string }>()
    const location = useLocation()
    const { user } = useAuth()
    const [proposal, setProposal] = useState<ProposalData | null>(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const [isStartingPayment, setIsStartingPayment] = useState(false)
    const [statusMessage, setStatusMessage] = useState('')
    const [createdWorkId, setCreatedWorkId] = useState('')
    const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
    const myPageReturnTo = isMyPageReturnPath(from?.pathname) ? `${from?.pathname}${from?.search || ''}` : ''
    const myPageReturnState = myPageReturnTo ? { from } : undefined

    useEffect(() => {
        let active = true
        setIsLoaded(false)
        setCreatedWorkId('')

        getProposal(proposalId || '').then(async (storedProposal) => {
            if (!active) return

            const nextProposal = storedProposal ?? mockProposals.find((item) => item.id === proposalId) ?? null
            setProposal(nextProposal)

            const existingWork = nextProposal ? await getWorkByProposal(nextProposal.id) : null
            if (!active) return
            setCreatedWorkId(existingWork?.id || '')
            setIsLoaded(true)
        })

        return () => {
            active = false
        }
    }, [proposalId])

    if (!isLoaded) {
        return (
            <main className="proposal-page">
                <section className="container proposal-layout">
                    <div className="proposal-main-card">제안서를 불러오는 중입니다.</div>
                </section>
            </main>
        )
    }

    if (!proposal) {
        return (
            <main className="proposal-page">
                <section className="container proposal-layout">
                    <div className="proposal-main-card">
                        <h1>제안서를 찾을 수 없습니다.</h1>
                        <p>제안서가 삭제되었거나 접근할 수 없는 상태입니다.</p>
                        <Link to={myPageReturnTo || ROUTES.WORK_DASHBOARD} className="proposal-back-link">
                            {myPageReturnTo ? '마이페이지로 돌아가기' : '요청 목록으로 돌아가기'}
                        </Link>
                    </div>
                </section>
            </main>
        )
    }

    const isExpired = proposal.status === 'expired' || new Date(proposal.expiresAt) < new Date()
    const isClosed = isExpired || proposal.status === 'accepted' || proposal.status === 'cancelled'
    const isExpertOwner = user?.id === proposal.expertId
    const isClientOwner = user?.id === proposal.clientId
    const hasStartedWork = Boolean(createdWorkId) || proposal.paymentStatus === 'paid' || proposal.status === 'accepted'
    const canExpertManage = isExpertOwner && !isClosed && !hasStartedWork
    const canClientRespond = isClientOwner && !isClosed

    const handleAccept = async () => {
        if (!user) {
            setStatusMessage('로그인 후 결제를 진행할 수 있습니다.')
            return
        }

        setIsStartingPayment(true)
        setStatusMessage('토스페이먼츠 결제창을 여는 중입니다.')

        try {
            await withPaymentStartTimeout(
                startTossProposalPayment(proposal, {
                    id: user.id,
                    email: user.email,
                    name: typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : undefined,
                }),
            )
        } catch (error) {
            if (error instanceof Error) {
                setStatusMessage(error.message)
            } else {
                setStatusMessage('결제를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.')
            }
            setIsStartingPayment(false)
        }
    }

    return (
        <main className="proposal-page">
            <section className="proposal-hero">
                <div className="container proposal-hero-inner">
                    <div>
                        <span className="proposal-eyebrow">AIConnect 제안</span>
                        <h1>거래 제안서</h1>
                        <p>{proposal.title}</p>
                    </div>
                    <div className={`proposal-status ${isExpired ? 'expired' : 'active'}`}>
                        {isExpired ? statusText.expired : statusText[proposal.status]}
                    </div>
                </div>
            </section>

            <section className="container proposal-layout">
                <div className="proposal-main-card">
                    <div className="proposal-summary-grid">
                        <div>
                            <span>최종 금액</span>
                            <strong>{currency.format(proposal.totalPrice)}원</strong>
                        </div>
                        <div>
                            <span>작업 기간</span>
                            <strong>{proposal.deliveryDays}일</strong>
                        </div>
                        <div>
                            <span>수정 횟수</span>
                            <strong>{proposal.revisionCount}회</strong>
                        </div>
                        <div>
                            <span>진행 방식</span>
                            <strong>{proposal.progressType === 'milestone' ? '단계별 진행' : '단일 진행'}</strong>
                        </div>
                    </div>

                    <section className="proposal-section">
                        <h2>작업 범위</h2>
                        <p>{proposal.scope}</p>
                    </section>

                    <section className="proposal-section">
                        <h2>제출물</h2>
                        <ul>
                            {proposal.deliverables.map((deliverable) => (
                                <li key={deliverable}>{deliverable}</li>
                            ))}
                        </ul>
                    </section>

                    {proposal.milestones.length > 0 && (
                        <section className="proposal-section">
                            <h2>진행 단계</h2>
                            <ol>
                                {proposal.milestones.map((milestone) => (
                                    <li key={milestone}>{milestone}</li>
                                ))}
                            </ol>
                        </section>
                    )}
                </div>

                <aside className="proposal-side-card">
                    <div className="proposal-expiry">
                        <span>유효 기간</span>
                        <strong>{formatDate(proposal.expiresAt)}까지</strong>
                        <p>제안 유효 기간은 발송일로부터 3일입니다.</p>
                    </div>

                    <p className="proposal-start-notice">토스페이먼츠 결제 승인 후 프로젝트가 자동으로 생성됩니다.</p>
                    <p className="proposal-start-notice">완료 승인 후 AIConnect 수수료 12%를 제외한 금액이 전문가 정산 대기 상태가 됩니다.</p>
                    <div className="proposal-payment-notice">
                        <strong>토스페이먼츠 안전결제</strong>
                        <p>결제 금액은 서버에서 제안서 금액과 다시 대조한 뒤 승인합니다.</p>
                    </div>
                    {statusMessage && <p className="proposal-start-notice">{statusMessage}</p>}
                    {createdWorkId && (
                        <Link to={`/workroom/${createdWorkId}`} className="proposal-back-link" state={myPageReturnState}>
                            프로젝트로 이동
                        </Link>
                    )}

                    <div className="proposal-actions">
                        {canExpertManage ? (
                            <Link to={`${ROUTES.PROPOSAL_NEW}?proposalId=${proposal.id}`} className="btn-primary">
                                수정하기
                            </Link>
                        ) : isClientOwner ? (
                            <button type="button" className="btn-primary" disabled={!canClientRespond || isStartingPayment} onClick={handleAccept}>
                                {isStartingPayment ? '결제창 여는 중' : '토스로 결제하기'}
                            </button>
                        ) : null}
                    </div>

                    <Link to={myPageReturnTo || ROUTES.WORK_DASHBOARD} className="proposal-back-link">
                        {myPageReturnTo ? '마이페이지로 돌아가기' : '요청 목록으로 돌아가기'}
                    </Link>
                </aside>
            </section>
        </main>
    )
}
