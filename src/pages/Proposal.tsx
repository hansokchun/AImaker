import { Link, useLocation, useParams } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import type { Proposal as ProposalData } from '../types'
import { useEffect, useState } from 'react'
import { acceptProposal, cancelProposal, getProposal, requestProposalRevision } from '../lib/storage'
import './Proposal.css'

const now = new Date()
const futureExpiry = new Date(now)
futureExpiry.setDate(now.getDate() + 3)
const pastExpiry = new Date(now)
pastExpiry.setDate(now.getDate() - 1)

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
        expiresAt: futureExpiry.toISOString(),
    },
    {
        id: 'proposal-expired-01',
        requestId: 'request-expired-01',
        clientId: 'client-demo-01',
        expertId: 'expert-video-01',
        title: '만료된 AI 숏폼 제작 제안',
        scope: '만료 상태 확인용 제안서입니다.',
        deliverables: ['AI 숏폼 영상 시안'],
        totalPrice: 70000,
        deliveryDays: 4,
        revisionCount: 2,
        progressType: 'single',
        milestones: [],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'expired',
        expiresAt: pastExpiry.toISOString(),
    },
]

const currency = new Intl.NumberFormat('ko-KR')

function formatDate(value: string) {
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(new Date(value))
}

const statusText: Record<ProposalData['status'], string> = {
    sent: '제안 대기',
    revision_requested: '수정 요청됨',
    accepted: '승인됨',
    cancelled: '취소됨',
    expired: '만료된 제안서입니다.',
}

export default function Proposal() {
    const { proposalId } = useParams<{ proposalId: string }>()
    const location = useLocation()
    const [proposal, setProposal] = useState<ProposalData | null>(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const [statusMessage, setStatusMessage] = useState('')
    const [createdWorkId, setCreatedWorkId] = useState('')
    const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
    const myPageReturnTo = from?.pathname === ROUTES.MY_PAGE ? `${from.pathname}${from.search || ''}` : ''
    const myPageReturnState = myPageReturnTo ? { from } : undefined

    useEffect(() => {
        let active = true
        setIsLoaded(false)
        getProposal(proposalId || '').then((storedProposal) => {
            if (!active) return
            setProposal(storedProposal ?? mockProposals.find((item) => item.id === proposalId) ?? null)
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
                        <Link to={myPageReturnTo || ROUTES.REQUEST_BOARD} className="proposal-back-link">
                            {myPageReturnTo ? '마이페이지로 돌아가기' : '요청 목록으로 돌아가기'}
                        </Link>
                    </div>
                </section>
            </main>
        )
    }

    const isExpired = proposal.status === 'expired' || new Date(proposal.expiresAt) < new Date()
    const isClosed = isExpired || proposal.status === 'accepted' || proposal.status === 'cancelled'
    const handleAccept = async () => {
        const workId = await acceptProposal(proposal)
        setProposal({ ...proposal, status: 'accepted', paymentStatus: 'paid', platformFeeRate: 0.12 })
        setCreatedWorkId(workId)
        setStatusMessage('제안서를 승인하고 결제를 완료했습니다. 작업 진행방이 열렸습니다.')
    }
    const handleRequestRevision = async () => {
        await requestProposalRevision(proposal.id)
        setProposal({ ...proposal, status: 'revision_requested' })
        setStatusMessage('수정 요청을 보냈습니다.')
    }
    const handleCancel = async () => {
        await cancelProposal(proposal.id)
        setProposal({ ...proposal, status: 'cancelled' })
        setStatusMessage('제안서를 취소했습니다.')
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
                        <span>유효기간</span>
                        <strong>{formatDate(proposal.expiresAt)}까지</strong>
                        <p>제안 유효기간은 발송일로부터 3일입니다.</p>
                    </div>

                    <p className="proposal-start-notice">승인과 결제가 완료되어야 작업방이 생성됩니다.</p>
                    <p className="proposal-start-notice">완료 승인 시 AIConnect 수수료 12%를 제외한 금액이 전문가 정산 대기 상태가 됩니다.</p>
                    <div className="proposal-test-payment">
                        <strong>테스트 결제 모드</strong>
                        <p>현재는 실제 PG 결제 없이 결제 완료 상태로 처리됩니다.</p>
                    </div>
                    {statusMessage && <p className="proposal-start-notice">{statusMessage}</p>}
                    {createdWorkId && (
                        <Link to={`/workroom/${createdWorkId}`} className="proposal-back-link" state={myPageReturnState}>
                            작업방으로 이동
                        </Link>
                    )}

                    <div className="proposal-actions">
                        <button type="button" className="btn-primary" disabled={isClosed} onClick={handleAccept}>
                            테스트 결제 완료 처리
                        </button>
                        <button type="button" className="btn-text" disabled={isClosed} onClick={handleRequestRevision}>
                            수정 요청
                        </button>
                        <button type="button" className="btn-text danger" disabled={isClosed} onClick={handleCancel}>
                            취소
                        </button>
                    </div>

                    <Link to={myPageReturnTo || ROUTES.REQUEST_BOARD} className="proposal-back-link">
                        {myPageReturnTo ? '마이페이지로 돌아가기' : '요청 목록으로 돌아가기'}
                    </Link>
                </aside>
            </section>
        </main>
    )
}
