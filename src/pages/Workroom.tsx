import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import type { Deliverable, Work, WorkMessage, WorkStep } from '../types'
import { approveWorkDeliverable, cancelWork, getWorkMessages, getWorkroomData, requestWorkRevision, saveDeliverable, saveWorkMessage } from '../lib/storage'
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

const currency = new Intl.NumberFormat('ko-KR')

const settlementStatusText: Record<NonNullable<Work['settlementStatus']>, string> = {
    held: '작업 진행 중 보관',
    pending: '정산 대기',
    settled: '정산 완료',
    refunded: '환불 처리',
}

const isMyPageReturnPath = (pathname?: string) =>
    pathname === ROUTES.MY_PAGE || pathname === ROUTES.WORK_DASHBOARD

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
    const [isLoaded, setIsLoaded] = useState(false)
    const [notFound, setNotFound] = useState(false)
    const activeDeliverable = deliverables[0]
    const isRevisionMode = work.status === 'revision_requested'
    const deliverableFieldLabel = isRevisionMode ? '수정본 링크' : '제출물 링크'
    const deliverableButtonLabel = isRevisionMode ? '수정본 제출하기' : '제출물 링크 등록'
    const workStatusLabel =
        work.status === 'completed' ? '완료' : work.status === 'revision_requested' ? '수정 요청됨' : '결과물 검토 중'
    const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from
    const myPageReturnTo = isMyPageReturnPath(from?.pathname) ? `${from?.pathname}${from?.search || ''}` : ROUTES.MY_PAGE
    const myPageReturnState = myPageReturnTo ? { from } : undefined

    useEffect(() => {
        let active = true
        setIsLoaded(false)
        setNotFound(false)
        getWorkroomData(workId || mockWork.id).then(async (data) => {
            if (!active) return
            if (!data.work) {
                setNotFound(true)
                setIsLoaded(true)
                return
            }
            const workMessages = await getWorkMessages(data.work.id)
            if (!active) return
            setWork(data.work)
            setSteps(data.steps)
            setDeliverables(data.deliverables)
            setMessages(workMessages)
            setIsLoaded(true)
        })
        return () => {
            active = false
        }
    }, [workId])

    const handleSubmitDeliverable = async () => {
        if (!deliverableLink.trim()) return
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
    }

    const handleApproveDeliverable = async () => {
        if (!activeDeliverable) return

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
    }

    const handleRequestRevision = async () => {
        if (!activeDeliverable) return

        await requestWorkRevision(work.id, activeDeliverable.id, activeDeliverable.stepId)
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
        setWork((current) => ({ ...current, status: 'revision_requested' }))
        setStatusMessage('수정 요청을 보냈습니다. 전문가가 다시 제출할 수 있습니다.')
    }

    const handleSendMessage = async () => {
        if (!messageBody.trim()) {
            setMessageError('메시지를 입력해주세요.')
            return
        }

        setMessageSubmitting(true)
        setMessageError('')
        try {
            const message = await saveWorkMessage({
                workId: work.id,
                senderId: user?.id || work.clientId,
                body: messageBody,
            })
            setMessages((current) => [...current, message])
            setMessageBody('')
        } catch {
            setMessageError('메시지를 보내지 못했습니다. 잠시 후 다시 시도해주세요.')
        } finally {
            setMessageSubmitting(false)
        }
    }

    const handleCancelWork = async () => {
        await cancelWork(work.id)
        setWork((current) => ({ ...current, status: 'cancelled', settlementStatus: 'refunded' }))
        setStatusMessage('거래 중단 요청이 처리되었습니다.')
    }

    if (!isLoaded) {
        return (
            <main className="workroom-page">
                <section className="container workroom-layout">
                    <div className="workroom-main-card">작업방을 불러오는 중입니다.</div>
                </section>
            </main>
        )
    }

    if (notFound) {
        return (
            <main className="workroom-page">
                <section className="container workroom-layout">
                    <div className="workroom-main-card">
                        <h1>작업방을 찾을 수 없습니다.</h1>
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

                    {steps.length > 0 ? (
                        <ol className="work-step-list">
                            {steps.map((step) => (
                                <li key={step.id} className={`work-step ${step.status}`}>
                                    <div className="step-index">{step.stepOrder}</div>
                                    <div className="step-body">
                                        <div className="step-title-row">
                                            <h3>{step.title}</h3>
                                            <span>{statusLabels[step.status]}</span>
                                        </div>
                                        <p>{step.description}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="submitted-deliverable">등록된 진행 단계가 없습니다.</p>
                    )}

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
                                    <strong>{activeDeliverable.description}</strong>
                                    {activeDeliverable.externalUrl && (
                                        <a href={activeDeliverable.externalUrl} target="_blank" rel="noreferrer">
                                            제출물 보기
                                        </a>
                                    )}
                                </div>
                                <span>{statusLabels[activeDeliverable.status]}</span>
                            </div>
                        ) : (
                            <p className="submitted-deliverable">등록된 제출물이 없습니다.</p>
                        )}

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
                        {statusMessage && <p>{statusMessage}</p>}
                    </section>

                    <section className="workroom-chat-panel">
                        <div className="workroom-header-row">
                            <div>
                                <h2>작업방 대화</h2>
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
                                <p className="submitted-deliverable">아직 작업방 메시지가 없습니다.</p>
                            )}
                        </div>
                        <div className="workroom-message-form">
                            <label htmlFor="workroom-message">작업방 메시지</label>
                            <textarea
                                id="workroom-message"
                                aria-label="작업방 메시지"
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
                    <section className="workroom-payment-panel">
                        <h2>결제/정산</h2>
                        <p>결제 완료</p>
                        <strong>{currency.format(work.totalPrice || 0)}원</strong>
                        <span>AIConnect 수수료 {currency.format(work.platformFee || 0)}원</span>
                        <span>전문가 정산 예정 {currency.format(work.expertPayout || 0)}원</span>
                        <span>{settlementStatusText[work.settlementStatus || 'held']}</span>
                    </section>

                    <h2>의뢰자 확인</h2>
                    <p>제출물을 확인한 뒤 승인하거나 수정 요청을 남길 수 있습니다.</p>
                    <div className="review-actions">
                        <button
                            type="button"
                            className="btn-primary"
                            disabled={!activeDeliverable || work.status === 'completed'}
                            onClick={handleApproveDeliverable}
                        >
                            결과물 승인
                        </button>
                        <button
                            type="button"
                            className="btn-text"
                            disabled={!activeDeliverable || work.status === 'completed'}
                            onClick={handleRequestRevision}
                        >
                            수정 요청
                        </button>
                    </div>
                    {work.status !== 'completed' && work.status !== 'cancelled' && (
                        <button type="button" className="btn-text danger" onClick={handleCancelWork}>
                            거래 중단 요청
                        </button>
                    )}
                    <Link to={myPageReturnTo} className="btn-text">
                        마이페이지로 돌아가기
                    </Link>
                </aside>
            </section>
        </main>
    )
}
