import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import type { Deliverable, Work, WorkStep } from '../types'
import { approveWorkDeliverable, getWorkroomData, requestWorkRevision, saveDeliverable } from '../lib/storage'
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

export default function Workroom() {
    const { workId } = useParams<{ workId: string }>()
    const [work, setWork] = useState<Work>(mockWork)
    const [steps, setSteps] = useState<WorkStep[]>(mockSteps)
    const [deliverables, setDeliverables] = useState<Deliverable[]>(mockDeliverables)
    const [deliverableLink, setDeliverableLink] = useState('')
    const [statusMessage, setStatusMessage] = useState('')
    const [isLoaded, setIsLoaded] = useState(false)
    const [notFound, setNotFound] = useState(false)
    const activeDeliverable = deliverables[0]
    const workStatusLabel =
        work.status === 'completed' ? '완료' : work.status === 'revision_requested' ? '수정 요청됨' : '결과물 검토 중'

    useEffect(() => {
        let active = true
        setIsLoaded(false)
        setNotFound(false)
        getWorkroomData(workId || mockWork.id).then((data) => {
            if (!active) return
            if (!data.work) {
                setNotFound(true)
                setIsLoaded(true)
                return
            }
            setWork(data.work)
            setSteps(data.steps)
            setDeliverables(data.deliverables)
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
            description: '제출물 링크',
            externalUrl: deliverableLink.trim(),
            status: 'submitted',
            submittedAt: new Date().toISOString(),
        }
        await saveDeliverable(newDeliverable)
        setDeliverables([newDeliverable, ...deliverables])
        setDeliverableLink('')
        setStatusMessage('제출물 링크가 등록되었습니다.')
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
        setWork((current) => ({ ...current, status: 'completed' }))
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
                        <Link to={ROUTES.MY_PAGE} className="btn-text">
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
                            <label htmlFor="deliverable-link">제출물 링크</label>
                            <div>
                                <input
                                    id="deliverable-link"
                                    aria-label="제출물 링크"
                                    type="url"
                                    placeholder="https://..."
                                    value={deliverableLink}
                                    onChange={(event) => setDeliverableLink(event.target.value)}
                                />
                                <button type="button" className="btn-primary" onClick={handleSubmitDeliverable}>
                                    제출물 링크 등록
                                </button>
                            </div>
                        </form>
                        {statusMessage && <p>{statusMessage}</p>}
                    </section>
                </div>

                <aside className="workroom-side-card">
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
                </aside>
            </section>
        </main>
    )
}
