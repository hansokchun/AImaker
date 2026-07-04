import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { ExpertProduct, Review, ServiceRequestData, Work } from '../types'

const currency = new Intl.NumberFormat('ko-KR')

const statusView: Record<Work['status'], { readonly label: string; readonly tone: 'blue' | 'orange' | 'purple' | 'green' | 'gray'; readonly dateLabel: string }> = {
    in_progress: { label: '진행 중', tone: 'blue', dateLabel: '시작일' },
    submitted: { label: '검토 대기', tone: 'orange', dateLabel: '요청일' },
    revision_requested: { label: '수정 요청', tone: 'purple', dateLabel: '요청일' },
    completed: { label: '완료', tone: 'green', dateLabel: '완료일' },
    cancelled: { label: '중단됨', tone: 'gray', dateLabel: '중단일' },
}

const settlementStatusText: Record<NonNullable<Work['settlementStatus']>, string> = {
    held: '작업 진행 중 보관',
    pending: '정산 대기',
    settled: '정산 완료',
    refunded: '환불 처리',
}

type ProjectListPanelProps = {
    readonly currentUserId?: string
    readonly emptyText: string
    readonly products: readonly ExpertProduct[]
    readonly requests: readonly ServiceRequestData[]
    readonly returnState?: unknown
    readonly reviews: readonly Review[]
    readonly title: string
    readonly works: readonly Work[]
    readonly onReviewOpen: (work: Work) => void
    readonly submittedReviewWorkId?: string
}

type ProjectCardView = {
    readonly product?: ExpertProduct
    readonly request?: ServiceRequestData
    readonly work: Work
}

const categoryLabel: Record<ExpertProduct['category'], string> = {
    'ai-video-shortform': 'AI 영상',
    'ai-image-character': 'AI 이미지/캐릭터',
    'ai-development-automation': 'AI 개발/자동화',
}

const getActionLabel = (work: Work, canWriteReview: boolean) => {
    if (work.status === 'submitted') return '결과물 확인 필요'
    if (work.status === 'revision_requested') return '수정요청 진행 중'
    if (work.status === 'in_progress') return '새 진행 상태 확인'
    if (work.status === 'completed' && canWriteReview) return '리뷰 작성'
    return '상세 보기'
}

function ProjectThumbnail({ imageUrl, title, tone, category }: { readonly imageUrl?: string; readonly title: string; readonly tone: ProjectCardViewTone; readonly category?: ExpertProduct['category'] }) {
    const [hasImageError, setHasImageError] = useState(false)
    const canShowImage = Boolean(imageUrl) && !hasImageError
    const placeholderLabel = category ? `${categoryLabel[category]} 프로젝트 기본 이미지` : '프로젝트 기본 이미지'

    if (canShowImage) {
        return (
            <img
                className="project-list-thumbnail"
                src={imageUrl}
                alt={`${title} 프로젝트 썸네일`}
                width="96"
                height="96"
                onError={() => setHasImageError(true)}
            />
        )
    }

    return (
        <span className={`project-list-placeholder is-${tone}`} aria-label={placeholderLabel} role="img">
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-13Zm3 2.25A1.75 1.75 0 1 0 10.5 7.75 1.75 1.75 0 0 0 7 7.75Zm-1 9.7 3.2-3.72a1.2 1.2 0 0 1 1.78-.05l1.45 1.52 2.2-2.78a1.2 1.2 0 0 1 1.88 0L18 14.3v4.2a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-1.05Z" />
            </svg>
        </span>
    )
}

type ProjectCardViewTone = (typeof statusView)[Work['status']]['tone']

