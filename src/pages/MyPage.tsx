import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { closeConsultation, deleteUserPublicAccountData, getConsultationMessages, getExpertProducts, getStoredProfile, getUserConsultations, getUserDisplayProfile, getUserFavoriteProductIds, getUserProposals, getUserReviews, getUserServiceRequests, getUserWorks, saveConsultationMessage, saveConsultationReport, saveReview, subscribeToConsultationMessages } from '../lib/storage'
import { validateMarketplaceMessage } from '../lib/tradeSafety'
import type { Consultation, ConsultationMessage, ExpertProduct, Proposal, Review, ServiceRequestData, Work } from '../types'
import ProductCard from '../components/ProductCard'
import { ConsultationChatPanel } from './ConsultationChatPanel'
import { ProjectListPanel } from './ProjectListPanel'
import './MyPage.css'

const proposalStatusText: Record<Proposal['status'], string> = {
    sent: '대기 중',
    revision_requested: '수정 요청',
    accepted: '승인됨',
    cancelled: '취소',
    expired: '만료',
}

const workStatusText: Record<Work['status'], string> = {
    in_progress: '진행 중',
    submitted: '검토 대기',
    revision_requested: '수정 요청',
    completed: '완료',
    cancelled: '취소',
}

const currency = new Intl.NumberFormat('ko-KR')

const normalizeStageActions = (action?: StageAction | StageAction[]) =>
    Array.isArray(action) ? action : action ? [action] : []

type MyPagePanel = 'overview' | 'profile' | 'products' | 'client' | 'expert' | 'favorites' | 'consultations' | 'workroom' | 'reviews'
type MyPageMode = 'profile' | 'work' | 'all'
type StageVisualState = 'done' | 'current' | 'pending'
type StageAction = { label: string; to?: string; onClick?: () => void; variant?: 'primary' | 'secondary' }
type WorkStageView = {
    phase: string
    title: string
    description: string
    state: StageVisualState
    actions: StageAction[]
}
type WorkInfoItem = { label: string; value: string }
type WorkActivityItem = {
    title: string
    description: string
    timeLabel: string
    state: StageVisualState
}
type WorkTransactionView = 'active' | 'stopped'
type WorkStatusTone = 'consultation' | 'payment' | 'work' | 'done' | 'stopped' | 'neutral'
type WorkDetailHero = {
    typeLabel: string
    statusLabel: string
    statusTone: WorkStatusTone
    transactionNumber: string
    createdAtLabel: string
    imageUrl?: string
    imageAlt: string
    onBack: () => void
}

const stageVisualConfig: Record<StageVisualState, { label: string; border: string; background: string; badgeBackground: string; badgeColor: string; textColor: string; bodyColor: string }> = {
    done: {
        label: '완료됨',
        border: '#16a34a',
        background: '#f0fdf4',
        badgeBackground: '#dcfce7',
        badgeColor: '#166534',
        textColor: '#0f172a',
        bodyColor: '#475569',
    },
    current: {
        label: '진행 중',
        border: '#2563eb',
        background: '#eff6ff',
        badgeBackground: '#dbeafe',
        badgeColor: '#1d4ed8',
        textColor: '#0f172a',
        bodyColor: '#475569',
    },
    pending: {
        label: '대기',
        border: '#cbd5e1',
        background: '#f8fafc',
        badgeBackground: '#e2e8f0',
        badgeColor: '#475569',
        textColor: '#94a3b8',
        bodyColor: '#94a3b8',
    },
}

const profileMenuItems: Array<{ id: MyPagePanel; label: string }> = [
    { id: 'overview', label: '개요' },
    { id: 'profile', label: '마이 프로필' },
]

const clientWorkMenuItems: Array<{ id: MyPagePanel; label: string }> = [
    { id: 'client', label: '거래관리' },
    { id: 'favorites', label: '관심 상품' },
    { id: 'consultations', label: '상담채팅' },
    { id: 'workroom', label: '프로젝트' },
]

const expertWorkMenuItems: Array<{ id: MyPagePanel; label: string }> = [
    { id: 'client', label: '거래관리' },
    { id: 'products', label: '내 상품관리' },
    { id: 'consultations', label: '상담채팅' },
    { id: 'workroom', label: '프로젝트' },
]

const legacyWorkMenuItems: Array<{ id: MyPagePanel; label: string }> = [
    { id: 'client', label: '의뢰자 홈' },
    { id: 'expert', label: '전문가 홈' },
    { id: 'workroom', label: '프로젝트' },
]

const allMenuItems = [...profileMenuItems, ...legacyWorkMenuItems]

const isMyPagePanel = (value: string | null, items: Array<{ id: MyPagePanel; label: string }> = allMenuItems): value is MyPagePanel =>
    Boolean(value && items.some((item) => item.id === value))

const normalizeWorkPanel = (value: string | null, mode: MyPageMode) =>
    value === 'reviews' ? 'workroom' :
    mode === 'work' && value === 'expert' ? 'client' : value

const dispatchNotificationRefresh = () => {
    window.dispatchEvent(new Event('aiconnect:notifications-updated'))
}

const mergeConsultationMessages = (
    current: readonly ConsultationMessage[],
    incoming: ConsultationMessage | readonly ConsultationMessage[],
) => {
    const messages = Array.isArray(incoming) ? incoming : [incoming]
    const byId = new Map<string, ConsultationMessage>()

    for (const message of [...current, ...messages]) {
        byId.set(message.id, message)
    }

    return Array.from(byId.values()).sort((first, second) => {
        const firstTime = Date.parse(first.createdAt || '')
        const secondTime = Date.parse(second.createdAt || '')
        return (Number.isNaN(firstTime) ? 0 : firstTime) - (Number.isNaN(secondTime) ? 0 : secondTime)
    })
}

const consultationListRefreshIntervalMs = import.meta.env.MODE === 'test' ? 80 : 5000
const consultationMessageRefreshIntervalMs = import.meta.env.MODE === 'test' ? 50 : 3000

const getClientWorkStageTitle = (work: Work) => {
    if (work.status === 'completed') return '작업 완료'
    if (work.status === 'submitted') return '결과물 검토 대기'
    if (work.status === 'revision_requested') return '수정 요청 보냄'
    return '프로젝트 진행'
}

const getClientWorkStageDescription = (work: Work) => {
    if (work.status === 'submitted') return '전문가가 제출한 결과물을 확인하고 승인 또는 수정 요청을 진행합니다.'
    if (work.status === 'revision_requested') return '전문가에게 수정 요청을 보냈고 재제출을 기다립니다.'
    return workStatusText[work.status]
}

const getClientWorkStageActionLabel = (work: Work) => {
    if (work.status === 'completed') return '완료 작업 보기'
    if (work.status === 'submitted') return '결과물 확인하기'
    if (work.status === 'revision_requested') return '수정 요청 확인하기'
    return '프로젝트 열기'
}

const getExpertWorkStageTitle = (work: Work) => {
    if (work.status === 'completed') return '작업 완료'
    if (work.status === 'submitted') return '제출 완료 - 승인 대기'
    if (work.status === 'revision_requested') return '수정 대응 필요'
    return '작업 진행'
}

const getExpertWorkStageDescription = (work: Work) => {
    if (work.status === 'submitted') return '결과물을 제출했고 의뢰자의 승인 또는 수정 요청을 기다립니다.'
    if (work.status === 'revision_requested') return '의뢰자가 수정 요청을 보냈습니다. 프로젝트에서 수정본을 다시 제출합니다.'
    return workStatusText[work.status]
}

const getExpertWorkStageActionLabel = (work: Work) => {
    if (work.status === 'completed') return '완료 작업 보기'
    if (work.status === 'submitted') return '제출물 확인하기'
    if (work.status === 'revision_requested') return '수정본 제출하기'
    return '프로젝트 열기'
}

const cardStyle = {
    background: 'white',
    padding: '2rem',
    borderRadius: '1rem',
    border: '1px solid var(--border-color)',
} as const

type MyPageProps = {
    mode?: MyPageMode
}

type ProfilePreview = {
    name: string
    imageUrl: string
    roleLabel: string
    oneLiner: string
    aiTools: string[]
    sampleLinks: string[]
}

