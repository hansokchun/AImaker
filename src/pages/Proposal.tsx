import { Link, useParams } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import type { Proposal as ProposalData } from '../types'
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

export default function Proposal() {
    const { proposalId } = useParams<{ proposalId: string }>()
    const proposal = mockProposals.find((item) => item.id === proposalId) ?? mockProposals[0]
    const isExpired = proposal.status === 'expired' || new Date(proposal.expiresAt) < new Date()

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
                        {isExpired ? '만료된 제안서입니다.' : '제안 대기'}
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

                    <p className="proposal-start-notice">승인 전에는 작업이 시작되지 않습니다.</p>

                    <div className="proposal-actions">
                        <button type="button" className="btn-primary" disabled={isExpired}>
                            승인하기
                        </button>
                        <button type="button" className="btn-text">
                            수정 요청
                        </button>
                        <button type="button" className="btn-text danger">
                            취소
                        </button>
                    </div>

                    <Link to={ROUTES.REQUEST_BOARD} className="proposal-back-link">
                        요청 목록으로 돌아가기
                    </Link>
                </aside>
            </section>
        </main>
    )
}