function ProjectCard({ view, reviews, currentUserId, returnState, onReviewOpen, submittedReviewWorkId }: { readonly view: ProjectCardView; readonly reviews: readonly Review[]; readonly currentUserId?: string; readonly returnState?: unknown; readonly onReviewOpen: (work: Work) => void; readonly submittedReviewWorkId?: string }) {
    const navigate = useNavigate()
    const { product, request, work } = view
    const status = statusView[work.status]
    const hasReview = reviews.some((review) => review.workId === work.id && review.clientId === currentUserId)
    const canWriteReview = work.status === 'completed' && work.clientId === currentUserId && !hasReview
    const actionLabel = getActionLabel(work, canWriteReview)
    const imageTitle = product?.title || work.title
    const dateText = request?.createdAt ? `${status.dateLabel} ${request.createdAt}` : status.label
    const workroomPath = `/workroom/${work.id}`

    if (work.status !== 'completed') {
        return (
            <Link
                className={`project-list-card is-${status.tone}`}
                to={workroomPath}
                state={returnState}
                data-testid="active-work"
                aria-label={work.title}
            >
                <ProjectThumbnail imageUrl={product?.sampleImageUrl} title={imageTitle} tone={status.tone} category={product?.category} />
                <ProjectCardBody actionLabel={actionLabel} dateText={dateText} statusLabel={status.label} title={work.title} tone={status.tone} />
            </Link>
        )
    }

    return (
        <article
            className={`project-list-card is-${status.tone}`}
            data-testid="completed-work"
            onClick={() => navigate(workroomPath, { state: returnState })}
        >
            <ProjectThumbnail imageUrl={product?.sampleImageUrl} title={imageTitle} tone={status.tone} category={product?.category} />
            <ProjectCardBody actionLabel={actionLabel} dateText={dateText} statusLabel={status.label} title={work.title} tone={status.tone}>
                {work.settlementStatus && (
                    <div className="project-list-settlement">
                        <span>{settlementStatusText[work.settlementStatus]}</span>
                        {typeof work.expertPayout === 'number' && work.expertPayout > 0 && (
                            <span>전문가 정산 예정 {currency.format(work.expertPayout)}원</span>
                        )}
                    </div>
                )}
                {canWriteReview && (
                    <button
                        type="button"
                        className="project-list-action-button"
                        onClick={(event) => {
                            event.stopPropagation()
                            onReviewOpen(work)
                        }}
                    >
                        리뷰 작성
                    </button>
                )}
                {hasReview && <p className="project-list-review-state">리뷰 등록 완료</p>}
                {submittedReviewWorkId === work.id && <p className="project-list-review-state">리뷰가 등록되었습니다.</p>}
                <Link className="project-list-hidden-link" to={workroomPath} state={returnState}>
                    {work.title}
                </Link>
            </ProjectCardBody>
        </article>
    )
}

function ProjectCardBody({ actionLabel, children, dateText, statusLabel, title, tone }: { readonly actionLabel: string; readonly children?: ReactNode; readonly dateText: string; readonly statusLabel: string; readonly title: string; readonly tone: ProjectCardViewTone }) {
    return (
        <div className="project-list-card-body">
            <div className="project-list-card-main">
                <h3>{title}</h3>
                <p className="project-list-status-line">
                    <span className={`project-list-status-dot is-${tone}`} aria-hidden="true" />
                    <span>{statusLabel}</span>
                    <span aria-hidden="true">|</span>
                    <span>{dateText}</span>
                </p>
                {children}
            </div>
            <span className="project-list-action">{actionLabel}</span>
        </div>
    )
}

export function ProjectListPanel({ currentUserId, emptyText, products, requests, returnState, reviews, title, works, onReviewOpen, submittedReviewWorkId }: ProjectListPanelProps) {
    const cardViews = works.map((work) => {
        const request = requests.find((item) => item.id === work.requestId)
        const product = request?.productId ? products.find((item) => item.id === request.productId) : undefined

        return { product, request, work }
    })

    return (
        <section className="project-list-panel">
            <div className="project-list-header">
                <nav className="project-list-breadcrumb" aria-label="현재 위치">
                    <Link to="/">홈</Link>
                    <span aria-hidden="true">/</span>
                    <Link to="/my-work">내 작업</Link>
                    <span aria-hidden="true">/</span>
                    <span>{title}</span>
                </nav>
                <h2>{title}</h2>
                <p>진행 중인 프로젝트의 상태를 한눈에 확인하고 관리할 수 있습니다.</p>
            </div>
            <div className="project-list-stack">
                {cardViews.length > 0 ? (
                    cardViews.map((view) => (
                        <ProjectCard
                            key={view.work.id}
                            currentUserId={currentUserId}
                            onReviewOpen={onReviewOpen}
                            returnState={returnState}
                            reviews={reviews}
                            submittedReviewWorkId={submittedReviewWorkId}
                            view={view}
                        />
                    ))
                ) : (
                    <p className="project-list-empty">{emptyText}</p>
                )}
            </div>
        </section>
    )
}