export default function MyPage({ mode = 'all' }: MyPageProps = {}) {
    const { session, user, loading, signOut } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const [workRole, setWorkRole] = useState<'client' | 'expert'>(() =>
        searchParams.get('role') === 'expert' || searchParams.get('panel') === 'expert' ? 'expert' : 'client',
    )
    const menuItems = mode === 'profile' ? profileMenuItems : mode === 'work' ? (workRole === 'expert' ? expertWorkMenuItems : clientWorkMenuItems) : allMenuItems
    const defaultPanel = menuItems[0].id
    const searchParamString = searchParams.toString()
    const initialPanel = normalizeWorkPanel(searchParams.get('panel'), mode)
    const [activePanel, setActivePanel] = useState<MyPagePanel>(
        isMyPagePanel(initialPanel, menuItems) ? initialPanel : defaultPanel,
    )
    const [selectedClientOrderId, setSelectedClientOrderId] = useState<string | number | null>(searchParams.get('clientOrder'))
    const [selectedExpertRequestId, setSelectedExpertRequestId] = useState<string | number | null>(searchParams.get('expertRequest'))
    const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(searchParams.get('consultation'))
    const [workTransactionView, setWorkTransactionView] = useState<WorkTransactionView>('active')
    const [isExpert, setIsExpert] = useState(false)
    const [name, setName] = useState('')
    const [reviewOpen, setReviewOpen] = useState(false)
    const [reviewSubmitted, setReviewSubmitted] = useState(false)
    const [reviewRating, setReviewRating] = useState('5')
    const [reviewContent, setReviewContent] = useState('')
    const [products, setProducts] = useState<ExpertProduct[]>([])
    const [proposals, setProposals] = useState<Proposal[]>([])
    const [serviceRequests, setServiceRequests] = useState<ServiceRequestData[]>([])
    const [reviews, setReviews] = useState<Review[]>([])
    const [works, setWorks] = useState<Work[]>([])
    const [consultations, setConsultations] = useState<Consultation[]>([])
    const [consultationMessages, setConsultationMessages] = useState<ConsultationMessage[]>([])
    const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([])
    const [consultationMessageBody, setConsultationMessageBody] = useState('')
    const [consultationMessageSubmitting, setConsultationMessageSubmitting] = useState(false)
    const [consultationMessageError, setConsultationMessageError] = useState('')
    const [consultationActionMessage, setConsultationActionMessage] = useState('')
    const [consultationActionError, setConsultationActionError] = useState('')
    const [selectedReviewWork, setSelectedReviewWork] = useState<Work | null>(null)
    const [profilePreview, setProfilePreview] = useState<ProfilePreview | null>(null)
    const [profilePreviewLoaded, setProfilePreviewLoaded] = useState(false)
    const workRoleSelectedByUserRef = useRef(false)
    const myPageReturnState = { from: { pathname: location.pathname, search: location.search } }
    const userId = user?.id
    const userEmail = user?.email

    const fetchProfile = useCallback(async () => {
        if (!userId) return
        setProfilePreviewLoaded(false)

        const [displayProfile, storedProfile] = await Promise.all([
            getUserDisplayProfile(userId).catch(() => null),
            getStoredProfile(userId).catch(() => null),
        ])
        const fallbackName = userEmail?.split('@')[0] || 'AIConnect 사용자'
        const nextName = displayProfile?.name || storedProfile?.name || fallbackName
        const nextIsExpert = Boolean(displayProfile?.isExpert || storedProfile?.aiTools?.length || storedProfile?.profession)

        setIsExpert(nextIsExpert)
        setName(nextName)
        setProfilePreview({
            name: nextName,
            imageUrl: displayProfile?.imageUrl || storedProfile?.imageUrl || '',
            roleLabel: nextIsExpert ? '메이커 프로필' : '의뢰자 프로필',
            oneLiner: storedProfile?.oneLiner || storedProfile?.greeting || '아직 소개 문구가 등록되지 않았습니다.',
            aiTools: storedProfile?.aiTools || [],
            sampleLinks: storedProfile?.sampleLinks || [],
        })
        setProfilePreviewLoaded(true)
    }, [userEmail, userId])

    useEffect(() => {
        if (!loading && !session) {
            navigate(ROUTES.LOGIN)
        }
    }, [session, loading, navigate])

    useEffect(() => {
        if (!menuItems.some((item) => item.id === activePanel)) {
            setActivePanel(defaultPanel)
        }
    }, [activePanel, defaultPanel, menuItems])

    useEffect(() => {
        const currentParams = new URLSearchParams(searchParamString)
        const rawPanel = currentParams.get('panel')
        const requestedRole = currentParams.get('role')
        const panel = normalizeWorkPanel(rawPanel, mode)
        const clientOrder = currentParams.get('clientOrder')
        const expertRequest = currentParams.get('expertRequest')
        const consultation = currentParams.get('consultation')
        const nextPanel = isMyPagePanel(panel, menuItems) ? panel : defaultPanel

        if (mode === 'work' && !workRoleSelectedByUserRef.current) {
            const nextRole = requestedRole === 'expert' || rawPanel === 'expert'
                ? 'expert'
                : requestedRole === 'client'
                    ? 'client'
                    : workRole
            if (nextRole !== workRole) setWorkRole(nextRole)
        }
        setActivePanel((currentPanel) => (currentPanel === nextPanel ? currentPanel : nextPanel))
        setSelectedClientOrderId((currentId) => (currentId === clientOrder ? currentId : clientOrder))
        setSelectedExpertRequestId((currentId) => (currentId === expertRequest ? currentId : expertRequest))
        if (!(mode === 'work' && nextPanel === 'consultations' && workRoleSelectedByUserRef.current)) {
            setSelectedConsultationId((currentId) => (currentId === consultation ? currentId : consultation))
        }
    }, [defaultPanel, menuItems, mode, searchParamString, workRole])

    useEffect(() => {
        const currentParams = new URLSearchParams(searchParamString)
        const panel = normalizeWorkPanel(currentParams.get('panel'), mode)
        const panelFromUrl = isMyPagePanel(panel, menuItems) ? panel : defaultPanel
        if (panelFromUrl !== activePanel) return

        const nextParams = new URLSearchParams()
        if (mode === 'work' && workRole === 'expert') nextParams.set('role', 'expert')
        if (activePanel !== defaultPanel) nextParams.set('panel', activePanel)
        if (activePanel === 'client' && mode === 'work' && workRole === 'expert' && selectedExpertRequestId) nextParams.set('expertRequest', String(selectedExpertRequestId))
        if (activePanel === 'client' && !(mode === 'work' && workRole === 'expert') && selectedClientOrderId) nextParams.set('clientOrder', String(selectedClientOrderId))
        if (activePanel === 'expert' && selectedExpertRequestId) nextParams.set('expertRequest', String(selectedExpertRequestId))
        if (activePanel === 'consultations' && selectedConsultationId) nextParams.set('consultation', selectedConsultationId)

        if (currentParams.toString() !== nextParams.toString()) {
            setSearchParams(nextParams, { replace: true })
        }
    }, [activePanel, defaultPanel, menuItems, mode, selectedClientOrderId, selectedExpertRequestId, selectedConsultationId, searchParamString, setSearchParams, workRole])

    useEffect(() => {
        if (!userId) return

        fetchProfile()
        getUserProposals(userId).then(setProposals).catch((error) => {
            console.error('제안서 목록 로딩 오류:', error)
            setProposals([])
        })
        getUserServiceRequests(userId).then(setServiceRequests).catch((error) => {
            console.error('의뢰 요청 목록 로딩 오류:', error)
            setServiceRequests([])
        })
        getUserWorks(userId).then(setWorks).catch((error) => {
            console.error('작업 목록 로딩 오류:', error)
            setWorks([])
        })
        getUserReviews(userId).then(setReviews).catch((error) => {
            console.error('리뷰 목록 로딩 오류:', error)
            setReviews([])
        })
        getUserConsultations(userId).then(setConsultations).catch((error) => {
            console.error('상담 목록 로딩 오류:', error)
            setConsultations([])
        })
        getExpertProducts().then(setProducts).catch((error) => {
            console.error('상품 목록 로딩 오류:', error)
            setProducts([])
        })
        getUserFavoriteProductIds(userId).then(setFavoriteProductIds).catch(() => {
            setFavoriteProductIds([])
        })
    }, [fetchProfile, userId])

    useEffect(() => {
        if (!userId || activePanel !== 'consultations') return

        let cancelled = false
        const refreshConsultations = () => {
            getUserConsultations(userId)
                .then((items) => {
                    if (cancelled) return
                    setConsultations(items)
                    dispatchNotificationRefresh()
                })
                .catch((error) => {
                    console.error('상담 목록 자동 갱신 오류:', error)
                })
        }
        const interval = window.setInterval(refreshConsultations, consultationListRefreshIntervalMs)

        return () => {
            cancelled = true
            window.clearInterval(interval)
        }
    }, [activePanel, userId])

    useEffect(() => {
        const currentParams = new URLSearchParams(searchParamString)
        const panel = currentParams.get('panel')
        if (panel === 'consultations' && activePanel === 'consultations' && !selectedConsultationId && consultations.length > 0) {
            setSelectedConsultationId(consultations[0].id)
        }
    }, [activePanel, consultations, searchParamString, selectedConsultationId])

    useEffect(() => {
        if (!selectedConsultationId) {
            setConsultationMessages([])
            return
        }

        getConsultationMessages(selectedConsultationId)
            .then(setConsultationMessages)
            .catch((error) => {
                console.error('상담 메시지 로딩 오류:', error)
                setConsultationMessages([])
            })
    }, [selectedConsultationId])

    useEffect(() => {
        if (!selectedConsultationId) return

        let cancelled = false
        const refreshMessages = () => {
            getConsultationMessages(selectedConsultationId)
                .then((messages) => {
                    if (cancelled) return
                    setConsultationMessages((current) => mergeConsultationMessages(current, messages))
                })
                .catch((error) => {
                    console.error('상담 메시지 자동 갱신 오류:', error)
                })
        }
        const interval = window.setInterval(refreshMessages, consultationMessageRefreshIntervalMs)

        return () => {
            cancelled = true
            window.clearInterval(interval)
        }
    }, [selectedConsultationId])

    useEffect(() => {
        if (!selectedConsultationId) return

        return subscribeToConsultationMessages(selectedConsultationId, (message) => {
            setConsultationMessages((current) => mergeConsultationMessages(current, message))
            setConsultations((current) =>
                current.map((consultation) =>
                    consultation.id === selectedConsultationId
                        ? { ...consultation, lastMessageAt: message.createdAt }
                        : consultation,
                ),
            )
            dispatchNotificationRefresh()
        })
    }, [selectedConsultationId])

    useEffect(() => {
        setConsultationMessageBody('')
        setConsultationMessageError('')
        setConsultationActionMessage('')
        setConsultationActionError('')
    }, [selectedConsultationId])

    const completedWork = works.find((work) => work.status === 'completed') || null
    const receivedProposals = proposals.filter((proposal) => proposal.clientId === user?.id)
    const sentProposals = proposals.filter((proposal) => proposal.expertId === user?.id)
    const activeProposals = proposals.filter((proposal) => proposal.status !== 'cancelled')
    const receivedProductRequests = serviceRequests.filter((request) => request.expertId === user?.id && request.productId)
    const clientProductRequests = serviceRequests.filter((request) => request.clientId === user?.id && request.productId)
    const clientConsultations = consultations.filter((consultation) => consultation.clientId === user?.id)
    const expertConsultations = consultations.filter((consultation) => consultation.expertId === user?.id)
    const myProducts = products.filter((product) => product.expertId === user?.id)
    const favoriteProducts = favoriteProductIds
        .map((productId) => products.find((product) => product.id === productId))
        .filter((product): product is ExpertProduct => Boolean(product))
    const activeWorks = works.filter((work) => work.status !== 'completed' && work.status !== 'cancelled')
    const completedWorks = works.filter((work) => work.status === 'completed')
    const clientActiveWorks = activeWorks.filter((work) => work.clientId === user?.id)
    const expertActiveWorks = activeWorks.filter((work) => work.expertId === user?.id)
    const clientCompletedWorks = completedWorks.filter((work) => work.clientId === user?.id)
    const expertCompletedWorks = completedWorks.filter((work) => work.expertId === user?.id)
    const roleFilteredActiveWorks = mode === 'work'
        ? workRole === 'client' ? clientActiveWorks : expertActiveWorks
        : activeWorks
    const roleFilteredCompletedWorks = mode === 'work'
        ? workRole === 'client' ? clientCompletedWorks : expertCompletedWorks
        : completedWorks
    const roleFilteredProjectWorks = [...roleFilteredActiveWorks, ...roleFilteredCompletedWorks]
    const pageTitle = mode === 'work' ? '내 작업' : '마이페이지'
    const pageDescription = mode === 'profile'
        ? '프로필과 계정 기본 정보를 확인합니다.'
        : '의뢰, 제안, 프로젝트, 완료 리뷰를 한 곳에서 관리합니다.'
    const menuLabel = mode === 'work' ? '내 작업 메뉴' : '마이페이지 메뉴'

    const getProposalForRequest = (request: ServiceRequestData) =>
        activeProposals.find((proposal) => proposal.requestId === request.id)

    const getProposalsForRequest = (request: ServiceRequestData) =>
        proposals.filter((proposal) => proposal.requestId === request.id)

    const getWorkForRequest = (request: ServiceRequestData) => {
        const requestProposal = getProposalForRequest(request)
        return works.find((work) => work.status !== 'cancelled' && (work.requestId === request.id || work.proposalId === requestProposal?.id)) || null
    }

    const getWorkForRequestIncludingStopped = (request: ServiceRequestData) => {
        const proposalIds = getProposalsForRequest(request).map((proposal) => proposal.id)
        return works.find((work) => work.requestId === request.id || proposalIds.includes(work.proposalId)) || null
    }

    const getRequestCreatedTime = (request: ServiceRequestData) => {
        const parsed = Date.parse(request.createdAt || '')
        return Number.isNaN(parsed) ? 0 : parsed
    }

    const sortRequestsByCreatedAtDesc = (requests: ServiceRequestData[]) =>
        [...requests].sort((first, second) => getRequestCreatedTime(second) - getRequestCreatedTime(first))

    const getConsultationCreatedTime = (consultation: Consultation) => {
        const parsed = Date.parse(consultation.lastMessageAt || consultation.createdAt || '')
        return Number.isNaN(parsed) ? 0 : parsed
    }

    const sortConsultationsByCreatedAtDesc = (items: Consultation[]) =>
        [...items].sort((first, second) => getConsultationCreatedTime(second) - getConsultationCreatedTime(first))

    const clientProductRequestsByCreatedAt = sortRequestsByCreatedAtDesc(clientProductRequests)
    const receivedProductRequestsByCreatedAt = sortRequestsByCreatedAtDesc(receivedProductRequests)
    const clientConsultationsByCreatedAt = sortConsultationsByCreatedAtDesc(clientConsultations)
    const expertConsultationsByCreatedAt = sortConsultationsByCreatedAtDesc(expertConsultations)
    const roleFilteredConsultations = mode === 'work'
        ? workRole === 'client' ? clientConsultationsByCreatedAt : expertConsultationsByCreatedAt
        : consultations

    type UnifiedWorkStopReason = 'cancelled-request' | 'cancelled-work' | 'cancelled-proposal'
    type UnifiedWorkItem =
        | { kind: 'product'; id: string | number; createdTime: number; request: ServiceRequestData; stoppedReason?: UnifiedWorkStopReason }
        | { kind: 'consultation'; id: string; createdTime: number; consultation: Consultation }

    const sortUnifiedWorkItems = (items: UnifiedWorkItem[]) =>
        [...items].sort((first, second) => second.createdTime - first.createdTime)

    const clientUnifiedWorkItems = sortUnifiedWorkItems([
        ...clientProductRequestsByCreatedAt.map((request): UnifiedWorkItem => ({
            kind: 'product',
            id: request.id,
            createdTime: getRequestCreatedTime(request),
            request,
        })),
    ])

    const expertUnifiedWorkItems = sortUnifiedWorkItems([
        ...receivedProductRequestsByCreatedAt.map((request): UnifiedWorkItem => ({
            kind: 'product',
            id: request.id,
            createdTime: getRequestCreatedTime(request),
            request,
        })),
    ])
    const shouldShowListFirst = mode === 'work'

    const selectedClientUnifiedWorkItem =
        (selectedClientOrderId
            ? clientUnifiedWorkItems.find((item) => item.kind === 'product' && item.id === selectedClientOrderId)
            : null) ||
        (selectedConsultationId
            ? clientUnifiedWorkItems.find((item) => item.kind === 'consultation' && item.id === selectedConsultationId)
            : null) ||
        (!shouldShowListFirst ? clientUnifiedWorkItems[0] : null) ||
        null

    const selectedExpertUnifiedWorkItem =
        (selectedExpertRequestId
            ? expertUnifiedWorkItems.find((item) => item.kind === 'product' && item.id === selectedExpertRequestId)
            : null) ||
        (selectedConsultationId
            ? expertUnifiedWorkItems.find((item) => item.kind === 'consultation' && item.id === selectedConsultationId)
            : null) ||
        (!shouldShowListFirst ? expertUnifiedWorkItems[0] : null) ||
        null

    const selectedClientOrder = selectedClientOrderId
        ? clientProductRequestsByCreatedAt.find((request) => request.id === selectedClientOrderId) || null
        : !shouldShowListFirst
            ? clientProductRequestsByCreatedAt[0] || null
        : null
    const selectedClientOrderProduct = selectedClientOrder
        ? products.find((product) => product.id === selectedClientOrder.productId)
        : null
    const selectedClientOrderProposal = selectedClientOrder
        ? receivedProposals.find((proposal) => proposal.requestId === selectedClientOrder.id && proposal.status !== 'cancelled')
        : null
    const selectedClientOrderWork = selectedClientOrder
        ? works.find((work) => work.status !== 'cancelled' && (work.requestId === selectedClientOrder.id || work.proposalId === selectedClientOrderProposal?.id))
        : null
    const selectedExpertRequest = selectedExpertRequestId
        ? receivedProductRequestsByCreatedAt.find((request) => request.id === selectedExpertRequestId) || null
        : !shouldShowListFirst
            ? receivedProductRequestsByCreatedAt[0] || null
        : null
    const selectedExpertRequestProduct = selectedExpertRequest
        ? products.find((product) => product.id === selectedExpertRequest.productId)
        : null
    const selectedExpertRequestProposal = selectedExpertRequest
        ? sentProposals.find((proposal) => proposal.requestId === selectedExpertRequest.id && proposal.status !== 'cancelled')
        : null
    const selectedExpertRequestWork = selectedExpertRequest ? getWorkForRequest(selectedExpertRequest) : null
    const selectedPanelConsultation = roleFilteredConsultations.find((consultation) => consultation.id === selectedConsultationId) || roleFilteredConsultations[0] || null
    const selectedConsultation = consultations.find((consultation) => consultation.id === selectedConsultationId) || selectedPanelConsultation || consultations[0] || null
    const selectedClientConsultation = clientConsultationsByCreatedAt.find((consultation) => consultation.id === selectedConsultationId) || clientConsultationsByCreatedAt[0] || null
    const selectedExpertConsultation = expertConsultationsByCreatedAt.find((consultation) => consultation.id === selectedConsultationId) || expertConsultationsByCreatedAt[0] || null
    const selectedPanelConsultationProduct = selectedPanelConsultation
        ? products.find((product) => product.id === selectedPanelConsultation.productId)
        : null

    useEffect(() => {
        if (mode !== 'work' || activePanel !== 'consultations' || !selectedConsultationId || !user) return
        if (workRoleSelectedByUserRef.current) return
        const selected = consultations.find((consultation) => consultation.id === selectedConsultationId)
        if (!selected) return

        if (selected.clientId === user.id && workRole !== 'client') {
            setWorkRole('client')
            return
        }

        if (selected.expertId === user.id && selected.clientId !== user.id && workRole !== 'expert') {
            setWorkRole('expert')
        }
    }, [activePanel, consultations, mode, selectedConsultationId, user, workRole])

    const handleSendConsultationMessage = async () => {
        if (!user || !selectedConsultation) return
        const body = consultationMessageBody.trim()
        if (!body) {
            setConsultationMessageError('메시지를 입력해주세요.')
            return
        }

        const validation = validateMarketplaceMessage(body)
        if (!validation.allowed) {
            setConsultationMessageError(validation.message)
            return
        }

        setConsultationMessageSubmitting(true)
        setConsultationMessageError('')
        try {
            const message = await saveConsultationMessage({
                consultationId: selectedConsultation.id,
                senderId: user.id,
                body,
            })
            setConsultationMessages((current) => mergeConsultationMessages(current, message))
            setConsultations((current) =>
                current.map((consultation) =>
                    consultation.id === selectedConsultation.id
                        ? { ...consultation, lastMessageAt: message.createdAt }
                        : consultation,
                ),
            )
            setConsultationMessageBody('')
            dispatchNotificationRefresh()
        } catch (error) {
            console.error('상담 메시지 전송 오류:', error)
            setConsultationMessageError('메시지를 보내지 못했습니다. 잠시 후 다시 시도해주세요.')
        } finally {
            setConsultationMessageSubmitting(false)
        }
    }

    const handleEndConsultation = async () => {
        if (!selectedPanelConsultation) return

        setConsultationActionMessage('')
        setConsultationActionError('')
        try {
            const closed = await closeConsultation(selectedPanelConsultation.id)
            setConsultations((current) =>
                current.map((consultation) =>
                    consultation.id === closed.id ? closed : consultation,
                ),
            )
            setConsultationActionMessage('상담이 종료되었습니다.')
            dispatchNotificationRefresh()
        } catch (error) {
            console.error('상담 종료 오류:', error)
            setConsultationActionError('상담을 종료하지 못했습니다. 잠시 후 다시 시도해주세요.')
        }
    }

    const handleReportConsultation = async () => {
        if (!user || !selectedPanelConsultation) return

        setConsultationActionMessage('')
        setConsultationActionError('')
        try {
            await saveConsultationReport({
                consultationId: selectedPanelConsultation.id,
                reporterId: user.id,
            })
            setConsultationActionMessage('신고가 접수되었습니다. 관리자가 내용을 확인합니다.')
        } catch (error) {
            console.error('상담 신고 오류:', error)
            setConsultationActionError('신고를 접수하지 못했습니다. 잠시 후 다시 시도해주세요.')
        }
    }

    const handleCreateConsultationProposal = async () => {
        if (!selectedConsultation || !user || selectedConsultation.expertId !== user.id) return

        const params = new URLSearchParams({
            requestId: `consultation-${selectedConsultation.id}`,
            consultation: selectedConsultation.id,
        })
        navigate(`${ROUTES.PROPOSAL_NEW}?${params.toString()}`, { state: myPageReturnState })
    }

    const getRoleConsultationId = () => {
        if (mode !== 'work') return selectedConsultationId
        const roleConsultations = workRole === 'client' ? clientConsultationsByCreatedAt : expertConsultationsByCreatedAt
        if (selectedConsultationId && roleConsultations.some((consultation) => consultation.id === selectedConsultationId)) {
            return selectedConsultationId
        }
        return roleConsultations[0]?.id || null
    }

    const getPanelSearchParams = (panel: MyPagePanel) => {
        const nextParams = new URLSearchParams()
        if (mode === 'work' && workRole === 'expert') nextParams.set('role', 'expert')
        if (panel !== defaultPanel) nextParams.set('panel', panel)
        if (panel === 'client' && mode === 'work' && workRole === 'expert' && selectedExpertRequestId) nextParams.set('expertRequest', String(selectedExpertRequestId))
        if (panel === 'client' && !(mode === 'work' && workRole === 'expert') && selectedClientOrderId) nextParams.set('clientOrder', String(selectedClientOrderId))
        if (panel === 'expert' && selectedExpertRequestId) nextParams.set('expertRequest', String(selectedExpertRequestId))
        if (panel === 'consultations') {
            const consultationId = getRoleConsultationId()
            if (consultationId) nextParams.set('consultation', consultationId)
        }
        return nextParams
    }

    const handlePanelChange = (panel: MyPagePanel) => {
        if (panel === 'consultations') {
            setSelectedConsultationId(getRoleConsultationId())
        }
        setSearchParams(getPanelSearchParams(panel))
    }

    const handleWorkRoleChange = (nextRole: 'client' | 'expert') => {
        workRoleSelectedByUserRef.current = true
        setWorkRole(nextRole)
        const nextParams = new URLSearchParams()
        if (nextRole === 'expert') nextParams.set('role', 'expert')
        setActivePanel('client')
        setSearchParams(nextParams)
        if (activePanel !== 'consultations') return

        const nextConsultation = nextRole === 'client'
            ? clientConsultationsByCreatedAt[0] || null
            : expertConsultationsByCreatedAt[0] || null

        setSelectedConsultationId(nextConsultation?.id || null)
    }

    const handleDeleteAccount = async () => {
        if (!user) return
        const confirmed = window.confirm('탈퇴하면 프로필, 상품, 상담, 제안서, 작업 데이터가 삭제됩니다. 계속할까요?')
        if (!confirmed) return

        try {
            await deleteUserPublicAccountData(user.id)
            await signOut()
            navigate(ROUTES.HOME)
        } catch (error) {
            alert(error instanceof Error ? error.message : '회원 탈퇴 처리에 실패했습니다.')
        }
    }

    const renderWorkRoleSwitch = () => (
        <div className="work-role-switch" data-testid="work-dashboard-role-switch">
            <div className="work-role-toggle" aria-label="내 작업 역할 전환">
                <span
                    aria-hidden="true"
                    className={`work-role-toggle-indicator ${workRole === 'expert' ? 'is-expert' : 'is-client'}`}
                />
                <button
                    className="work-role-toggle-button"
                    type="button"
                    aria-pressed={workRole === 'client'}
                    onClick={() => handleWorkRoleChange('client')}
                >
                    <svg
                        className="work-role-toggle-icon"
                        data-testid="work-role-client-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <path d="M12 12.2a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4Z" />
                        <path d="M4.8 20.2c0.7-3.4 3.3-5.4 7.2-5.4s6.5 2 7.2 5.4" />
                    </svg>
                    <span>의뢰자</span>
                </button>
                <button
                    className="work-role-toggle-button"
                    type="button"
                    aria-pressed={workRole === 'expert'}
                    onClick={() => handleWorkRoleChange('expert')}
                >
                    <svg
                        className="work-role-toggle-icon"
                        data-testid="work-role-expert-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <path d="M12 11.7a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z" />
                        <path d="M5 20.2c0.7-3.6 3.2-5.6 7-5.6s6.3 2 7 5.6" />
                        <path d="M10.4 14.8 12 16.4l1.6-1.6" />
                        <path className="work-role-toggle-tie" d="M12 16.4 10.9 20.2h2.2L12 16.4Z" />
                    </svg>
                    <span>전문가</span>
                </button>
            </div>
        </div>
    )

    const renderWorkMenuIcon = (panel: MyPagePanel) => {
        const iconPath = {
            client: 'M4 7.5h16M7 5h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm2 7h6m-6 4h4',
            favorites: 'M12 20.5 10.7 19C6 14.7 3 12 3 8.7A4.7 4.7 0 0 1 7.7 4c1.7 0 3.3.8 4.3 2.1A5.1 5.1 0 0 1 16.3 4 4.7 4.7 0 0 1 21 8.7c0 3.3-3 6-7.7 10.3L12 20.5Z',
            consultations: 'M5 6.5h14a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-5l-4 3v-3H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z',
            workroom: 'M4 7h6l1.5 2H20v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z',
            reviews: 'M12 4.5 14.2 9l5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 9.7l5-.7L12 4.5Z',
            products: 'M5 5h14v4H5V5Zm0 7h14v7H5v-7Z',
            expert: 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 8c.8-3.5 3-5.5 6-5.5s5.2 2 6 5.5',
            overview: 'M5 5h6v6H5V5Zm8 0h6v6h-6V5ZM5 13h6v6H5v-6Zm8 0h6v6h-6v-6Z',
            profile: 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 8c.8-3.5 3-5.5 6-5.5s5.2 2 6 5.5',
        }[panel] || 'M5 6h14M5 12h14M5 18h14'

        return (
            <span className="work-dashboard-menu-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                    <path d={iconPath} />
                </svg>
            </span>
        )
    }

    const renderWorkTransactionTabs = () => (
        <div className="work-transaction-tabs" aria-label="거래 상태 보기">
            <button
                type="button"
                aria-pressed={workTransactionView === 'active'}
                onClick={() => setWorkTransactionView('active')}
            >
                진행중인 거래
            </button>
            <button
                type="button"
                aria-pressed={workTransactionView === 'stopped'}
                onClick={() => setWorkTransactionView('stopped')}
            >
                중단된 거래
            </button>
        </div>
    )

    const createWorkStage = (
        phase: string,
        title: string,
        description: string,
        state: StageVisualState,
        action?: StageAction | StageAction[],
    ): WorkStageView => ({
        phase,
        title,
        description,
        state,
        actions: normalizeStageActions(action),
    })

    const getRequestStatusLabel = (request: ServiceRequestData) => {
        const requestWork = getWorkForRequest(request)
        if (requestWork) return workStatusText[requestWork.status]

        const requestProposal = getProposalForRequest(request)
        if (requestProposal) {
            if (requestProposal.paymentStatus === 'paid') return '결제 완료'
            return proposalStatusText[requestProposal.status]
        }

        if (request.status === 'completed') return '완료'
        if (request.status === 'cancelled') return '취소'
        if (request.status === 'pending') return '접수'
        return '진행 중'
    }

    const getConsultationStatusLabel = (consultation: Consultation) => {
        if (consultation.status === 'proposal_sent') return '제안서 발송'
        if (consultation.status === 'closed') return '종료'
        return '상담 중'
    }

    const getUnifiedWorkStatusLabel = (item: UnifiedWorkItem) =>
        isUnifiedWorkStopped(item)
            ? '중단'
            : item.kind === 'product'
            ? getRequestStatusLabel(item.request)
            : getConsultationStatusLabel(item.consultation)

    const formatTransactionDate = (value?: number | string | null) => {
        if (!value) return '-'
        const date = typeof value === 'number' ? new Date(value) : new Date(value)
        if (Number.isNaN(date.getTime())) return '-'
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}.${month}.${day}`
    }

    const formatTransactionDateTime = (value?: number | string | null) => {
        if (!value) return '-'
        const date = typeof value === 'number' ? new Date(value) : new Date(value)
        if (Number.isNaN(date.getTime())) return '-'
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${formatTransactionDate(value)} ${hours}:${minutes}`
    }

    const getUnifiedWorkProduct = (item: UnifiedWorkItem) =>
        item.kind === 'product'
            ? products.find((entry) => entry.id === item.request.productId)
            : products.find((entry) => entry.id === item.consultation.productId)

    const getUnifiedWorkTitle = (item: UnifiedWorkItem) => {
        const product = getUnifiedWorkProduct(item)
        return item.kind === 'product'
            ? product?.title || item.request.desiredResult || item.request.title
            : product?.title || item.consultation.title
    }

    const getUnifiedWorkTypeLabel = (item: UnifiedWorkItem) =>
        item.kind === 'consultation' ? '전문가 문의' : '상품 주문'

    const getUnifiedWorkCreatedAt = (item: UnifiedWorkItem) =>
        item.kind === 'product' ? item.request.createdAt : item.consultation.createdAt

    const getUnifiedWorkStatusTone = (item: UnifiedWorkItem): WorkStatusTone => {
        if (isUnifiedWorkStopped(item)) return 'stopped'

        if (item.kind === 'consultation') {
            if (item.consultation.status === 'closed') return 'stopped'
            if (item.consultation.status === 'proposal_sent') return 'payment'
            return 'consultation'
        }

        const requestWork = getWorkForRequest(item.request)
        if (requestWork?.status === 'cancelled' || item.request.status === 'cancelled') return 'stopped'
        if (requestWork?.status === 'completed' || item.request.status === 'completed') return 'done'
        if (requestWork) return 'work'

        const requestProposal = getProposalForRequest(item.request)
        if (requestProposal && requestProposal.paymentStatus !== 'paid') return 'payment'
        return 'consultation'
    }

    const isUnifiedWorkStopped = (item: UnifiedWorkItem) => {
        if (item.kind === 'consultation') return item.consultation.status === 'closed'
        if (item.stoppedReason) return true
        const requestWork = getWorkForRequestIncludingStopped(item.request)
        return item.request.status === 'cancelled' || requestWork?.status === 'cancelled'
    }

    const getStoppedProductReason = (request: ServiceRequestData): UnifiedWorkStopReason | undefined => {
        const requestWork = getWorkForRequestIncludingStopped(request)
        if (request.status === 'cancelled') return 'cancelled-request'
        if (requestWork?.status === 'cancelled') return 'cancelled-work'
        if (getProposalsForRequest(request).some((proposal) => proposal.status === 'cancelled')) return 'cancelled-proposal'
        return undefined
    }

    const createStoppedProductItem = (request: ServiceRequestData): UnifiedWorkItem | null => {
        const stoppedReason = getStoppedProductReason(request)
        if (!stoppedReason) return null
        return {
            kind: 'product',
            id: request.id,
            createdTime: getRequestCreatedTime(request),
            request,
            stoppedReason,
        }
    }

    const isPresentUnifiedWorkItem = (item: UnifiedWorkItem | null): item is UnifiedWorkItem => Boolean(item)

    const getTransactionNumber = (item: UnifiedWorkItem) => {
        const date = new Date(item.createdTime)
        const year = Number.isNaN(date.getTime()) ? '0000' : String(date.getFullYear())
        const month = Number.isNaN(date.getTime()) ? '00' : String(date.getMonth() + 1).padStart(2, '0')
        const day = Number.isNaN(date.getTime()) ? '00' : String(date.getDate()).padStart(2, '0')
        const rawId = String(item.id).replace(/[^a-zA-Z0-9]/g, '').slice(-3).toUpperCase().padStart(3, '0')
        return `TR-${year}-${month}${day}-${rawId}`
    }

    const buildWorkDetailHero = (item: UnifiedWorkItem, onBack: () => void): WorkDetailHero => {
        const product = getUnifiedWorkProduct(item)
        const title = getUnifiedWorkTitle(item)

        return {
            typeLabel: getUnifiedWorkTypeLabel(item),
            statusLabel: getUnifiedWorkStatusLabel(item),
            statusTone: getUnifiedWorkStatusTone(item),
            transactionNumber: getTransactionNumber(item),
            createdAtLabel: formatTransactionDate(getUnifiedWorkCreatedAt(item)),
            imageUrl: product?.sampleImageUrl,
            imageAlt: `${title} 대표 이미지`,
            onBack,
        }
    }

    const getBudgetInfoValue = (request: ServiceRequestData, isConfirmed: boolean) => {
        if (!isConfirmed) return '-'
        return request.budget ? `${Number(request.budget).toLocaleString()}원` : '-'
    }

    const getDeadlineInfoValue = (request: ServiceRequestData, isConfirmed: boolean) =>
        isConfirmed ? request.deadline || '-' : '-'

    const getReferenceInfoValue = (request: ServiceRequestData, isConfirmed: boolean) =>
        isConfirmed ? `${request.referenceLinks?.length || 0}개` : '-'

    const getProductInfoItems = (request: ServiceRequestData, isConfirmed: boolean): WorkInfoItem[] => [
        { label: '거래 방식', value: '상품 주문' },
        { label: '등록일', value: formatTransactionDateTime(request.createdAt) },
        { label: '예산', value: getBudgetInfoValue(request, isConfirmed) },
        { label: '마감일', value: getDeadlineInfoValue(request, isConfirmed) },
        { label: '참고자료', value: getReferenceInfoValue(request, isConfirmed) },
    ]

    const getConsultationInfoItems = (
        consultation: Consultation,
        proposal: Proposal | undefined,
        isConfirmed: boolean,
    ): WorkInfoItem[] => [
        { label: '거래 방식', value: '문의형 거래' },
        { label: '등록일', value: formatTransactionDateTime(consultation.createdAt) },
        { label: '예산', value: isConfirmed && proposal ? `${proposal.totalPrice.toLocaleString()}원` : '-' },
        { label: '마감일', value: isConfirmed && proposal ? `${proposal.deliveryDays}일` : '-' },
        { label: '참고자료', value: '-' },
    ]

    const getProductActivityItems = (
        request: ServiceRequestData,
        proposal: Proposal | undefined,
        work: Work | undefined,
        role: 'client' | 'expert',
    ): WorkActivityItem[] => {
        const items: WorkActivityItem[] = [
            {
                title: role === 'expert' ? '의뢰서 접수' : '의뢰서 작성',
                description: request.desiredResult || request.description || request.title || '의뢰서 내용이 접수되었습니다.',
                timeLabel: formatTransactionDateTime(request.createdAt),
                state: 'done',
            },
        ]

        if (proposal) {
            const proposalIsConfirmed = Boolean(work || proposal.paymentStatus === 'paid')
            items.push({
                title: '제안서 작성',
                description: proposal.scope || proposal.title,
                timeLabel: proposalIsConfirmed ? '완료됨' : proposalStatusText[proposal.status],
                state: proposalIsConfirmed ? 'done' : 'current',
            })

            if (proposalIsConfirmed) {
                items.push({
                    title: '결제 완료',
                    description: `${proposal.totalPrice.toLocaleString()}원 · ${proposal.deliveryDays}일 작업`,
                    timeLabel: '완료됨',
                    state: 'done',
                })
            }
        }

        if (work) {
            const workTitle =
                work.status === 'submitted'
                    ? '결과물 제출'
                    : work.status === 'revision_requested'
                        ? '수정 요청'
                        : work.status === 'completed'
                            ? '프로젝트 완료'
                            : '프로젝트 진행'
            items.push({
                title: workTitle,
                description: role === 'expert' ? getExpertWorkStageDescription(work) : getClientWorkStageDescription(work),
                timeLabel: workStatusText[work.status],
                state: work.status === 'completed' ? 'done' : 'current',
            })
        }

        return items
    }

    const getConsultationActivityItems = (
        consultation: Consultation,
        proposal: Proposal | undefined,
    ): WorkActivityItem[] => {
        const items: WorkActivityItem[] = [
            {
                title: '상담 시작',
                description: consultation.title,
                timeLabel: formatTransactionDateTime(consultation.createdAt),
                state: consultation.status === 'open' ? 'current' : 'done',
            },
            {
                title: '최근 상담 메시지',
                description: '채팅에서 작업 범위와 조건을 협의했습니다.',
                timeLabel: formatTransactionDateTime(consultation.lastMessageAt),
                state: consultation.status === 'open' ? 'current' : 'done',
            },
        ]

        if (proposal) {
            items.push({
                title: '제안서 작성',
                description: proposal.scope || proposal.title,
                timeLabel: proposal.paymentStatus === 'paid' ? '완료됨' : proposalStatusText[proposal.status],
                state: proposal.paymentStatus === 'paid' ? 'done' : 'current',
            })
        }

        return items
    }

    const clearSelectedTransaction = () => {
        setSelectedClientOrderId(null)
        setSelectedExpertRequestId(null)
        setSelectedConsultationId(null)
        const nextParams = new URLSearchParams()
        if (mode === 'work' && workRole === 'expert') nextParams.set('role', 'expert')
        if (activePanel !== defaultPanel) nextParams.set('panel', activePanel)
        setSearchParams(nextParams)
    }

    const clientActiveUnifiedWorkItems = clientUnifiedWorkItems.filter((item) => !isUnifiedWorkStopped(item))
    const expertActiveUnifiedWorkItems = expertUnifiedWorkItems.filter((item) => !isUnifiedWorkStopped(item))
    const clientStoppedUnifiedWorkItems = sortUnifiedWorkItems([
        ...clientProductRequestsByCreatedAt.map(createStoppedProductItem).filter(isPresentUnifiedWorkItem),
    ])
    const expertStoppedUnifiedWorkItems = sortUnifiedWorkItems([
        ...receivedProductRequestsByCreatedAt.map(createStoppedProductItem).filter(isPresentUnifiedWorkItem),
    ])
    const selectedClientStoppedUnifiedWorkItem =
        (selectedClientOrderId
            ? clientStoppedUnifiedWorkItems.find((item) => item.kind === 'product' && item.id === selectedClientOrderId)
            : null) ||
        (selectedConsultationId
            ? clientStoppedUnifiedWorkItems.find((item) => item.kind === 'consultation' && item.id === selectedConsultationId)
            : null) ||
        null
    const selectedExpertStoppedUnifiedWorkItem =
        (selectedExpertRequestId
            ? expertStoppedUnifiedWorkItems.find((item) => item.kind === 'product' && item.id === selectedExpertRequestId)
            : null) ||
        (selectedConsultationId
            ? expertStoppedUnifiedWorkItems.find((item) => item.kind === 'consultation' && item.id === selectedConsultationId)
            : null) ||
        null
    const selectedClientVisibleUnifiedWorkItem = workTransactionView === 'stopped'
        ? selectedClientStoppedUnifiedWorkItem
        : selectedClientUnifiedWorkItem && !isUnifiedWorkStopped(selectedClientUnifiedWorkItem)
            ? selectedClientUnifiedWorkItem
            : null
    const selectedExpertVisibleUnifiedWorkItem = workTransactionView === 'stopped'
        ? selectedExpertStoppedUnifiedWorkItem
        : selectedExpertUnifiedWorkItem && !isUnifiedWorkStopped(selectedExpertUnifiedWorkItem)
            ? selectedExpertUnifiedWorkItem
            : null

    const renderStageActionControl = (stageAction: StageAction, keySuffix: string, compact = false) => {
        const className = stageAction.variant === 'secondary' ? 'btn-text' : 'btn-primary'
        const actionClassName = compact ? `${className} work-detail-action is-compact` : `${className} work-detail-action`

        if (stageAction.to) {
            return (
                <Link
                    key={`${stageAction.label}-${stageAction.to}-${keySuffix}`}
                    className={actionClassName}
                    to={stageAction.to}
                    state={myPageReturnState}
                    onClick={stageAction.onClick}
                >
                    {stageAction.label}
                </Link>
            )
        }

        return (
            <button
                key={`${stageAction.label}-${keySuffix}`}
                type="button"
                className={actionClassName}
                onClick={stageAction.onClick}
            >
                {stageAction.label}
            </button>
        )
    }

    const renderWorkDetailFlow = ({
        testId,
        title,
        meta,
        stages,
        infoItems,
        activityItems = [],
        hero,
    }: {
        testId: string
        title: string
        meta: string
        stages: WorkStageView[]
        infoItems: WorkInfoItem[]
        activityItems?: WorkActivityItem[]
        hero?: WorkDetailHero
    }) => {
        const currentStage = stages.find((stage) => stage.state === 'current') || stages.find((stage) => stage.state === 'pending') || stages[0]
        const currentStageIndex = currentStage ? stages.indexOf(currentStage) : -1
        const currentVisual = currentStage ? stageVisualConfig[currentStage.state] : null
        const visibleActivityItems = activityItems.length > 0
            ? activityItems
            : stages.slice(0, 4).map((stage) => ({
                title: `${stage.phase} 업데이트`,
                description: stage.description,
                timeLabel: stageVisualConfig[stage.state].label,
                state: stage.state,
            }))
        const relatedActions = stages.flatMap((stage) =>
            stage === currentStage ? [] : stage.actions.map((action) => ({ stage, action })),
        )

        return (
            <div className="work-detail-panel" data-testid={testId}>
                {hero ? (
                    <header className="work-detail-hero">
                        <button type="button" className="work-detail-back-button" onClick={hero.onBack}>
                            <span aria-hidden="true">←</span>
                            거래 목록으로
                        </button>
                        <div className="work-detail-hero-main">
                            <div className="work-detail-product-media" data-testid="work-detail-product-media">
                                {hero.imageUrl ? (
                                    <img src={hero.imageUrl} alt={hero.imageAlt} />
                                ) : (
                                    <span aria-hidden="true">{title.slice(0, 1)}</span>
                                )}
                            </div>
                            <div className="work-detail-hero-copy">
                                <span className="work-detail-type-label">{hero.typeLabel}</span>
                                <h3 className="work-detail-title">{title}</h3>
                                <dl className="work-detail-meta-list">
                                    <div>
                                        <dt>거래 번호</dt>
                                        <dd>{hero.transactionNumber}</dd>
                                    </div>
                                    <div>
                                        <dt>생성일</dt>
                                        <dd>{hero.createdAtLabel}</dd>
                                    </div>
                                </dl>
                            </div>
                            <span className={`work-transaction-status is-${hero.statusTone}`}>
                                {hero.statusLabel}
                                <span aria-hidden="true" />
                            </span>
                        </div>
                    </header>
                ) : (
                    <header className="work-detail-header">
                        <div>
                            <h3 className="work-detail-title">{title}</h3>
                            <p className="work-detail-meta">{meta}</p>
                        </div>
                    </header>
                )}

                <section className="work-detail-section" aria-labelledby={`${testId}-progress-title`}>
                    <h4 id={`${testId}-progress-title`} className="work-detail-section-title">진행 단계</h4>
                    <div className="work-progress-stepper" data-testid="work-progress-stepper">
                        {stages.map((stage, index) => {
                            const visual = stageVisualConfig[stage.state]
                            const mutedProps = stage.state === 'pending' ? { 'data-stage-muted': 'true' } : {}

                            return (
                                <div
                                    key={`${stage.phase}-${stage.title}`}
                                    className={`work-progress-step is-${stage.state}`}
                                    aria-label={`${stage.title} 단계 상태: ${visual.label}`}
                                >
                                    <div className="work-progress-marker-row">
                                        <span className="work-progress-marker" aria-hidden="true">
                                            {stage.state === 'done' ? '✓' : index + 1}
                                        </span>
                                        {index < stages.length - 1 && <span className="work-progress-line" aria-hidden="true" />}
                                    </div>
                                    <span className="work-progress-phase" {...mutedProps}>{stage.phase}</span>
                                    <span className="work-progress-status" {...mutedProps}>{visual.label}</span>
                                </div>
                            )
                        })}
                    </div>
                </section>

                {currentStage && currentVisual && (
                    <section
                        className="work-current-stage-card"
                        data-testid="work-current-stage-card"
                        aria-label={`현재 단계 카드: ${currentStage.title} 상태 ${currentVisual.label}`}
                    >
                        <span className="work-current-stage-icon" aria-hidden="true">
                            {currentStageIndex + 1}
                        </span>
                        <div className="work-current-stage-body">
                            <h4>{currentStage.phase}</h4>
                            <p>{currentStage.description}</p>
                            {currentStage.actions.length > 0 && (
                                <div
                                    className="work-current-stage-actions"
                                    aria-label={`${currentStage.title} 단계 상태: ${currentVisual.label} 작업 버튼`}
                                >
                                    {currentStage.actions.map((action, index) =>
                                        renderStageActionControl(action, `${currentStage.title}-${index}`),
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                <div className="work-detail-insight-grid">
                    <section className="work-activity-timeline" data-testid="work-activity-timeline">
                        <h4 className="work-detail-section-title">최근 활동</h4>
                        <ol>
                            {visibleActivityItems.map((activity) => {
                                return (
                                    <li key={`${activity.title}-${activity.description}`} className={`work-timeline-item is-${activity.state}`}>
                                        <span className="work-timeline-dot" aria-hidden="true" />
                                        <div>
                                            <div className="work-timeline-head">
                                                <strong>{activity.title}</strong>
                                                <span>{activity.timeLabel}</span>
                                            </div>
                                            <p>{activity.description}</p>
                                        </div>
                                    </li>
                                )
                            })}
                        </ol>
                    </section>

                    <aside className="work-transaction-info" data-testid="work-transaction-info">
                        <h4 className="work-detail-section-title">거래 정보</h4>
                        <dl>
                            {infoItems.map((item) => (
                                <div key={item.label}>
                                    <dt>{item.label}</dt>
                                    <dd>{item.value}</dd>
                                </div>
                            ))}
                        </dl>
                        {relatedActions.length > 0 && (
                            <div className="work-detail-related-actions" aria-label="관련 작업">
                                {relatedActions.map(({ stage, action }, index) =>
                                    renderStageActionControl(action, `${stage.title}-${index}`, true),
                                )}
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        )
    }

    const renderClientOrderStage = (
        phase: string,
        title: string,
        description: string,
        state: StageVisualState,
        action?: StageAction | StageAction[],
    ) => {
        const visual = stageVisualConfig[state]
        const mutedProps = state === 'pending' ? { 'data-stage-muted': 'true' } : {}
        const actions = Array.isArray(action) ? action : action ? [action] : []
        return (
            <div
                aria-label={`${title} 단계 상태: ${visual.label}`}
                style={{
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    background: visual.background,
                    border: '1px solid var(--border-color)',
                    borderLeft: `0.35rem solid ${visual.border}`,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span
                        {...mutedProps}
                        style={{ display: 'block', color: state === 'pending' ? visual.textColor : visual.border, fontSize: '0.82rem', fontWeight: 800 }}
                    >
                        {phase}
                    </span>
                    <span
                        style={{
                            flexShrink: 0,
                            padding: '0.25rem 0.55rem',
                            borderRadius: '999px',
                            background: visual.badgeBackground,
                            color: visual.badgeColor,
                            fontSize: '0.78rem',
                            fontWeight: 800,
                        }}
                    >
                        {visual.label}
                    </span>
                </div>
                <strong {...mutedProps} style={{ display: 'block', color: visual.textColor, marginBottom: '0.4rem' }}>{title}</strong>
            <p {...mutedProps} style={{ color: visual.bodyColor, margin: actions.length ? '0 0 0.75rem' : 0 }}>{description}</p>
            {actions.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {actions.map((stageAction) => {
                        const className = stageAction.variant === 'secondary' ? 'btn-text' : 'btn-primary'
                        const actionStyle = { padding: '0.72rem 0.95rem', textDecoration: 'none' }

                        if (stageAction.to) {
                            return (
                                <Link
                                    key={`${stageAction.label}-${stageAction.to}`}
                                    className={className}
                                    to={stageAction.to}
                                    state={myPageReturnState}
                                    onClick={stageAction.onClick}
                                    style={actionStyle}
                                >
                                    {stageAction.label}
                                </Link>
                            )
                        }

                        return (
                            <button
                                key={stageAction.label}
                                type="button"
                                className={className}
                                onClick={stageAction.onClick}
                                style={actionStyle}
                            >
                                {stageAction.label}
                            </button>
                        )
                    })}
                </div>
            )}
            </div>
        )
    }

    const renderOrderList = (
        items: ServiceRequestData[],
        selectedId: string | number | null | undefined,
        onSelect: (id: string | number) => void,
        emptyText: string,
    ) => (
        <section>
            {items.length > 0 ? (
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {items.map((request) => {
                        const product = products.find((item) => item.id === request.productId)
                        const selected = selectedId === request.id
                        return (
                            <button
                                key={request.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => onSelect(request.id)}
                                style={{
                                    textAlign: 'left',
                                    padding: '1rem',
                                    borderRadius: '0.75rem',
                                    border: selected ? '1px solid #2563eb' : '1px solid var(--border-color)',
                                    background: selected ? '#eff6ff' : '#f8fafc',
                                    cursor: 'pointer',
                                }}
                            >
                                <strong style={{ display: 'block', color: '#0f172a', marginBottom: '0.4rem' }}>
                                    {product?.title || request.desiredResult || request.title}
                                </strong>
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
                                    {request.desiredResult || request.title}
                                </span>
                            </button>
                        )
                    })}
                </div>
            ) : (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{emptyText}</p>
            )}
        </section>
    )

    const renderConsultationOrderList = (
        items: Consultation[],
        selectedId: string | null | undefined,
        onSelect: (id: string) => void,
        emptyText: string,
    ) => (
        <section>
            {items.length > 0 ? (
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {items.map((consultation) => {
                        const product = products.find((item) => item.id === consultation.productId)
                        const selected = selectedId === consultation.id
                        return (
                            <button
                                key={consultation.id}
                                type="button"
                                aria-label="전문가 문의 상담 선택"
                                aria-pressed={selected}
                                onClick={() => onSelect(consultation.id)}
                                style={{
                                    textAlign: 'left',
                                    padding: '1rem',
                                    borderRadius: '0.75rem',
                                    border: selected ? '1px solid #2563eb' : '1px solid var(--border-color)',
                                    background: selected ? '#eff6ff' : '#f8fafc',
                                    cursor: 'pointer',
                                }}
                            >
                                <strong style={{ display: 'block', color: '#0f172a', marginBottom: '0.4rem' }}>
                                    {product?.title || consultation.title}
                                </strong>
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
                                    {consultation.title}
                                </span>
                            </button>
                        )
                    })}
                </div>
            ) : (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{emptyText}</p>
            )}
        </section>
    )

    const renderUnifiedWorkList = (
        items: UnifiedWorkItem[],
        selectedItem: UnifiedWorkItem | null,
        testId: string,
        emptyText: string,
        onSelect: (item: UnifiedWorkItem) => void,
    ) => (
        <section className="work-list-panel" data-testid={testId}>
            {items.length > 0 ? (
                <div className="work-transaction-table-wrap">
                    <table className="work-transaction-table">
                        <thead>
                            <tr>
                                <th scope="col">거래 정보</th>
                                <th scope="col">거래 유형</th>
                                <th scope="col">거래일</th>
                                <th scope="col">현재 단계</th>
                                <th scope="col" aria-label="상세 열기" />
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => {
                                const product = getUnifiedWorkProduct(item)
                                const selected = selectedItem?.kind === item.kind && selectedItem.id === item.id
                                const title = getUnifiedWorkTitle(item)
                                const detailLabel = `${title} 상세 보기`
                                const typeLabel = getUnifiedWorkTypeLabel(item)
                                const statusLabel = getUnifiedWorkStatusLabel(item)
                                const statusTone = getUnifiedWorkStatusTone(item)
                                const dateLabel = formatTransactionDate(getUnifiedWorkCreatedAt(item))

                                return (
                                    <tr
                                        key={`${item.kind}-${item.id}`}
                                        className={selected ? 'is-selected' : undefined}
                                        data-testid="work-transaction-row"
                                        data-work-item-kind={item.kind}
                                        data-work-item-id={String(item.id)}
                                        tabIndex={0}
                                        aria-label={detailLabel}
                                        onClick={() => onSelect(item)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault()
                                                onSelect(item)
                                            }
                                        }}
                                    >
                                        <td>
                                            <div className="work-transaction-summary">
                                                <div className="work-transaction-thumb">
                                                    {product?.sampleImageUrl ? (
                                                        <img src={product.sampleImageUrl} alt={`${title} 대표 이미지`} />
                                                    ) : (
                                                        <span aria-hidden="true">{title.slice(0, 1)}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <strong>{title}</strong>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{typeLabel}</td>
                                        <td>{dateLabel}</td>
                                        <td>
                                            <span className={`work-transaction-status is-${statusTone}`}>
                                                {statusLabel}
                                                <span aria-hidden="true" />
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="work-transaction-open-button"
                                                data-testid="work-dashboard-item"
                                                data-work-item-kind={item.kind}
                                                data-work-item-id={String(item.id)}
                                                aria-label={detailLabel}
                                                aria-pressed={selected}
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    onSelect(item)
                                                }}
                                            >
                                                <span aria-hidden="true">›</span>
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{emptyText}</p>
            )}
        </section>
    )

    const renderStoppedTransactionFlow = (item: UnifiedWorkItem, role: 'client' | 'expert') => {
        const title = getUnifiedWorkTitle(item)
        const stoppedAt = item.kind === 'product'
            ? getWorkForRequestIncludingStopped(item.request)?.cancelledAt
            : item.consultation.lastMessageAt
        const infoItems: WorkInfoItem[] = [
            { label: '거래 방식', value: getUnifiedWorkTypeLabel(item) },
            { label: '등록일', value: formatTransactionDateTime(getUnifiedWorkCreatedAt(item)) },
            { label: '현재 상태', value: '중단' },
            ...(stoppedAt ? [{ label: '중단일', value: formatTransactionDateTime(stoppedAt) }] : []),
        ]

        return renderWorkDetailFlow({
            testId: `${role}-stopped-transaction-flow`,
            title,
            meta: `${getUnifiedWorkTypeLabel(item)} · 중단`,
            hero: buildWorkDetailHero(item, clearSelectedTransaction),
            stages: [
                createWorkStage('상담', '상담', '거래 조건 확인 단계가 처리되었습니다.', 'done'),
                createWorkStage('결제', '결제', '결제 또는 제안 단계가 처리되었습니다.', 'done'),
                createWorkStage('작업', '작업', '작업 진행 중 거래가 중단되었습니다.', 'done'),
                createWorkStage('중단', '중단', '이 거래는 중단된 상태입니다.', 'current'),
            ],
            infoItems,
        })
    }

    const renderConsultationFlow = (consultation: Consultation | null, role: 'client' | 'expert') => {
        if (!consultation) return null
        const product = products.find((item) => item.id === consultation.productId)
        const consultationUrl = `${ROUTES.WORK_DASHBOARD}?panel=consultations&consultation=${consultation.id}`
        const statusLabel = getConsultationStatusLabel(consultation)
        const consultationProposal = proposals.find((proposal) => proposal.requestId === `consultation-${consultation.id}`)
        const consultationPaymentCompleted = consultationProposal?.paymentStatus === 'paid'
        const stages = [
            createWorkStage(
                '상담',
                '상담 채팅',
                '전문가 문의로 시작한 거래입니다. 채팅에서 범위와 조건을 먼저 협의합니다.',
                consultation.status === 'open' ? 'current' : 'done',
                [
                    {
                        label: '상담 채팅 보기',
                        to: consultationUrl,
                        onClick: () => {
                            setActivePanel('consultations')
                            setSelectedConsultationId(consultation.id)
                            setSelectedClientOrderId(null)
                            setSelectedExpertRequestId(null)
                        },
                    },
                    ...(role === 'client' && consultation.productId
                        ? [{ label: '의뢰서 작성', to: `/request/${consultation.productId}`, variant: 'secondary' as const }]
                        : []),
                ],
            ),
            createWorkStage(
                '결제',
                role === 'expert' && consultation.status === 'open' ? '상담 후 제안서 작성' : '제안서 승인 및 결제',
                role === 'expert' && consultation.status === 'open'
                    ? '상담 내용을 바탕으로 제안서를 작성해 의뢰자에게 보냅니다.'
                    : '제안서를 승인하고 결제하면 프로젝트가 생성됩니다.',
                consultation.status === 'proposal_sent' ? 'current' : 'pending',
            ),
            createWorkStage('작업', '프로젝트 대기', '결제가 끝나면 프로젝트에서 제작을 진행합니다.', 'pending'),
            createWorkStage('완료', '상담 완료/리뷰', '작업이 완료되면 결과 확인과 리뷰 작성이 가능합니다.', 'pending'),
        ]

        return renderWorkDetailFlow({
            testId: `${role}-consultation-order-flow`,
            title: `전문가 문의 - ${product?.title || consultation.title}`,
            meta: `전문가 문의 · ${consultation.status === 'open' ? '진행 상태 확인' : statusLabel}`,
            stages,
            hero: buildWorkDetailHero(
                { kind: 'consultation', id: consultation.id, createdTime: getConsultationCreatedTime(consultation), consultation },
                clearSelectedTransaction,
            ),
            infoItems: getConsultationInfoItems(consultation, consultationProposal, consultationPaymentCompleted),
            activityItems: getConsultationActivityItems(consultation, consultationProposal),
        })
    }

    const _renderClientProductOrderManager = () => (
        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
            {clientConsultationsByCreatedAt.length > 0 && (
                <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.75rem' }}>전문가 문의</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.9fr) minmax(0, 1.4fr)', gap: '1rem', alignItems: 'start' }}>
                        <div aria-label="의뢰자 전문가 문의 목록" style={{ display: 'grid', gap: '1rem' }}>
                            {renderConsultationOrderList(clientConsultationsByCreatedAt, selectedClientConsultation?.id, setSelectedConsultationId, '전문가 문의 내역이 없습니다.')}
                        </div>
                        {renderConsultationFlow(selectedClientConsultation, 'client')}
                    </div>
                </div>
            )}

            {clientProductRequests.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.9fr) minmax(0, 1.4fr)', gap: '1rem', alignItems: 'start' }}>
                    <div aria-label="의뢰자 상품 주문 목록" style={{ display: 'grid', gap: '1rem' }}>
                        {renderOrderList(clientProductRequestsByCreatedAt, selectedClientOrder?.id, setSelectedClientOrderId, '상품 주문 이력이 없습니다.')}
                    </div>

                    {selectedClientOrder && (
                        <div style={{ padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', background: 'white' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.4rem' }}>
                                {selectedClientOrderProduct?.title || selectedClientOrder.title}
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem' }}>
                                {selectedClientOrder.budget ? `${Number(selectedClientOrder.budget).toLocaleString()}원 · ` : ''}
                                마감 {selectedClientOrder.deadline || '미정'}
                            </p>
                            <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.75rem' }}>전체 과정</h4>
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                {renderClientOrderStage(
                                    '작업 전',
                                    '의뢰서 작성',
                                    selectedClientOrder.desiredResult || selectedClientOrder.description || '요구사항이 접수되었습니다.',
                                    'done',
                                        selectedClientOrder.productId
                                            ? [
                                            { label: '의뢰서 보기/수정', to: `/request/${selectedClientOrder.productId}?requestId=${selectedClientOrder.id}` },
                                            { label: '상품 보기', to: `/expert/${selectedClientOrder.productId}`, variant: 'secondary' },
                                        ]
                                        : undefined,
                                )}
                                {selectedClientOrderProposal
                                    ? renderClientOrderStage(
                                        '결제',
                                        '제안서 승인 및 결제',
                                        selectedClientOrderWork
                                            ? '결제 완료 후 프로젝트가 생성되었습니다.'
                                            : selectedClientOrderProposal.paymentStatus === 'paid'
                                                ? '결제 완료 처리가 반영되었습니다. 프로젝트 생성을 기다립니다.'
                                                : `${selectedClientOrderProposal.totalPrice.toLocaleString()}원 · ${selectedClientOrderProposal.deliveryDays}일 · ${proposalStatusText[selectedClientOrderProposal.status]} · 제안서 화면에서 승인 및 결제를 진행합니다.`,
                                        selectedClientOrderWork || selectedClientOrderProposal.paymentStatus === 'paid' ? 'done' : 'current',
                                        {
                                            label: selectedClientOrderWork || selectedClientOrderProposal.paymentStatus === 'paid'
                                                ? '제안서 보기'
                                                : '제안서 승인하고 결제하기',
                                            to: `/proposal/${selectedClientOrderProposal.id}`,
                                        },
                                    )
                                    : renderClientOrderStage('결제', '제안서 승인 및 결제', '전문가가 제안서를 보내면 이 단계에서 승인과 결제를 진행합니다.', 'current')}
                                {selectedClientOrderWork
                                    ? renderClientOrderStage(
                                        '작업 중',
                                        getClientWorkStageTitle(selectedClientOrderWork),
                                        getClientWorkStageDescription(selectedClientOrderWork),
                                        selectedClientOrderWork.status === 'completed' ? 'done' : 'current',
                                        selectedClientOrderWork.status === 'completed'
                                            ? { label: getClientWorkStageActionLabel(selectedClientOrderWork), to: `/workroom/${selectedClientOrderWork.id}` }
                                            : [
                                                { label: getClientWorkStageActionLabel(selectedClientOrderWork), to: `/workroom/${selectedClientOrderWork.id}` },
                                                { label: '프로젝트에서 거래 관리', to: `/workroom/${selectedClientOrderWork.id}`, variant: 'secondary' },
                                            ],
                                    )
                                    : renderClientOrderStage('작업 중', '프로젝트 대기', '제안서를 승인하면 프로젝트가 생성됩니다.', 'pending')}
                                {renderClientOrderStage(
                                    '작업 후',
                                    '완료 확인/리뷰',
                                    selectedClientOrderWork?.status === 'completed' ? '결과물을 확인하고 리뷰를 남길 수 있습니다.' : '작업이 완료되면 결과 확인과 리뷰 작성이 가능합니다.',
                                    selectedClientOrderWork?.status === 'completed' ? 'current' : 'pending',
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>아직 상품 주문 내역이 없습니다.</p>
            )}
        </div>
    )

    const _renderExpertReceivedWorkManager = () => (
        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
            {expertConsultationsByCreatedAt.length > 0 && (
                <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.75rem' }}>전문가 문의</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.9fr) minmax(0, 1.4fr)', gap: '1rem', alignItems: 'start' }}>
                        <div aria-label="전문가 받은 문의 목록" style={{ display: 'grid', gap: '1rem' }}>
                            {renderConsultationOrderList(expertConsultationsByCreatedAt, selectedExpertConsultation?.id, setSelectedConsultationId, '받은 전문가 문의가 없습니다.')}
                        </div>
                        {renderConsultationFlow(selectedExpertConsultation, 'expert')}
                    </div>
                </div>
            )}

            {receivedProductRequests.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.9fr) minmax(0, 1.4fr)', gap: '1rem', alignItems: 'start' }}>
                    <div aria-label="전문가 받은 상품 의뢰 목록" style={{ display: 'grid', gap: '1rem' }}>
                        {renderOrderList(receivedProductRequestsByCreatedAt, selectedExpertRequest?.id, setSelectedExpertRequestId, '받은 상품 의뢰가 없습니다.')}
                    </div>

                    {selectedExpertRequest && (
                        <div style={{ padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', background: 'white' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.4rem' }}>
                                {selectedExpertRequest.desiredResult || selectedExpertRequestProduct?.title || selectedExpertRequest.title}
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem' }}>
                                {selectedExpertRequestProduct?.title || '상품 의뢰'} · {selectedExpertRequest.budget ? `${Number(selectedExpertRequest.budget).toLocaleString()}원 · ` : ''}
                                마감 {selectedExpertRequest.deadline || '미정'}
                            </p>
                            <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.75rem' }}>전체 과정</h4>
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                {renderClientOrderStage(
                                    '작업 전',
                                    '받은 의뢰',
                                    selectedExpertRequest.description || selectedExpertRequest.desiredResult || '상품 의뢰가 접수되었습니다.',
                                    'done',
                                        selectedExpertRequest.productId
                                            ? [
                                            { label: '받은 의뢰서 보기', to: `/request/${selectedExpertRequest.productId}?requestId=${selectedExpertRequest.id}` },
                                            { label: '상품 보기', to: `/expert/${selectedExpertRequest.productId}`, variant: 'secondary' },
                                        ]
                                        : undefined,
                                )}
                                {selectedExpertRequestProposal
                                    ? renderClientOrderStage(
                                        '검토 단계',
                                        '제안서 작성/수정',
                                        `${selectedExpertRequestProposal.totalPrice.toLocaleString()}원 · ${selectedExpertRequestProposal.deliveryDays}일 · ${proposalStatusText[selectedExpertRequestProposal.status]}`,
                                        selectedExpertRequestWork ? 'done' : 'current',
                                        selectedExpertRequestWork || selectedExpertRequestProposal.paymentStatus === 'paid' || selectedExpertRequestProposal.status !== 'sent'
                                            ? { label: '보낸 제안서 보기', to: `/proposal/${selectedExpertRequestProposal.id}` }
                                            : [
                                                { label: '수정하기', to: `${ROUTES.PROPOSAL_NEW}?proposalId=${selectedExpertRequestProposal.id}` },
                                                { label: '보낸 제안서 보기', to: `/proposal/${selectedExpertRequestProposal.id}`, variant: 'secondary' },
                                            ],
                                    )
                                    : renderClientOrderStage(
                                        '검토 단계',
                                        '제안서 작성/수정',
                                        '의뢰 내용을 확인하고 제안서를 보낼 수 있습니다.',
                                        selectedExpertRequestWork ? 'pending' : 'current',
                                        selectedExpertRequestWork
                                            ? undefined
                                            : { label: '제안서 보내기', to: `${ROUTES.PROPOSAL_NEW}?requestId=${selectedExpertRequest.id}` },
                                    )}
                                {selectedExpertRequestProposal
                                    ? renderClientOrderStage(
                                        '결제',
                                        selectedExpertRequestWork || selectedExpertRequestProposal.paymentStatus === 'paid' ? '테스트 결제 완료' : '제안서 승인 및 결제 대기',
                                        selectedExpertRequestWork
                                            ? '의뢰자가 결제 완료 처리 후 프로젝트가 생성되었습니다.'
                                            : selectedExpertRequestProposal.paymentStatus === 'paid'
                                                ? '의뢰자의 결제 완료 처리가 반영되었습니다. 프로젝트 생성을 기다립니다.'
                                                : '의뢰자가 제안서를 승인하고 결제를 완료하면 프로젝트가 생성됩니다.',
                                        selectedExpertRequestWork || selectedExpertRequestProposal.paymentStatus === 'paid' ? 'done' : 'pending',
                                    )
                                    : renderClientOrderStage('결제', '제안서 승인 및 결제 대기', '제안서를 보낸 뒤 의뢰자의 승인과 결제를 기다립니다.', 'pending')}
                                {selectedExpertRequestWork
                                    ? renderClientOrderStage(
                                        '작업 중',
                                        getExpertWorkStageTitle(selectedExpertRequestWork),
                                        getExpertWorkStageDescription(selectedExpertRequestWork),
                                        selectedExpertRequestWork.status === 'completed' ? 'done' : 'current',
                                        selectedExpertRequestWork.status === 'completed'
                                            ? { label: getExpertWorkStageActionLabel(selectedExpertRequestWork), to: `/workroom/${selectedExpertRequestWork.id}` }
                                            : [
                                                { label: getExpertWorkStageActionLabel(selectedExpertRequestWork), to: `/workroom/${selectedExpertRequestWork.id}` },
                                                { label: '프로젝트에서 거래 관리', to: `/workroom/${selectedExpertRequestWork.id}`, variant: 'secondary' },
                                            ],
                                    )
                                    : renderClientOrderStage('작업 중', '작업 진행', '제안서가 승인되면 프로젝트에서 진행합니다.', 'pending')}
                                {renderClientOrderStage(
                                    '작업 완료',
                                    '작업 완료',
                                    selectedExpertRequestWork?.status === 'completed' ? '의뢰자에게 결과물을 전달한 작업입니다.' : '결과물을 제출하고 의뢰자 확인을 기다립니다.',
                                    selectedExpertRequestWork?.status === 'completed' ? 'done' : 'pending',
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>아직 받은 상품 의뢰가 없습니다.</p>
            )}
        </div>
    )

    const renderClientSelectedProductFlow = () => {
        if (!selectedClientOrder) return null
        const clientOrderPaymentCompleted = Boolean(
            selectedClientOrderWork || selectedClientOrderProposal?.paymentStatus === 'paid',
        )

        const stages = [
            createWorkStage(
                '상담',
                '요구사항 확인',
                selectedClientOrder.desiredResult || selectedClientOrder.description || '요구사항이 접수되었습니다.',
                'done',
                selectedClientOrder.productId
                    ? [
                        { label: '의뢰서 보기/수정', to: `/request/${selectedClientOrder.productId}?requestId=${selectedClientOrder.id}` },
                        { label: '상품 보기', to: `/expert/${selectedClientOrder.productId}`, variant: 'secondary' },
                    ]
                    : undefined,
            ),
            selectedClientOrderProposal
                ? createWorkStage(
                    '결제',
                    '제안서 승인 및 결제',
                    selectedClientOrderWork
                        ? '결제 완료 후 프로젝트가 생성되었습니다.'
                        : selectedClientOrderProposal.paymentStatus === 'paid'
                            ? '결제 완료 처리가 반영되었습니다. 프로젝트 생성을 기다립니다.'
                            : `${selectedClientOrderProposal.totalPrice.toLocaleString()}원 · ${selectedClientOrderProposal.deliveryDays}일 · ${proposalStatusText[selectedClientOrderProposal.status]} · 제안서 화면에서 승인 및 결제를 진행합니다.`,
                    selectedClientOrderWork || selectedClientOrderProposal.paymentStatus === 'paid' ? 'done' : 'current',
                    {
                        label: selectedClientOrderWork || selectedClientOrderProposal.paymentStatus === 'paid'
                            ? '제안서 보기'
                            : '제안서 승인하고 결제하기',
                        to: `/proposal/${selectedClientOrderProposal.id}`,
                    },
                )
                : createWorkStage(
                    '결제',
                    '제안서 승인 및 결제',
                    selectedClientOrderWork ? '프로젝트가 생성된 거래입니다.' : '전문가가 제안서를 보내면 이 단계에서 승인과 결제를 진행합니다.',
                    selectedClientOrderWork ? 'done' : 'current',
                ),
            selectedClientOrderWork
                ? createWorkStage(
                    '작업',
                    getClientWorkStageTitle(selectedClientOrderWork),
                    getClientWorkStageDescription(selectedClientOrderWork),
                    selectedClientOrderWork.status === 'completed' ? 'done' : 'current',
                    selectedClientOrderWork.status === 'completed'
                        ? { label: getClientWorkStageActionLabel(selectedClientOrderWork), to: `/workroom/${selectedClientOrderWork.id}` }
                        : [
                            { label: getClientWorkStageActionLabel(selectedClientOrderWork), to: `/workroom/${selectedClientOrderWork.id}` },
                            { label: '프로젝트에서 거래 관리', to: `/workroom/${selectedClientOrderWork.id}`, variant: 'secondary' },
                        ],
                )
                : createWorkStage('작업', '프로젝트 대기', '제안서를 승인하면 프로젝트가 생성됩니다.', 'pending'),
            createWorkStage(
                '완료',
                '완료 확인/리뷰',
                selectedClientOrderWork?.status === 'completed' ? '결과물을 확인하고 리뷰를 남길 수 있습니다.' : '작업이 완료되면 결과 확인과 리뷰 작성이 가능합니다.',
                selectedClientOrderWork?.status === 'completed' ? 'current' : 'pending',
            ),
        ]

        return renderWorkDetailFlow({
            testId: 'client-product-order-flow',
            title: selectedClientOrderProduct?.title || selectedClientOrder.title,
            meta: `${selectedClientOrder.budget ? `${Number(selectedClientOrder.budget).toLocaleString()}원 · ` : ''}마감 ${selectedClientOrder.deadline || '미정'}`,
            stages,
            hero: selectedClientUnifiedWorkItem?.kind === 'product'
                ? buildWorkDetailHero(selectedClientUnifiedWorkItem, clearSelectedTransaction)
                : undefined,
            infoItems: getProductInfoItems(selectedClientOrder, clientOrderPaymentCompleted),
            activityItems: getProductActivityItems(selectedClientOrder, selectedClientOrderProposal, selectedClientOrderWork, 'client'),
        })
    }

    const renderExpertSelectedProductFlow = () => {
        if (!selectedExpertRequest) return null
        const expertOrderPaymentCompleted = Boolean(
            selectedExpertRequestWork || selectedExpertRequestProposal?.paymentStatus === 'paid',
        )

        const stages = [
            createWorkStage(
                '상담',
                '받은 의뢰',
                selectedExpertRequest.description || selectedExpertRequest.desiredResult || '상품 의뢰가 접수되었습니다.',
                'done',
                selectedExpertRequest.productId
                    ? [
                        { label: '받은 의뢰서 보기', to: `/request/${selectedExpertRequest.productId}?requestId=${selectedExpertRequest.id}` },
                        { label: '상품 보기', to: `/expert/${selectedExpertRequest.productId}`, variant: 'secondary' },
                    ]
                    : undefined,
            ),
            selectedExpertRequestProposal
                ? createWorkStage(
                    '결제',
                    selectedExpertRequestWork || selectedExpertRequestProposal.paymentStatus === 'paid'
                        ? '결제 완료'
                        : '제안서 승인 및 결제 대기',
                    `${selectedExpertRequestProposal.totalPrice.toLocaleString()}원 · ${selectedExpertRequestProposal.deliveryDays}일 · ${proposalStatusText[selectedExpertRequestProposal.status]}`,
                    selectedExpertRequestWork || selectedExpertRequestProposal.paymentStatus === 'paid' ? 'done' : 'current',
                    selectedExpertRequestWork || selectedExpertRequestProposal.paymentStatus === 'paid' || selectedExpertRequestProposal.status !== 'sent'
                        ? { label: '보낸 제안서 보기', to: `/proposal/${selectedExpertRequestProposal.id}` }
                        : [
                            { label: '수정하기', to: `${ROUTES.PROPOSAL_NEW}?proposalId=${selectedExpertRequestProposal.id}` },
                            { label: '보낸 제안서 보기', to: `/proposal/${selectedExpertRequestProposal.id}`, variant: 'secondary' },
                        ],
                )
                : createWorkStage(
                    '결제',
                    '제안서 작성/수정',
                    '의뢰 내용을 확인하고 제안서를 보낼 수 있습니다.',
                    selectedExpertRequestWork ? 'pending' : 'current',
                    selectedExpertRequestWork
                        ? undefined
                        : { label: '제안서 보내기', to: `${ROUTES.PROPOSAL_NEW}?requestId=${selectedExpertRequest.id}` },
                ),
            selectedExpertRequestWork
                ? createWorkStage(
                    '작업',
                    getExpertWorkStageTitle(selectedExpertRequestWork),
                    getExpertWorkStageDescription(selectedExpertRequestWork),
                    selectedExpertRequestWork.status === 'completed' ? 'done' : 'current',
                    selectedExpertRequestWork.status === 'completed'
                        ? { label: getExpertWorkStageActionLabel(selectedExpertRequestWork), to: `/workroom/${selectedExpertRequestWork.id}` }
                        : [
                            { label: getExpertWorkStageActionLabel(selectedExpertRequestWork), to: `/workroom/${selectedExpertRequestWork.id}` },
                            { label: '프로젝트에서 거래 관리', to: `/workroom/${selectedExpertRequestWork.id}`, variant: 'secondary' },
                        ],
                )
                : createWorkStage('작업', '작업 진행', '제안서가 승인되면 프로젝트에서 진행합니다.', 'pending'),
            createWorkStage(
                '완료',
                '작업 완료',
                selectedExpertRequestWork?.status === 'completed' ? '의뢰자에게 결과물을 전달한 완료 작업입니다.' : '결과물을 제출하고 의뢰자 확인을 기다립니다.',
                selectedExpertRequestWork?.status === 'completed' ? 'done' : 'pending',
            ),
        ]

        return renderWorkDetailFlow({
            testId: 'expert-product-order-flow',
            title: selectedExpertRequest.desiredResult || selectedExpertRequestProduct?.title || selectedExpertRequest.title,
            meta: `${selectedExpertRequestProduct?.title || '상품 의뢰'} · ${selectedExpertRequest.budget ? `${Number(selectedExpertRequest.budget).toLocaleString()}원 · ` : ''}마감 ${selectedExpertRequest.deadline || '미정'}`,
            stages,
            hero: selectedExpertUnifiedWorkItem?.kind === 'product'
                ? buildWorkDetailHero(selectedExpertUnifiedWorkItem, clearSelectedTransaction)
                : undefined,
            infoItems: getProductInfoItems(selectedExpertRequest, expertOrderPaymentCompleted),
            activityItems: getProductActivityItems(selectedExpertRequest, selectedExpertRequestProposal, selectedExpertRequestWork, 'expert'),
        })
    }

    const renderTransactionListFooter = () => (
        <div className="work-transaction-list-footer" aria-label="거래 목록 페이지네이션">
            <div className="work-transaction-pages">
                <button type="button" aria-label="이전 페이지">‹</button>
                {[1, 2, 3, 4, 5].map((page) => (
                    <button key={page} type="button" aria-current={page === 1 ? 'page' : undefined}>
                        {page}
                    </button>
                ))}
                <button type="button" aria-label="다음 페이지">›</button>
            </div>
            <label className="work-transaction-page-size">
                <span className="sr-only">페이지당 거래 수</span>
                <select defaultValue="10">
                    <option value="10">10개씩 보기</option>
                    <option value="20">20개씩 보기</option>
                </select>
            </label>
        </div>
    )

    const renderTransactionListShell = (
        activeItems: UnifiedWorkItem[],
        stoppedItems: UnifiedWorkItem[],
        selectedItem: UnifiedWorkItem | null,
        testId: string,
        emptyText: string,
        onSelect: (item: UnifiedWorkItem) => void,
    ) => {
        const visibleItems = workTransactionView === 'active' ? activeItems : stoppedItems
        const visibleEmptyText = workTransactionView === 'active' ? emptyText : '중단된 거래가 없습니다.'

        return (
            <>
                <header className="work-transaction-page-head">
                    <h2>거래관리</h2>
                    <p>진행 중이거나 완료된 거래를 한눈에 확인하고 관리할 수 있습니다.</p>
                </header>
                {renderWorkTransactionTabs()}
                {renderUnifiedWorkList(visibleItems, selectedItem, testId, visibleEmptyText, onSelect)}
                {visibleItems.length > 0 && renderTransactionListFooter()}
            </>
        )
    }

    const renderClientUnifiedWorkManager = () => (
        <div className="work-dashboard-manager" style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
            {mode !== 'work' ? (
                clientUnifiedWorkItems.length > 0 ? (
                    <div className="work-dashboard-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.9fr) minmax(0, 1.4fr)', gap: '1rem', alignItems: 'start' }}>
                        {renderUnifiedWorkList(
                            clientUnifiedWorkItems,
                            selectedClientUnifiedWorkItem,
                            'client-unified-work-list',
                            '작업 내역이 없습니다.',
                            (item) => {
                                if (item.kind === 'product') {
                                    setSelectedClientOrderId(item.id)
                                    setSelectedConsultationId(null)
                                } else {
                                    setSelectedConsultationId(item.id)
                                    setSelectedClientOrderId(null)
                                }
                            },
                        )}
                        {selectedClientUnifiedWorkItem?.kind === 'consultation'
                            ? renderConsultationFlow(selectedClientUnifiedWorkItem.consultation, 'client')
                            : renderClientSelectedProductFlow()}
                    </div>
                ) : (
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>아직 작업 내역이 없습니다.</p>
                )
            ) : selectedClientVisibleUnifiedWorkItem ? (
                workTransactionView === 'stopped'
                    ? renderStoppedTransactionFlow(selectedClientVisibleUnifiedWorkItem, 'client')
                    : selectedClientVisibleUnifiedWorkItem.kind === 'consultation'
                        ? renderConsultationFlow(selectedClientVisibleUnifiedWorkItem.consultation, 'client')
                        : renderClientSelectedProductFlow()
            ) : (
                renderTransactionListShell(
                    clientActiveUnifiedWorkItems,
                    clientStoppedUnifiedWorkItems,
                    selectedClientVisibleUnifiedWorkItem,
                    'client-unified-work-list',
                    '작업 내역이 없습니다.',
                    (item) => {
                        if (item.kind === 'product') {
                            setSelectedClientOrderId(item.id)
                            setSelectedConsultationId(null)
                        } else {
                            setSelectedConsultationId(item.id)
                            setSelectedClientOrderId(null)
                        }
                    },
                )
            )}
        </div>
    )

    const renderExpertUnifiedWorkManager = () => (
        <div className="work-dashboard-manager" style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
            {mode !== 'work' ? (
                expertUnifiedWorkItems.length > 0 ? (
                    <div className="work-dashboard-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.9fr) minmax(0, 1.4fr)', gap: '1rem', alignItems: 'start' }}>
                        {renderUnifiedWorkList(
                            expertUnifiedWorkItems,
                            selectedExpertUnifiedWorkItem,
                            'expert-unified-work-list',
                            '받은 작업 내역이 없습니다.',
                            (item) => {
                                if (item.kind === 'product') {
                                    setSelectedExpertRequestId(item.id)
                                    setSelectedConsultationId(null)
                                } else {
                                    setSelectedConsultationId(item.id)
                                    setSelectedExpertRequestId(null)
                                }
                            },
                        )}
                        {selectedExpertUnifiedWorkItem?.kind === 'consultation'
                            ? renderConsultationFlow(selectedExpertUnifiedWorkItem.consultation, 'expert')
                            : renderExpertSelectedProductFlow()}
                    </div>
                ) : (
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>아직 받은 작업 내역이 없습니다.</p>
                )
            ) : selectedExpertVisibleUnifiedWorkItem ? (
                workTransactionView === 'stopped'
                    ? renderStoppedTransactionFlow(selectedExpertVisibleUnifiedWorkItem, 'expert')
                    : selectedExpertVisibleUnifiedWorkItem.kind === 'consultation'
                        ? renderConsultationFlow(selectedExpertVisibleUnifiedWorkItem.consultation, 'expert')
                        : renderExpertSelectedProductFlow()
            ) : (
                renderTransactionListShell(
                    expertActiveUnifiedWorkItems,
                    expertStoppedUnifiedWorkItems,
                    selectedExpertVisibleUnifiedWorkItem,
                    'expert-unified-work-list',
                    '받은 작업 내역이 없습니다.',
                    (item) => {
                        if (item.kind === 'product') {
                            setSelectedExpertRequestId(item.id)
                            setSelectedConsultationId(null)
                        } else {
                            setSelectedConsultationId(item.id)
                            setSelectedExpertRequestId(null)
                        }
                    },
                )
            )}
        </div>
    )

    const renderFavoriteProductsPanel = () => (
        <section style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.35rem' }}>관심 상품</h2>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        나중에 다시 보고 싶은 AI 작업 상품을 모아봅니다.
                    </p>
                </div>
                <Link to={ROUTES.CATEGORY} className="btn-text" style={{ textDecoration: 'none' }}>
                    AI 작업 찾기
                </Link>
            </div>

            {favoriteProducts.length > 0 ? (
                <div className="product-grid">
                    {favoriteProducts.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            ) : (
                <div style={{ padding: '1.25rem', borderRadius: '0.85rem', background: '#f8fafc', border: '1px solid var(--border-color)' }}>
                    <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                        아직 관심 상품이 없습니다.
                    </p>
                    <Link to={ROUTES.CATEGORY} className="btn-primary" style={{ textDecoration: 'none' }}>
                        상품 둘러보기
                    </Link>
                </div>
            )}
        </section>
    )

    const renderProductManagementPanel = () => (
        <section style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>내 상품관리</h2>
                <Link to={ROUTES.PRODUCT_NEW} className="btn-primary" style={{ padding: '0.85rem 1.1rem', textDecoration: 'none' }}>
                    상품 등록하기
                </Link>
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1rem' }}>내가 올린 상품</h3>
            {myProducts.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    {myProducts.map((product) => (
                        <Link
                            key={product.id}
                            to={`/expert/${product.id}`}
                            state={myPageReturnState}
                            style={{
                                display: 'grid',
                                gap: '0.75rem',
                                padding: '0.85rem',
                                borderRadius: '0.85rem',
                                border: '1px solid var(--border-color)',
                                background: '#f8fafc',
                                color: '#0f172a',
                                textDecoration: 'none',
                            }}
                        >
                            <div style={{ overflow: 'hidden', borderRadius: '0.7rem', background: '#e2e8f0', aspectRatio: '4 / 3' }}>
                                {product.sampleImageUrl ? (
                                    <img
                                        src={product.sampleImageUrl}
                                        alt={`${product.title} 썸네일`}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                    />
                                ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#64748b', fontWeight: 800 }}>
                                        이미지 없음
                                    </div>
                                )}
                            </div>
                            <div>
                                <strong style={{ display: 'block', marginBottom: '0.35rem', lineHeight: 1.35 }}>{product.title}</strong>
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
                                    {currency.format(product.startingPrice)}원부터 · {product.deliveryDays}일
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            ) : (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>아직 등록한 상품이 없습니다.</p>
            )}
        </section>
    )

    const renderConsultationPanel = () => (
        <ConsultationChatPanel
            consultations={roleFilteredConsultations}
            products={products}
            selectedConsultation={selectedPanelConsultation}
            selectedProduct={selectedPanelConsultationProduct}
            messages={consultationMessages}
            currentUserId={user?.id || ''}
            messageBody={consultationMessageBody}
            messageError={consultationMessageError}
            actionMessage={consultationActionMessage}
            actionError={consultationActionError}
            messageSubmitting={consultationMessageSubmitting}
            proposalSubmitting={false}
            transactionUrl={selectedPanelConsultation && proposals.some((proposal) => proposal.requestId === `consultation-${selectedPanelConsultation.id}`)
                ? `${ROUTES.WORK_DASHBOARD}?role=${workRole}&panel=client&consultation=${selectedPanelConsultation.id}`
                : undefined}
            onSelectConsultation={(consultationId) => {
                setActivePanel('consultations')
                setSelectedConsultationId(consultationId)
            }}
            onMessageBodyChange={setConsultationMessageBody}
            onSendMessage={handleSendConsultationMessage}
            onCreateProposal={handleCreateConsultationProposal}
            onEndConsultation={handleEndConsultation}
            onReportConsultation={handleReportConsultation}
        />
    )

    const renderProfileViewPanel = () => {
        const preview = profilePreview
        const avatarText = (preview?.name || name || 'A').slice(0, 1).toUpperCase()
        const sampleCount = preview?.sampleLinks.length || 0
        const toolText = preview?.aiTools.length ? preview.aiTools.join(', ') : '등록된 AI 도구가 없습니다.'

        return (
            <section style={cardStyle} aria-label="마이 프로필 보기">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div>
                        <span style={{ color: '#2563eb', fontWeight: 900, fontSize: '0.9rem' }}>
                            {preview?.roleLabel || (isExpert ? '메이커 프로필' : '의뢰자 프로필')}
                        </span>
                        <h2 style={{ margin: '0.45rem 0 0', color: '#0f172a', fontSize: '1.5rem', fontWeight: 900 }}>
                            내 프로필
                        </h2>
                    </div>
                    <Link to={ROUTES.PROFILE} className="btn-primary">
                        수정하기
                    </Link>
                </div>

                {!profilePreviewLoaded ? (
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>프로필을 불러오는 중입니다.</p>
                ) : (
                    <div style={{ display: 'grid', gap: '1.25rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '1rem', alignItems: 'center' }}>
                            {preview?.imageUrl ? (
                                <img
                                    src={preview.imageUrl}
                                    alt={`${preview.name} 프로필 이미지`}
                                    style={{ width: 76, height: 76, borderRadius: '999px', objectFit: 'cover', background: '#e2e8f0' }}
                                />
                            ) : (
                                <span
                                    aria-hidden="true"
                                    style={{ display: 'grid', placeItems: 'center', width: 76, height: 76, borderRadius: '999px', background: '#dbeafe', color: '#1d4ed8', fontSize: '1.6rem', fontWeight: 900 }}
                                >
                                    {avatarText}
                                </span>
                            )}
                            <div>
                                <strong style={{ display: 'block', color: '#0f172a', fontSize: '1.25rem', marginBottom: '0.35rem' }}>
                                    {preview?.name || name || '이름 미등록'}
                                </strong>
                                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    {preview?.oneLiner || '아직 소개 문구가 등록되지 않았습니다.'}
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
                            <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '0.75rem', background: '#f8fafc' }}>
                                <span style={{ display: 'block', color: '#64748b', fontWeight: 900, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                    사용 AI 도구
                                </span>
                                <p style={{ margin: 0, color: '#0f172a', fontWeight: 800 }}>{toolText}</p>
                            </div>
                            <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '0.75rem', background: '#f8fafc' }}>
                                <span style={{ display: 'block', color: '#64748b', fontWeight: 900, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                    샘플 등록
                                </span>
                                <p style={{ margin: 0, color: '#0f172a', fontWeight: 800 }}>
                                    {sampleCount > 0 ? `${sampleCount}개 등록됨` : '아직 등록된 샘플이 없습니다.'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </section>
        )
    }

    const renderPanel = () => {
        if (activePanel === 'overview') {
            return (
                <section style={cardStyle}>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 1rem' }}>전체 현황</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div style={{ padding: '1rem', borderRadius: '0.75rem', background: '#f8fafc', border: '1px solid var(--border-color)' }}>
                            <strong style={{ display: 'block', color: '#0f172a', marginBottom: '0.4rem' }}>의뢰자 홈</strong>
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                의뢰자 영역은 내가 맡긴 일을 관리하는 곳입니다.
                            </p>
                        </div>
                        <div style={{ padding: '1rem', borderRadius: '0.75rem', background: '#f8fafc', border: '1px solid var(--border-color)' }}>
                            <strong style={{ display: 'block', color: '#0f172a', marginBottom: '0.4rem' }}>전문가 홈</strong>
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                전문가 영역은 내가 받거나 제안한 일을 관리하는 곳입니다.
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem' }}>
                        {[
                            ['받은 제안서', receivedProposals.length],
                            ['진행 중인 작업', activeWorks.length],
                            ['받은 상품 의뢰', receivedProductRequests.length],
                            ['완료된 작업', completedWorks.length],
                        ].map(([label, count]) => (
                            <div key={label} style={{ padding: '1rem', borderRadius: '0.75rem', background: '#f8fafc', border: '1px solid var(--border-color)' }}>
                                <span style={{ display: 'block', color: '#64748b', fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.45rem' }}>
                                    {label}
                                </span>
                                <strong style={{ color: '#0f172a', fontSize: '1.6rem' }}>{count}</strong>
                            </div>
                        ))}
                    </div>
                </section>
            )
        }

        if (activePanel === 'profile') {
            return renderProfileViewPanel()
        }

        if (activePanel === 'products') {
            return renderProductManagementPanel()
        }

        if (activePanel === 'favorites') {
            return renderFavoriteProductsPanel()
        }

        if (activePanel === 'client') {
            if (mode === 'work') {
                return (
                    <section className="work-dashboard-panel" style={cardStyle}>
                        {workRole === 'client' ? (
                            <div>
                                {renderClientUnifiedWorkManager()}
                            </div>
                        ) : (
                            <div>
                                {renderExpertUnifiedWorkManager()}
                            </div>
                        )}
                    </section>
                )
            }
            return (
                <section style={cardStyle}>
                    {renderClientUnifiedWorkManager()}
                </section>
            )
        }

        if (activePanel === 'expert') {
            return (
                <section style={cardStyle}>
                    {renderExpertUnifiedWorkManager()}
                </section>
            )
        }

        if (activePanel === 'consultations') {
            return renderConsultationPanel()
        }

        if (activePanel === 'workroom') {
            return (
                <ProjectListPanel
                    completedEmptyText="완료된 작업이 없습니다."
                    currentUserId={user?.id}
                    emptyText="진행 중인 작업이 없습니다."
                    initialStatusFilter={searchParams.get('panel') === 'reviews' ? 'completed' : 'active'}
                    onReviewOpen={(work) => {
                        setSelectedReviewWork(work)
                        setReviewOpen(true)
                        setReviewSubmitted(false)
                    }}
                    products={products}
                    requests={serviceRequests}
                    returnState={myPageReturnState}
                    reviews={reviews}
                    showStatusFilter
                    submittedReviewWorkId={reviewSubmitted ? selectedReviewWork?.id : undefined}
                    title="프로젝트"
                    works={roleFilteredProjectWorks}
                />
            )
        }

        return (
            <ProjectListPanel
                completedEmptyText="완료된 작업이 없습니다."
                currentUserId={user?.id}
                emptyText="진행 중인 작업이 없습니다."
                initialStatusFilter="completed"
                onReviewOpen={(work) => {
                    setSelectedReviewWork(work)
                    setReviewOpen(true)
                    setReviewSubmitted(false)
                }}
                products={products}
                requests={serviceRequests}
                returnState={myPageReturnState}
                reviews={reviews}
                showStatusFilter
                submittedReviewWorkId={reviewSubmitted ? selectedReviewWork?.id : undefined}
                title="프로젝트"
                works={roleFilteredProjectWorks}
            />
        )
    }

    if (loading) {
        return (
            <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
                로딩 중...
            </div>
        )
    }

    if (!session) return null

    const isWorkMode = mode === 'work'

    return (
        <div
            className={`mypage-page ${isWorkMode ? 'work-dashboard-page' : ''}`}
            data-testid={isWorkMode ? 'work-dashboard-page' : undefined}
            style={{ backgroundColor: 'var(--background)', minHeight: 'calc(100vh - 60px)', padding: isWorkMode ? '2.5rem 0 6rem' : '4rem 0' }}
        >
            <main className={`container mypage-container ${isWorkMode ? 'work-dashboard-container' : ''}`}>
                <div className={`mypage-header ${isWorkMode ? 'work-dashboard-header' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div className="mypage-title-block">
                        {isWorkMode && (
                            <nav className="work-dashboard-breadcrumb" aria-label="현재 위치">
                                <Link to="/">홈</Link>
                                <span aria-hidden="true">/</span>
                                <span>내 작업</span>
                            </nav>
                        )}
                        <h1 className="mypage-title" style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>{pageTitle}</h1>
                        {!isWorkMode && (
                            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                                {pageDescription}
                            </p>
                        )}
                    </div>
                </div>

                <div
                    className={isWorkMode ? 'work-dashboard-shell' : 'mypage-shell'}
                    data-testid={isWorkMode ? 'work-dashboard-shell' : undefined}
                    style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}
                >
                    <aside className={isWorkMode ? 'work-dashboard-sidebar' : 'mypage-sidebar'} style={{ ...cardStyle, padding: '1.25rem', position: 'sticky', top: '1rem' }}>
                        {isWorkMode && renderWorkRoleSwitch()}

                        {!isWorkMode && (
                            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div>
                                    <span style={{ display: 'block', fontWeight: 800, color: '#64748b', fontSize: '0.8rem', marginBottom: '0.35rem' }}>닉네임</span>
                                    <strong style={{ color: '#1e293b' }}>{name || '미설정'}</strong>
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontWeight: 800, color: '#64748b', fontSize: '0.8rem', marginBottom: '0.35rem' }}>접속 계정</span>
                                    <strong style={{ color: '#1e293b', wordBreak: 'break-all' }}>{user?.email || ''}</strong>
                                </div>
                                <div>
                                    <span style={{ display: 'block', fontWeight: 800, color: '#64748b', fontSize: '0.8rem', marginBottom: '0.35rem' }}>회원 유형</span>
                                    <strong style={{ color: isExpert ? '#1e40af' : '#166534' }}>
                                        {isExpert ? '전문가' : '의뢰자'}
                                    </strong>
                                </div>
                            </div>
                        )}

                        <nav className={isWorkMode ? 'work-dashboard-menu' : undefined} aria-label={menuLabel} style={{ display: 'grid', gap: '0.45rem' }}>
                            {menuItems.map((item) => {
                                const selected = activePanel === item.id
                                return (
                                    <button
                                        key={item.id}
                                        className={isWorkMode ? `work-dashboard-menu-button ${selected ? 'is-selected' : ''}` : undefined}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => handlePanelChange(item.id)}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: '0.8rem 0.9rem',
                                            borderRadius: '0.5rem',
                                            border: selected ? '1px solid #2563eb' : '1px solid transparent',
                                            background: selected ? '#eff6ff' : 'transparent',
                                            color: selected ? '#1d4ed8' : '#334155',
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {isWorkMode && renderWorkMenuIcon(item.id)}
                                        <span>{item.label}</span>
                                    </button>
                                )
                            })}
                        </nav>

                        <button
                            onClick={() => {
                                signOut()
                                navigate(ROUTES.HOME)
                            }}
                            style={{
                                width: '100%',
                                marginTop: '1.25rem',
                                padding: '0.85rem 1rem',
                                borderRadius: '0.5rem',
                                fontSize: '1rem',
                                background: '#ffe4e6',
                                color: '#e11d48',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 700,
                            }}
                        >
                            로그아웃
                        </button>
                        <button
                            type="button"
                            onClick={handleDeleteAccount}
                            style={{
                                width: '100%',
                                marginTop: '0.6rem',
                                padding: '0.8rem 1rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.95rem',
                                background: '#fff',
                                color: '#991b1b',
                                border: '1px solid #fecaca',
                                cursor: 'pointer',
                                fontWeight: 800,
                            }}
                        >
                            탈퇴하기
                        </button>
                    </aside>

                    <div className={isWorkMode ? 'work-dashboard-content' : undefined} data-testid={isWorkMode ? 'work-dashboard-content' : undefined}>
                        {renderPanel()}

                        {reviewOpen && (
                            <section
                                aria-label="리뷰 작성"
                                style={{
                                    marginTop: '1.5rem',
                                    ...cardStyle,
                                }}
                            >
                                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '1rem' }}>리뷰 작성하기</h2>
                                <form
                                    onSubmit={async (event) => {
                                        event.preventDefault()
                                        const reviewWork = selectedReviewWork || completedWork
                                        if (!reviewWork) return
                                        const reviewClientId = reviewWork.clientId || user?.id || ''
                                        const [reviewDisplayProfile, reviewStoredProfile] = reviewClientId
                                            ? await Promise.all([
                                                getUserDisplayProfile(reviewClientId).catch(() => null),
                                                getStoredProfile(reviewClientId).catch(() => null),
                                            ])
                                            : [null, null] as const
                                        const reviewProposal = proposals.find(
                                            (proposal) => proposal.id === reviewWork.proposalId || proposal.requestId === reviewWork.requestId,
                                        )
                                        const reviewClientName = reviewDisplayProfile?.name
                                            || reviewStoredProfile?.name
                                            || profilePreview?.name
                                            || name
                                            || user?.email?.split('@')[0]
                                            || 'AI 의뢰자'
                                        const reviewClientImageUrl = reviewDisplayProfile?.imageUrl
                                            || reviewStoredProfile?.imageUrl
                                            || profilePreview?.imageUrl
                                            || ''
                                        const newReview: Review = {
                                            id: `review-${Date.now()}`,
                                            workId: reviewWork.id,
                                            clientId: reviewClientId,
                                            expertId: reviewWork.expertId,
                                            rating: Number(reviewRating) as 1 | 2 | 3 | 4 | 5,
                                            content: reviewContent,
                                            createdAt: new Date().toISOString(),
                                            clientName: reviewClientName,
                                            ...(reviewClientImageUrl ? { clientImageUrl: reviewClientImageUrl } : {}),
                                            ...(reviewProposal?.deliveryDays ? { workDurationDays: reviewProposal.deliveryDays } : {}),
                                        }
                                        await saveReview(newReview)
                                        setReviews((current) => [newReview, ...current])
                                        setReviewSubmitted(true)
                                        setReviewOpen(false)
                                        setReviewRating('5')
                                        setReviewContent('')
                                    }}
                                    style={{ display: 'grid', gap: '1rem' }}
                                >
                                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                                        <label htmlFor="review-rating" style={{ fontWeight: 800 }}>
                                            별점
                                        </label>
                                        <select
                                            id="review-rating"
                                            value={reviewRating}
                                            onChange={(event) => setReviewRating(event.target.value)}
                                            style={{
                                                maxWidth: '12rem',
                                                padding: '0.75rem',
                                                borderRadius: '0.5rem',
                                                border: '1px solid var(--border-color)',
                                            }}
                                        >
                                            <option value="5">5점</option>
                                            <option value="4">4점</option>
                                            <option value="3">3점</option>
                                            <option value="2">2점</option>
                                            <option value="1">1점</option>
                                        </select>
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.45rem' }}>
                                        <label htmlFor="review-content" style={{ fontWeight: 800 }}>
                                            리뷰 내용
                                        </label>
                                        <textarea
                                            id="review-content"
                                            value={reviewContent}
                                            onChange={(event) => setReviewContent(event.target.value)}
                                            rows={4}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '0.85rem',
                                                borderRadius: '0.5rem',
                                                border: '1px solid var(--border-color)',
                                                resize: 'vertical',
                                            }}
                                        />
                                    </div>
                                    <button type="submit" className="btn-primary" style={{ justifySelf: 'start', padding: '0.75rem 1rem' }}>
                                        리뷰 등록
                                    </button>
                                </form>
                            </section>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
