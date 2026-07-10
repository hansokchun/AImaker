import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { PageLoading } from '../components/PageLoading'
import type { Deliverable, Work, WorkMessage, WorkStep } from '../types'
import {
    approveWorkDeliverable,
    cancelWork,
    getStoredProfile,
    getUserDisplayProfile,
    getWorkMessages,
    getWorkroomData,
    requestWorkRevision,
    saveDeliverable,
    saveWorkMessage,
} from '../lib/storage'
import { validateMarketplaceMessage } from '../lib/tradeSafety'
import './Workroom.css'

const mockWork: Work = {
    id: 'work-demo-01',
    proposalId: 'proposal-demo-01',
    requestId: 'request-demo-01',
    clientId: 'client-demo-01',
    expertId: 'expert-video-01',
    title: 'AI 숏폼 영상 1차 제작',
    progressType: 'milestone',
    status: 'submitted',
    stepIds: ['step-concept', 'step-draft', 'step-final'],
}

const mockSteps: WorkStep[] = [
    {
        id: 'step-concept',
        workId: 'work-demo-01',
        stepOrder: 1,
        title: '콘셉트 확인',
        description: '작업 방향과 레퍼런스를 확인합니다.',
        status: 'approved',
    },
    {
        id: 'step-draft',
        workId: 'work-demo-01',
        stepOrder: 2,
        title: '1차 영상 시안 제출',
        description: 'AI 영상 시안을 제출하고 피드백을 기다립니다.',
        status: 'submitted',
    },
    {
        id: 'step-final',
        workId: 'work-demo-01',
        stepOrder: 3,
        title: '최종 제출',
        description: '수정사항 반영 후 최종 결과물을 전달합니다.',
        status: 'waiting',
    },
]

const mockDeliverables: Deliverable[] = [
    {
        id: 'deliverable-draft-01',
        workId: 'work-demo-01',
        stepId: 'step-draft',
        expertId: 'expert-video-01',
        description: '1차 AI 숏폼 영상 시안 링크',
        externalUrl: 'https://example.com/deliverables/ai-shortform-draft',
        status: 'submitted',
        submittedAt: new Date().toISOString(),
    },
]

const statusLabels: Record<WorkStep['status'], string> = {
    waiting: '대기',
    in_progress: '진행 중',
    submitted: '제출됨',
    revision_requested: '수정 요청됨',
    approved: '승인됨',
}

const deliverableStatusIcons: Record<Deliverable['status'], string> = {
    submitted: 'task_alt',
    approved: 'check_circle',
    revision_requested: 'rate_review',
}

const currency = new Intl.NumberFormat('ko-KR')

const settlementStatusText: Record<NonNullable<Work['settlementStatus']>, string> = {
    held: '작업 진행 중 보관',
    pending: '정산 대기',
    settled: '정산 완료',
    refunded: '환불 처리',
}

const refundStatusText: Record<NonNullable<Work['refundStatus']>, string> = {
    fee_excluded_refund_pending: '수수료 제외 환불 예정',
}

const isMyPageReturnPath = (pathname?: string) =>
    pathname === ROUTES.MY_PAGE || pathname === ROUTES.WORK_DASHBOARD

const notifyActivityChanged = () => {
    window.dispatchEvent(new Event('aiconnect:notifications-updated'))
}

type ParticipantProfile = {
    name: string
    imageUrl: string
}

type WorkProgressStep = {
    title: string
    description: string
    state: 'completed' | 'current' | 'pending' | 'cancelled'
    label: string
}

const getWorkProgressSteps = (work: Work, deliverables: Deliverable[]): WorkProgressStep[] => {
    const hasSubmittedDeliverable = deliverables.length > 0 || ['submitted', 'revision_requested', 'completed'].includes(work.status)
    const isCompleted = work.status === 'completed'
    const isCancelled = work.status === 'cancelled'

    if (isCancelled) {
        return [
            { title: '흐름설계', description: '작업 범위와 진행 방식을 정리합니다.', state: 'cancelled', label: '취소' },
            { title: '결과물 제출', description: '작업자가 결과물 링크나 파일을 제출합니다.', state: 'cancelled', label: '취소' },
            { title: '결과물 승인 및 정산', description: '의뢰자 승인 후 정산 대기 상태로 전환됩니다.', state: 'cancelled', label: '취소' },
        ]
    }

    return [
        {
            title: '흐름설계',
            description: '제안서와 요구사항을 바탕으로 작업 범위를 확정합니다.',
            state: 'completed',
            label: '완료',
        },
        {
            title: '결과물 제출',
            description: work.status === 'revision_requested'
                ? '수정 요청을 반영한 결과물을 다시 제출합니다.'
                : '작업자가 결과물 링크나 파일을 제출합니다.',
            state: hasSubmittedDeliverable ? 'completed' : 'current',
            label: hasSubmittedDeliverable ? '완료' : '진행 중',
        },
        {
            title: '결과물 승인 및 정산',
            description: '의뢰자가 결과물을 승인하면 정산 대기 상태로 이동합니다.',
            state: isCompleted ? 'completed' : hasSubmittedDeliverable ? 'current' : 'pending',
            label: isCompleted ? '완료' : hasSubmittedDeliverable ? '진행 중' : '대기',
        },
    ]
}

const resolveParticipantProfile = async (userId: string): Promise<ParticipantProfile> => {
    const [displayProfile, storedProfile] = await Promise.all([
        getUserDisplayProfile(userId).catch(() => null),
        getStoredProfile(userId).catch(() => null),
    ])

    return {
        name: displayProfile?.name || storedProfile?.name || userId,
        imageUrl: displayProfile?.imageUrl || storedProfile?.imageUrl || '',
    }
}

export default function Workroom() {
    const { workId } = useParams<{ workId: string }>()
    const location = useLocation()
    const { user } = useAuth()
    const [work, setWork] = useState<Work>(mockWork)
    const [steps, setSteps] = useState<WorkStep[]>(mockSteps)
    const [deliverables, setDeliverables] = useState<Deliverable[]>(mockDeliverables)
    const [messages, setMessages] = useState<WorkMessage[]>([])
    const [messageBody, setMessageBody] = useState('')
    const [messageError, setMessageError] = useState('')
    const [messageSubmitting, setMessageSubmitting] = useState(false)
    const [deliverableLink, setDeliverableLink] = useState('')
    const [statusMessage, setStatusMessage] = useState('')
    const [participants, setParticipants] = useState<Record<'client' | 'expert', ParticipantProfile>>({
        client: { name: '', imageUrl: '' },
        expert: { name: '', imageUrl: '' },
    })
    const [isLoaded, setIsLoaded] = useState(false)
    const [notFound, setNotFound] = useState(false)
    const activeDeliverable = deliverables[0]
    const progressSteps = getWorkProgressSteps(work, deliverables)
    const isRevisionMode = work.status === 'revision_requested'
    const deliverableFieldLabel = isRevisionMode ? '수정본 링크' : '제출물 링크'
    const deliverableButtonLabel = isRevisionMode ? '수정본 제출하기' : '제출물 링크 등록'
    const workStatusLabel =
        work.status === 'completed' ? '완료' : work.status === 'revision_requested' ? '수정 요청됨' : '결과물 검토 중'
    const isClientParticipant = user?.id === work.clientId
    const isExpertParticipant = user?.id === work.expertId
    const isClosedWork = work.status === 'completed' || work.status === 'cancelled'
    const canSubmitDeliverable = isExpertParticipant && !isClosedWork
    const canReviewDeliverable = isClientParticipant && !isClosedWork
    const revisionLimit = work.revisionLimit ?? 0
    const revisionUsed = work.revisionUsed ?? 0
    const hasRevisionLimit = revisionLimit > 0
    const isRevisionExhausted = hasRevisionLimit && revisionUsed >= revisionLimit
    const revisionUsageText = hasRevisionLimit
        ? `수정 요청 ${revisionUsed}/${revisionLimit}회 사용`
        : '수정 요청 횟수 제한 없음'
    const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
    const myPageReturnTo = isMyPageReturnPath(from?.pathname) ? `${from?.pathname}${from?.search || ''}` : ROUTES.MY_PAGE
    const myPageReturnState = myPageReturnTo ? { from } : undefined
    const workDashboardRole = isExpertParticipant ? 'expert' : 'client'
    const workDashboardSelectedKey = isExpertParticipant ? 'expertRequest' : 'clientOrder'
    const workDashboardTo = `${ROUTES.WORK_DASHBOARD}?role=${workDashboardRole}&panel=client&${workDashboardSelectedKey}=${work.requestId}`

    useEffect(() => {
        let active = true
        let messageSyncInterval: number | undefined
        setIsLoaded(false)
        setNotFound(false)
        getWorkroomData(workId || mockWork.id).then(async (data) => {
            if (!active) return
            if (!data.work) {
                setNotFound(true)
                setIsLoaded(true)
                return
            }
            const [workMessages, clientProfile, expertProfile] = await Promise.all([
                getWorkMessages(data.work.id),
                resolveParticipantProfile(data.work.clientId),
                resolveParticipantProfile(data.work.expertId),
            ])
            if (!active) return
            setWork(data.work)
            setSteps(data.steps)
            setDeliverables(data.deliverables)
            setMessages(workMessages)
            setParticipants({
                client: {
                    name: clientProfile.name,
                    imageUrl: clientProfile.imageUrl,
                },
                expert: {
                    name: expertProfile.name,
                    imageUrl: expertProfile.imageUrl,
                },
            })
            setIsLoaded(true)
            messageSyncInterval = window.setInterval(() => {
                getWorkMessages(data.work!.id)
                    .then((nextMessages) => {
                        if (active) setMessages(nextMessages)
                    })
                    .catch(() => {
                        // 다음 폴링에서 다시 시도합니다.
                    })
            }, 5000)
        })
        return () => {
            active = false
            if (messageSyncInterval) window.clearInterval(messageSyncInterval)
        }
    }, [workId])

    const handleSubmitDeliverable = async () => {
        if (!canSubmitDeliverable || !deliverableLink.trim()) return
        const newDeliverable: Deliverable = {
            id: `deliverable-${Date.now()}`,
            workId: work.id,
            stepId: steps[0]?.id || '',
            expertId: work.expertId,
            description: deliverableFieldLabel,
            externalUrl: deliverableLink.trim(),
            status: 'submitted',
            submittedAt: new Date().toISOString(),
        }
        await saveDeliverable(newDeliverable)
        setDeliverables([newDeliverable, ...deliverables])
        setDeliverableLink('')
        setStatusMessage(isRevisionMode ? '수정본 링크가 등록되었습니다. 의뢰자 확인을 기다립니다.' : '제출물 링크가 등록되었습니다.')
        notifyActivityChanged()
    }

    const handleApproveDeliverable = async () => {
        if (!canReviewDeliverable || !activeDeliverable) return

        await approveWorkDeliverable(work.id, activeDeliverable.id, work.requestId, activeDeliverable.stepId)
        setDeliverables((current) =>
            current.map((deliverable) =>
                deliverable.id === activeDeliverable.id ? { ...deliverable, status: 'approved' } : deliverable,
            ),
        )
        setSteps((current) =>
            current.map((step) =>
                step.id === activeDeliverable.stepId ? { ...step, status: 'approved' } : step,
            ),
        )
        setWork((current) => ({ ...current, status: 'completed', settlementStatus: 'pending' }))
        setStatusMessage('결과물을 승인했습니다. 작업이 완료되었습니다.')
        notifyActivityChanged()
    }

    const handleRequestRevision = async () => {
        if (!canReviewDeliverable || !activeDeliverable || isRevisionExhausted) return

        try {
            await requestWorkRevision(work.id, activeDeliverable.id, activeDeliverable.stepId)
        } catch (error) {
            setStatusMessage(error instanceof Error ? error.message : '수정 요청을 처리하지 못했습니다.')
            return
        }
        const nextRevisionUsed = revisionUsed + 1
        setDeliverables((current) =>
            current.map((deliverable) =>
                deliverable.id === activeDeliverable.id
                    ? { ...deliverable, status: 'revision_requested' }
                    : deliverable,
            ),
        )
        setSteps((current) =>
            current.map((step) =>
                step.id === activeDeliverable.stepId ? { ...step, status: 'revision_requested' } : step,
            ),
        )
        setWork((current) => ({ ...current, status: 'revision_requested', revisionUsed: nextRevisionUsed }))
        setStatusMessage('수정 요청을 보냈습니다. 전문가가 다시 제출할 수 있습니다.')
        notifyActivityChanged()
    }

    const handleSendMessage = async () => {
        const body = messageBody.trim()
        if (!body) {
            setMessageError('메시지를 입력해주세요.')
            return
        }

        const validation = validateMarketplaceMessage(body)
        if (!validation.allowed) {
            setMessageError(validation.message)
            return
        }

        setMessageSubmitting(true)
        setMessageError('')
        try {
            const message = await saveWorkMessage({
                workId: work.id,
                senderId: user?.id || work.clientId,
                body,
            })
            setMessages((current) => [...current, message])
            setMessageBody('')
            notifyActivityChanged()
        } catch {
            setMessageError('메시지를 보내지 못했습니다. 잠시 후 다시 시도해주세요.')
        } finally {
            setMessageSubmitting(false)
        }
    }

    const handleCancelWork = async () => {
        if (isClosedWork) return
        const cancellationReason: NonNullable<Work['cancellationReason']> = activeDeliverable
            ? 'mutual_after_start'
            : 'before_start'
        await cancelWork(work.id, cancellationReason)
        setWork((current) => ({
            ...current,
            status: 'cancelled',
            refundStatus: 'fee_excluded_refund_pending',
            cancellationReason,
        }))
        setStatusMessage('수수료 제외 환불 예정 상태로 처리되었습니다.')
        notifyActivityChanged()
    }

    if (!isLoaded) {
        return (
            <PageLoading
                title="프로젝트를 불러오는 중입니다"
                description="진행 단계와 제출 내역을 준비하고 있습니다."
            />
        )
    }

    if (notFound) {
        return (
            <main className="workroom-page">
                <section className="container workroom-layout">
                    <div className="workroom-main-card">
                        <h1>프로젝트를 찾을 수 없습니다.</h1>
                        <p>작업이 삭제되었거나 접근할 수 없는 상태입니다.</p>
                        <Link to={myPageReturnTo} className="btn-text">
                            마이페이지로 돌아가기
                        </Link>
                    </div>
                </section>
            </main>
        )
    }

    return (
        <main className="workroom-page">
            <section className="workroom-hero">
                <div className="container">
                    <span className="workroom-eyebrow">AIConnect 작업</span>
                    <h1>작업 진행방</h1>
                    <p>{work.title}</p>
                </div>
            </section>

            <section className="container workroom-layout">
                <div className="workroom-main-card">
                    <div className="workroom-header-row">
                        <div>
                            <h2>진행 단계</h2>
                            <p>{work.progressType === 'milestone' ? '단계별 진행' : '단일 진행'}으로 관리됩니다.</p>
                        </div>
                        <span className="work-status-badge">{workStatusLabel}</span>
                    </div>

                    <ol className="work-step-list">
                        {progressSteps.map((step, index) => (
                            <li
                                key={step.title}
                                className={`work-step ${step.state}`}
                                aria-label={`${step.title} 단계 상태: ${step.label}`}
                            >
                                <div className="step-index">{index + 1}</div>
                                <div className="step-body">
                                    <div className="step-title-row">
                                        <h3>{step.title}</h3>
                                        <span>{step.label}</span>
                                    </div>
                                    <p>{step.description}</p>
                                </div>
                            </li>
                        ))}
                    </ol>

                    <section className="deliverable-panel">
                        <h2>제출물</h2>
                        {isRevisionMode && (
                            <p className="submitted-deliverable">
                                의뢰자가 수정 요청을 보냈습니다. 수정본을 다시 제출해 주세요.
                            </p>
                        )}
                        {activeDeliverable ? (
                            <div className="submitted-deliverable">
                                <div>
                                    {activeDeliverable.externalUrl && (
                                        <a href={activeDeliverable.externalUrl} target="_blank" rel="noreferrer">
                                            {activeDeliverable.externalUrl}
                                        </a>
                                    )}
                                </div>
                                <span
                                    className="deliverable-status-icon"
                                    aria-label={statusLabels[activeDeliverable.status]}
                                    title={statusLabels[activeDeliverable.status]}
                                >
                                    <span className="material-symbols-outlined" aria-hidden="true">
                                        {deliverableStatusIcons[activeDeliverable.status]}
                                    </span>
                                </span>
                            </div>
                        ) : (
                            <p className="submitted-deliverable">등록된 제출물이 없습니다.</p>
                        )}

                        {canSubmitDeliverable ? (
                            <form className="deliverable-form">
                                <label htmlFor="deliverable-link">{deliverableFieldLabel}</label>
                                <div>
                                    <input
                                        id="deliverable-link"
                                        aria-label={deliverableFieldLabel}
                                        type="url"
                                        placeholder="https://..."
                                        value={deliverableLink}
                                        onChange={(event) => setDeliverableLink(event.target.value)}
                                    />
                                    <button type="button" className="btn-primary" onClick={handleSubmitDeliverable}>
                                        {deliverableButtonLabel}
                                    </button>
                                </div>
                            </form>
                        ) : null}
                        {statusMessage && <p>{statusMessage}</p>}
                    </section>

                    <section className="workroom-chat-panel">
                        <div className="workroom-header-row">
                            <div>
                                <h2>프로젝트 대화</h2>
                                <p>결제 후 작업 진행에 필요한 질문, 확인, 수정 의견을 이곳에서 주고받습니다.</p>
                            </div>
                        </div>
                        <div className="workroom-message-list">
                            {messages.length > 0 ? (
                                messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`workroom-message ${message.senderId === user?.id ? 'mine' : 'theirs'}`}
                                    >
                                        <p>{message.body}</p>
                                        <span>{new Date(message.createdAt).toLocaleString('ko-KR')}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="workroom-empty-messages" aria-label="프로젝트 메시지 없음">
                                    <span className="material-symbols-outlined" aria-hidden="true">
                                        forum
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="workroom-message-form">
                            <label htmlFor="workroom-message">프로젝트 메시지</label>
                            <textarea
                                id="workroom-message"
                                aria-label="프로젝트 메시지"
                                value={messageBody}
                                onChange={(event) => setMessageBody(event.target.value)}
                                placeholder="작업 진행에 필요한 내용을 입력하세요."
                            />
                            {messageError && <p>{messageError}</p>}
                            <button
                                type="button"
                                className="btn-primary"
                                disabled={messageSubmitting}
                                onClick={handleSendMessage}
                            >
                                {messageSubmitting ? '전송 중' : '메시지 보내기'}
                            </button>
                        </div>
                    </section>
                </div>

                <aside className="workroom-side-card">
                    <Link to={`/proposal/${work.proposalId}`} className="btn-primary" state={myPageReturnState}>
                        제안서 보기
                    </Link>
                    <Link to={workDashboardTo} className="workroom-dashboard-link" state={myPageReturnState}>
                        <span className="material-symbols-outlined" aria-hidden="true">fact_check</span>
                        내 작업에서 전체 진행 보기
                    </Link>
                    <section className="workroom-payment-panel">
                        <h2>결제/정산</h2>
                        <p>결제 완료</p>
                        <strong>{currency.format(work.totalPrice || 0)}원</strong>
                        <span>AIConnect 수수료 {currency.format(work.platformFee || 0)}원</span>
                        <span>전문가 정산 예정 {currency.format(work.expertPayout || 0)}원</span>
                        <span>
                            {work.refundStatus
                                ? refundStatusText[work.refundStatus]
                                : settlementStatusText[work.settlementStatus || 'held']}
                        </span>
                    </section>

                    <section className="workroom-participants">
                        <h2>거래 참여자</h2>
                        <div>
                            {participants.client.imageUrl ? (
                                <img
                                    src={participants.client.imageUrl}
                                    alt={`${participants.client.name || work.clientId} 프로필 이미지`}
                                    className="workroom-participant-image"
                                />
                            ) : (
                                <span className="workroom-participant-fallback" aria-hidden="true">
                                    {(participants.client.name || work.clientId).slice(0, 1).toUpperCase()}
                                </span>
                            )}
                            <span>의뢰자</span>
                            <strong>{participants.client.name || work.clientId}</strong>
                        </div>
                        <div>
                            {participants.expert.imageUrl ? (
                                <img
                                    src={participants.expert.imageUrl}
                                    alt={`${participants.expert.name || work.expertId} 프로필 이미지`}
                                    className="workroom-participant-image"
                                />
                            ) : (
                                <span className="workroom-participant-fallback" aria-hidden="true">
                                    {(participants.expert.name || work.expertId).slice(0, 1).toUpperCase()}
                                </span>
                            )}
                            <span>작업자</span>
                            <strong>{participants.expert.name || work.expertId}</strong>
                        </div>
                    </section>

                    {canReviewDeliverable && (
                        <>
                            <h2>의뢰자 확인</h2>
                            <p>제출물을 확인한 뒤 승인하거나 수정 요청을 남길 수 있습니다.</p>
                            <p>{revisionUsageText}</p>
                            {isRevisionExhausted && (
                                <p>제안서에 포함된 수정 요청 횟수를 모두 사용했습니다.</p>
                            )}
                            <div className="review-actions">
                                <button
                                    type="button"
                                    className="btn-primary"
                                    disabled={!activeDeliverable}
                                    onClick={handleApproveDeliverable}
                                >
                                    결과물 승인
                                </button>
                                <button
                                    type="button"
                                    className="btn-text"
                                    disabled={!activeDeliverable || isRevisionExhausted}
                                    onClick={handleRequestRevision}
                                >
                                    수정 요청
                                </button>
                            </div>
                        </>
                    )}
                    {work.status !== 'completed' && work.status !== 'cancelled' && (
                        <button type="button" className="workroom-danger-button" onClick={handleCancelWork}>
                            거래 중단 요청
                        </button>
                    )}
                </aside>
            </section>
        </main>
    )
}
