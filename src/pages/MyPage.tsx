import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ROUTES } from '../constants/routes'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { getConsultationMessages, getExpertProducts, getUserConsultations, getUserProposals, getUserReviews, getUserServiceRequests, getUserWorks, saveConsultationMessage, saveProposal, saveReview } from '../lib/storage'
import type { Consultation, ConsultationMessage, ExpertProduct, Proposal, Review, ServiceRequestData, Work } from '../types'
import Profile from './Profile'

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

const settlementStatusText: Record<NonNullable<Work['settlementStatus']>, string> = {
    held: '작업 진행 중 보관',
    pending: '정산 대기',
    settled: '정산 완료',
    refunded: '환불 처리',
}

const currency = new Intl.NumberFormat('ko-KR')

type MyPagePanel = 'overview' | 'profile' | 'client' | 'expert' | 'consultations' | 'workroom' | 'reviews'
type MyPageMode = 'profile' | 'work' | 'all'
type StageVisualState = 'done' | 'current' | 'pending'

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

const workMenuItems: Array<{ id: MyPagePanel; label: string }> = [
    { id: 'client', label: '작업 관리' },
    { id: 'consultations', label: '상담 채팅' },
    { id: 'workroom', label: '작업방' },
    { id: 'reviews', label: '완료 / 리뷰' },
]

const legacyWorkMenuItems: Array<{ id: MyPagePanel; label: string }> = [
    { id: 'client', label: '의뢰자 홈' },
    { id: 'expert', label: '전문가 홈' },
    { id: 'workroom', label: '작업방' },
    { id: 'reviews', label: '완료 / 리뷰' },
]

const allMenuItems = [...profileMenuItems, ...legacyWorkMenuItems]

const isMyPagePanel = (value: string | null, items: Array<{ id: MyPagePanel; label: string }> = allMenuItems): value is MyPagePanel =>
    Boolean(value && items.some((item) => item.id === value))

const getClientWorkStageTitle = (work: Work) => {
    if (work.status === 'completed') return '작업 완료'
    if (work.status === 'submitted') return '결과물 검토 대기'
    if (work.status === 'revision_requested') return '수정 요청 보냄'
    return '작업방 진행'
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
    return '작업방 열기'
}

const getExpertWorkStageTitle = (work: Work) => {
    if (work.status === 'completed') return '작업 완료'
    if (work.status === 'submitted') return '제출 완료 - 승인 대기'
    if (work.status === 'revision_requested') return '수정 대응 필요'
    return '작업 진행'
}

const getExpertWorkStageDescription = (work: Work) => {
    if (work.status === 'submitted') return '결과물을 제출했고 의뢰자의 승인 또는 수정 요청을 기다립니다.'
    if (work.status === 'revision_requested') return '의뢰자가 수정 요청을 보냈습니다. 작업방에서 수정본을 다시 제출합니다.'
    return workStatusText[work.status]
}

const getExpertWorkStageActionLabel = (work: Work) => {
    if (work.status === 'completed') return '완료 작업 보기'
    if (work.status === 'submitted') return '제출물 확인하기'
    if (work.status === 'revision_requested') return '수정본 제출하기'
    return '작업방 열기'
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

export default function MyPage({ mode = 'all' }: MyPageProps = {}) {
    const { session, user, loading, signOut } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const menuItems = mode === 'profile' ? profileMenuItems : mode === 'work' ? workMenuItems : allMenuItems
    const defaultPanel = menuItems[0].id
    const searchParamString = searchParams.toString()
    const [activePanel, setActivePanel] = useState<MyPagePanel>(
        isMyPagePanel(searchParams.get('panel'), menuItems) ? searchParams.get('panel') : defaultPanel,
    )
    const [selectedClientOrderId, setSelectedClientOrderId] = useState<string | number | null>(searchParams.get('clientOrder'))
    const [selectedExpertRequestId, setSelectedExpertRequestId] = useState<string | number | null>(searchParams.get('expertRequest'))
    const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(searchParams.get('consultation'))
    const [isExpert, setIsExpert] = useState(false)
    const [name, setName] = useState('')
    const [reviewOpen, setReviewOpen] = useState(false)
    const [reviewSubmitted, setReviewSubmitted] = useState(false)
    const [reviewRating, setReviewRating] = useState('5')
    const [reviewContent, setReviewContent] = useState('')
    const [expertProposalMessage, setExpertProposalMessage] = useState('')
    const [workRole, setWorkRole] = useState<'client' | 'expert'>('client')
    const [products, setProducts] = useState<ExpertProduct[]>([])
    const [proposals, setProposals] = useState<Proposal[]>([])
    const [serviceRequests, setServiceRequests] = useState<ServiceRequestData[]>([])
    const [reviews, setReviews] = useState<Review[]>([])
    const [works, setWorks] = useState<Work[]>([])
    const [consultations, setConsultations] = useState<Consultation[]>([])
    const [consultationMessages, setConsultationMessages] = useState<ConsultationMessage[]>([])
    const [consultationMessageBody, setConsultationMessageBody] = useState('')
    const [consultationMessageSubmitting, setConsultationMessageSubmitting] = useState(false)
    const [consultationMessageError, setConsultationMessageError] = useState('')
    const [consultationProposalSubmitting, setConsultationProposalSubmitting] = useState(false)
    const [selectedReviewWork, setSelectedReviewWork] = useState<Work | null>(null)
    const myPageReturnState = { from: { pathname: location.pathname, search: location.search } }

    const fetchProfile = useCallback(async () => {
        if (!supabase || !user) return
        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (data) {
            setIsExpert(data.is_expert)
            setName(data.name || '')
        } else if (error && error.code !== 'PGRST116') {
            console.error('프로필 로딩 오류:', error)
        }
    }, [user])

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
        const panel = currentParams.get('panel')
        const clientOrder = currentParams.get('clientOrder')
        const expertRequest = currentParams.get('expertRequest')
        const consultation = currentParams.get('consultation')
        const nextPanel = isMyPagePanel(panel, menuItems) ? panel : defaultPanel

        setActivePanel((currentPanel) => (currentPanel === nextPanel ? currentPanel : nextPanel))
        setSelectedClientOrderId((currentId) => (currentId === clientOrder ? currentId : clientOrder))
        setSelectedExpertRequestId((currentId) => (currentId === expertRequest ? currentId : expertRequest))
        setSelectedConsultationId((currentId) => (currentId === consultation ? currentId : consultation))
    }, [defaultPanel, menuItems, searchParamString])

    useEffect(() => {
        const currentParams = new URLSearchParams(searchParamString)
        const panel = currentParams.get('panel')
        const panelFromUrl = isMyPagePanel(panel, menuItems) ? panel : defaultPanel
        if (panelFromUrl !== activePanel) return

        const nextParams = new URLSearchParams()
        if (activePanel !== defaultPanel) nextParams.set('panel', activePanel)
        if (activePanel === 'client' && selectedClientOrderId) nextParams.set('clientOrder', String(selectedClientOrderId))
        if (activePanel === 'expert' && selectedExpertRequestId) nextParams.set('expertRequest', String(selectedExpertRequestId))
        if (activePanel === 'consultations' && selectedConsultationId) nextParams.set('consultation', selectedConsultationId)

        if (currentParams.toString() !== nextParams.toString()) {
            setSearchParams(nextParams, { replace: true })
        }
    }, [activePanel, defaultPanel, menuItems, selectedClientOrderId, selectedExpertRequestId, selectedConsultationId, searchParamString, setSearchParams])

    useEffect(() => {
        if (user && supabase) {
            fetchProfile()
        }
        if (user) {
            getUserProposals(user.id).then(setProposals).catch((error) => {
                console.error('제안서 목록 로딩 오류:', error)
                setProposals([])
            })
            getUserServiceRequests(user.id).then(setServiceRequests).catch((error) => {
                console.error('의뢰 요청 목록 로딩 오류:', error)
                setServiceRequests([])
            })
            getUserWorks(user.id).then(setWorks).catch((error) => {
                console.error('작업 목록 로딩 오류:', error)
                setWorks([])
            })
            getUserReviews(user.id).then(setReviews).catch((error) => {
                console.error('리뷰 목록 로딩 오류:', error)
                setReviews([])
            })
            getUserConsultations(user.id).then(setConsultations).catch((error) => {
                console.error('상담 목록 로딩 오류:', error)
                setConsultations([])
            })
            getExpertProducts().then(setProducts).catch((error) => {
                console.error('상품 목록 로딩 오류:', error)
                setProducts([])
            })
        }
    }, [fetchProfile, user])

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
        setConsultationMessageBody('')
        setConsultationMessageError('')
    }, [selectedConsultationId])

    const completedWork = works.find((work) => work.status === 'completed') || null
    const receivedProposals = proposals.filter((proposal) => proposal.clientId === user?.id)
    const sentProposals = proposals.filter((proposal) => proposal.expertId === user?.id)
    const receivedProductRequests = serviceRequests.filter((request) => request.expertId === user?.id && request.productId)
    const clientProductRequests = serviceRequests.filter((request) => request.clientId === user?.id && request.productId)
    const clientConsultations = consultations.filter((consultation) => consultation.clientId === user?.id)
    const expertConsultations = consultations.filter((consultation) => consultation.expertId === user?.id)
    const myProducts = products.filter((product) => product.expertId === user?.id)
    const activeWorks = works.filter((work) => work.status !== 'completed')
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
    const pageTitle = mode === 'work' ? '내 작업' : '마이페이지'
    const pageDescription = mode === 'profile'
        ? '프로필과 계정 기본 정보를 확인합니다.'
        : '의뢰, 제안, 작업방, 완료 리뷰를 한 곳에서 관리합니다.'
    const menuLabel = mode === 'work' ? '내 작업 메뉴' : '마이페이지 메뉴'

    const getProposalForRequest = (request: ServiceRequestData) =>
        proposals.find((proposal) => proposal.requestId === request.id)

    const getWorkForRequest = (request: ServiceRequestData) => {
        const requestProposal = getProposalForRequest(request)
        return works.find((work) => work.requestId === request.id || work.proposalId === requestProposal?.id) || null
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

    type UnifiedWorkItem =
        | { kind: 'product'; id: string | number; createdTime: number; request: ServiceRequestData }
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
        ...clientConsultationsByCreatedAt.map((consultation): UnifiedWorkItem => ({
            kind: 'consultation',
            id: consultation.id,
            createdTime: getConsultationCreatedTime(consultation),
            consultation,
        })),
    ])

    const expertUnifiedWorkItems = sortUnifiedWorkItems([
        ...receivedProductRequestsByCreatedAt.map((request): UnifiedWorkItem => ({
            kind: 'product',
            id: request.id,
            createdTime: getRequestCreatedTime(request),
            request,
        })),
        ...expertConsultationsByCreatedAt.map((consultation): UnifiedWorkItem => ({
            kind: 'consultation',
            id: consultation.id,
            createdTime: getConsultationCreatedTime(consultation),
            consultation,
        })),
    ])

    const selectedClientUnifiedWorkItem =
        clientUnifiedWorkItems.find((item) => item.kind === 'product' && item.id === selectedClientOrderId) ||
        clientUnifiedWorkItems.find((item) => item.kind === 'consultation' && item.id === selectedConsultationId) ||
        clientUnifiedWorkItems[0] ||
        null

    const selectedExpertUnifiedWorkItem =
        expertUnifiedWorkItems.find((item) => item.kind === 'product' && item.id === selectedExpertRequestId) ||
        expertUnifiedWorkItems.find((item) => item.kind === 'consultation' && item.id === selectedConsultationId) ||
        expertUnifiedWorkItems[0] ||
        null

    const selectedClientOrder = clientProductRequestsByCreatedAt.find((request) => request.id === selectedClientOrderId) || clientProductRequestsByCreatedAt[0] || null
    const selectedClientOrderProduct = selectedClientOrder
        ? products.find((product) => product.id === selectedClientOrder.productId)
        : null
    const selectedClientOrderProposal = selectedClientOrder
        ? receivedProposals.find((proposal) => proposal.requestId === selectedClientOrder.id)
        : null
    const selectedClientOrderWork = selectedClientOrder
        ? works.find((work) => work.requestId === selectedClientOrder.id || work.proposalId === selectedClientOrderProposal?.id)
        : null
    const selectedExpertRequest = receivedProductRequestsByCreatedAt.find((request) => request.id === selectedExpertRequestId) || receivedProductRequestsByCreatedAt[0] || null
    const selectedExpertRequestProduct = selectedExpertRequest
        ? products.find((product) => product.id === selectedExpertRequest.productId)
        : null
    const selectedExpertRequestProposal = selectedExpertRequest
        ? sentProposals.find((proposal) => proposal.requestId === selectedExpertRequest.id)
        : null
    const selectedExpertRequestWork = selectedExpertRequest ? getWorkForRequest(selectedExpertRequest) : null
    const selectedPanelConsultation = roleFilteredConsultations.find((consultation) => consultation.id === selectedConsultationId) || roleFilteredConsultations[0] || null
    const selectedConsultation = consultations.find((consultation) => consultation.id === selectedConsultationId) || selectedPanelConsultation || consultations[0] || null
    const selectedClientConsultation = clientConsultationsByCreatedAt.find((consultation) => consultation.id === selectedConsultationId) || clientConsultationsByCreatedAt[0] || null
    const selectedExpertConsultation = expertConsultationsByCreatedAt.find((consultation) => consultation.id === selectedConsultationId) || expertConsultationsByCreatedAt[0] || null
    const selectedConsultationProduct = selectedConsultation
        ? products.find((product) => product.id === selectedConsultation.productId)
        : null
    const selectedPanelConsultationProduct = selectedPanelConsultation
        ? products.find((product) => product.id === selectedPanelConsultation.productId)
        : null

    useEffect(() => {
        if (mode !== 'work' || activePanel !== 'consultations' || !selectedConsultationId || !user) return
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

        setConsultationMessageSubmitting(true)
        setConsultationMessageError('')
        try {
            const message = await saveConsultationMessage({
                consultationId: selectedConsultation.id,
                senderId: user.id,
                body,
            })
            setConsultationMessages((current) => [...current, message])
            setConsultations((current) =>
                current.map((consultation) =>
                    consultation.id === selectedConsultation.id
                        ? { ...consultation, lastMessageAt: message.createdAt }
                        : consultation,
                ),
            )
            setConsultationMessageBody('')
        } catch (error) {
            console.error('상담 메시지 전송 오류:', error)
            setConsultationMessageError('메시지를 보내지 못했습니다. 잠시 후 다시 시도해주세요.')
        } finally {
            setConsultationMessageSubmitting(false)
        }
    }
    const handleSendProductProposal = async () => {
        if (!selectedExpertRequest || !user) return

        const standardPackage = selectedExpertRequestProduct?.packages?.standard
        const totalPrice = Number(standardPackage?.price || selectedExpertRequest.budget || selectedExpertRequestProduct?.startingPrice || 0)
        const deliveryDays = Number(standardPackage?.deliveryDays || selectedExpertRequestProduct?.deliveryDays || 1)
        const revisionCount = Number(standardPackage?.revisionCount || selectedExpertRequestProduct?.revisionCount || 1)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 3)
        const proposal: Proposal = {
            id: `proposal-${selectedExpertRequest.id}`,
            requestId: String(selectedExpertRequest.id),
            clientId: selectedExpertRequest.clientId || '',
            expertId: user.id,
            title: `${selectedExpertRequest.desiredResult || selectedExpertRequest.title} 제안서`,
            scope: selectedExpertRequest.description || selectedExpertRequest.purpose || '의뢰 요구사항에 맞춰 작업합니다.',
            deliverables: [selectedExpertRequest.desiredResult || selectedExpertRequest.title],
            totalPrice: Number.isFinite(totalPrice) && totalPrice > 0 ? totalPrice : 0,
            deliveryDays: Number.isFinite(deliveryDays) && deliveryDays > 0 ? deliveryDays : 1,
            revisionCount: Number.isFinite(revisionCount) && revisionCount >= 0 ? revisionCount : 1,
            progressType: selectedExpertRequest.progressType || 'single',
            milestones: [],
            commercialUseAllowed: true,
            sourceFileIncluded: false,
            status: 'sent',
            expiresAt: expiresAt.toISOString(),
        }

        const savedProposalId = await saveProposal(proposal)
        const savedProposal = { ...proposal, id: savedProposalId }
        setProposals((current) => [savedProposal, ...current])
        setExpertProposalMessage('제안서를 보냈습니다.')
    }

    const handleCreateConsultationProposal = async () => {
        if (!selectedConsultation || !user || selectedConsultation.expertId !== user.id) return

        const product = products.find((item) => item.id === selectedConsultation.productId)
        const standardPackage = product?.packages?.standard
        const totalPrice = Number(standardPackage?.price || product?.startingPrice || 0)
        const deliveryDays = Number(standardPackage?.deliveryDays || product?.deliveryDays || 1)
        const revisionCount = Number(standardPackage?.revisionCount || product?.revisionCount || 1)
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 3)

        const proposal: Proposal = {
            id: `proposal-consultation-${selectedConsultation.id}`,
            requestId: `consultation-${selectedConsultation.id}`,
            clientId: selectedConsultation.clientId,
            expertId: user.id,
            title: `${selectedConsultation.title} 제안서`,
            scope: consultationMessages[0]?.body || '상담 내용을 바탕으로 작업 범위와 조건을 제안합니다.',
            deliverables: [product?.title || selectedConsultation.title],
            totalPrice: Number.isFinite(totalPrice) && totalPrice > 0 ? totalPrice : 0,
            deliveryDays: Number.isFinite(deliveryDays) && deliveryDays > 0 ? deliveryDays : 1,
            revisionCount: Number.isFinite(revisionCount) && revisionCount >= 0 ? revisionCount : 1,
            progressType: 'single',
            milestones: [],
            commercialUseAllowed: true,
            sourceFileIncluded: false,
            status: 'sent',
            paymentStatus: 'unpaid',
            expiresAt: expiresAt.toISOString(),
        }

        setConsultationProposalSubmitting(true)
        try {
            const savedProposalId = await saveProposal(proposal)
            const savedProposal = { ...proposal, id: savedProposalId }
            setProposals((current) => [savedProposal, ...current])
            setConsultations((current) =>
                current.map((consultation) =>
                    consultation.id === selectedConsultation.id
                        ? { ...consultation, status: 'proposal_sent' }
                        : consultation,
                ),
            )
            navigate(`/proposal/${savedProposalId}`, { state: myPageReturnState })
        } finally {
            setConsultationProposalSubmitting(false)
        }
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
        if (panel !== defaultPanel) nextParams.set('panel', panel)
        if (panel === 'client' && selectedClientOrderId) nextParams.set('clientOrder', String(selectedClientOrderId))
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
        setWorkRole(nextRole)
        if (activePanel !== 'consultations') return

        const nextConsultation = nextRole === 'client'
            ? clientConsultationsByCreatedAt[0] || null
            : expertConsultationsByCreatedAt[0] || null

        setSelectedConsultationId(nextConsultation?.id || null)

        const nextParams = new URLSearchParams()
        nextParams.set('panel', 'consultations')
        if (nextConsultation) nextParams.set('consultation', nextConsultation.id)
        setSearchParams(nextParams)
    }

    const renderWorkCards = (items: Work[], emptyText: string) => (
        <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
            {items.length > 0 ? (
                items.map((work) => (
                    <div
                        key={work.id}
                        data-testid={work.status === 'completed' ? 'completed-work' : 'active-work'}
                        style={{
                            padding: '1rem',
                            borderRadius: '0.75rem',
                            background: work.status === 'completed' ? '#f0fdf4' : '#f8fafc',
                            border: '1px solid var(--border-color)',
                        }}
                    >
                        <Link
                            to={`/workroom/${work.id}`}
                            state={myPageReturnState}
                            style={{
                                display: 'inline-block',
                                color: '#0f172a',
                                fontWeight: 800,
                                textDecoration: 'none',
                                marginBottom: '0.45rem',
                            }}
                        >
                            {work.title}
                        </Link>
                        <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.8rem' }}>
                            {workStatusText[work.status]}
                        </p>
                        {work.settlementStatus && (
                            <div style={{ display: 'grid', gap: '0.25rem', marginBottom: '0.8rem', color: '#475569', fontWeight: 800 }}>
                                <span>{settlementStatusText[work.settlementStatus]}</span>
                                {typeof work.expertPayout === 'number' && work.expertPayout > 0 && (
                                    <span>전문가 정산 예정 {currency.format(work.expertPayout)}원</span>
                                )}
                            </div>
                        )}
                        {work.status === 'completed' && work.clientId === user?.id && !reviews.some((review) => review.workId === work.id && review.clientId === user?.id) && (
                            <button
                                type="button"
                                className="btn-primary"
                                style={{ padding: '0.65rem 0.9rem' }}
                                onClick={() => {
                                    setSelectedReviewWork(work)
                                    setReviewOpen(true)
                                    setReviewSubmitted(false)
                                }}
                            >
                                리뷰 작성
                            </button>
                        )}
                        {work.status === 'completed' && work.clientId === user?.id && reviews.some((review) => review.workId === work.id && review.clientId === user?.id) && (
                            <p style={{ color: '#166534', fontWeight: 800, margin: '0.8rem 0 0' }}>
                                리뷰 등록 완료
                            </p>
                        )}
                        {reviewSubmitted && selectedReviewWork?.id === work.id && work.clientId === user?.id && (
                            <p style={{ color: '#166534', fontWeight: 800, margin: '0.8rem 0 0' }}>
                                리뷰가 등록되었습니다.
                            </p>
                        )}
                    </div>
                ))
            ) : (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{emptyText}</p>
            )}
        </div>
    )

    const renderWorkRoleSwitch = () => (
        <div
            aria-label="내 작업 역할 전환"
            style={{
                display: 'grid',
                padding: '0.3rem',
                borderRadius: '0.75rem',
                background: '#f1f5f9',
                border: '1px solid var(--border-color)',
                gap: '0.3rem',
            }}
        >
            <button
                type="button"
                aria-pressed={workRole === 'client'}
                onClick={() => handleWorkRoleChange('client')}
                style={{
                    padding: '0.75rem 0.9rem',
                    borderRadius: '0.55rem',
                    border: 'none',
                    background: workRole === 'client' ? 'white' : 'transparent',
                    color: workRole === 'client' ? '#1d4ed8' : '#475569',
                    fontWeight: 800,
                    textAlign: 'left',
                    cursor: 'pointer',
                }}
            >
                의뢰자로 보기
            </button>
            <button
                type="button"
                aria-pressed={workRole === 'expert'}
                onClick={() => handleWorkRoleChange('expert')}
                style={{
                    padding: '0.75rem 0.9rem',
                    borderRadius: '0.55rem',
                    border: 'none',
                    background: workRole === 'expert' ? 'white' : 'transparent',
                    color: workRole === 'expert' ? '#166534' : '#475569',
                    fontWeight: 800,
                    textAlign: 'left',
                    cursor: 'pointer',
                }}
            >
                전문가로 보기
            </button>
        </div>
    )

    const renderClientOrderStage = (
        phase: string,
        title: string,
        description: string,
        state: StageVisualState,
        action?: { label: string; to: string; onClick?: () => void },
    ) => {
        const visual = stageVisualConfig[state]
        const mutedProps = state === 'pending' ? { 'data-stage-muted': 'true' } : {}
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
            <p {...mutedProps} style={{ color: visual.bodyColor, margin: action ? '0 0 0.75rem' : 0 }}>{description}</p>
            {action && (
                <Link className="btn-text" to={action.to} state={myPageReturnState} onClick={action.onClick}>
                    {action.label}
                </Link>
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
        <section data-testid={testId}>
            {items.length > 0 ? (
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                    {items.map((item) => {
                        const product = item.kind === 'product'
                            ? products.find((entry) => entry.id === item.request.productId)
                            : products.find((entry) => entry.id === item.consultation.productId)
                        const selected = selectedItem?.kind === item.kind && selectedItem.id === item.id
                        const title = item.kind === 'product'
                            ? product?.title || item.request.desiredResult || item.request.title
                            : product?.title || item.consultation.title
                        const subtitle = item.kind === 'product'
                            ? item.request.desiredResult || item.request.title
                            : item.consultation.title

                        return (
                            <button
                                key={`${item.kind}-${item.id}`}
                                type="button"
                                data-work-item-kind={item.kind}
                                data-work-item-id={String(item.id)}
                                aria-pressed={selected}
                                onClick={() => onSelect(item)}
                                style={{
                                    textAlign: 'left',
                                    padding: '1rem',
                                    borderRadius: '0.75rem',
                                    border: selected ? '1px solid #2563eb' : '1px solid var(--border-color)',
                                    background: selected ? '#eff6ff' : '#f8fafc',
                                    cursor: 'pointer',
                                }}
                            >
                                <span
                                    style={{
                                        display: 'inline-block',
                                        marginBottom: '0.45rem',
                                        color: item.kind === 'consultation' ? '#7c3aed' : '#1d4ed8',
                                        fontSize: '0.78rem',
                                        fontWeight: 800,
                                    }}
                                >
                                    {item.kind === 'consultation' ? '전문가 문의' : '상품 주문'}
                                </span>
                                <strong style={{ display: 'block', color: '#0f172a', marginBottom: '0.4rem' }}>
                                    {title}
                                </strong>
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
                                    {subtitle}
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

    const renderConsultationFlow = (consultation: Consultation | null, role: 'client' | 'expert') => {
        if (!consultation) return null
        const product = products.find((item) => item.id === consultation.productId)
        const consultationUrl = `${ROUTES.WORK_DASHBOARD}?panel=consultations&consultation=${consultation.id}`
        const proposalLabel = '상담 후 제안서 작성'
        const proposalDescription = '상담 내용을 바탕으로 제안서를 작성해 의뢰자에게 보냅니다.'

        return (
            <div data-testid={`${role}-consultation-order-flow`} style={{ padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', background: 'white' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.4rem' }}>
                    전문가 문의 - {product?.title || consultation.title}
                </h3>
                <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem' }}>
                    전문가 문의 · {consultation.status === 'proposal_sent' ? '제안서 발송됨' : consultation.status === 'closed' ? '종료됨' : '상담 중'}
                </p>
                <p style={{ color: '#1d4ed8', fontWeight: 800, margin: '0 0 1rem' }}>
                    현재 단계: 상담 채팅
                </p>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.75rem' }}>상담 전체 과정</h4>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {renderClientOrderStage(
                        '작업 전',
                        '상담 채팅',
                        '전문가 문의로 시작한 거래입니다. 채팅에서 범위와 조건을 먼저 협의합니다.',
                        consultation.status === 'open' ? 'current' : 'done',
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
                    )}
                    {role === 'expert' && renderClientOrderStage(
                        '검토 단계',
                        proposalLabel,
                        proposalDescription,
                        consultation.status === 'proposal_sent' ? 'current' : 'pending',
                    )}
                    {renderClientOrderStage('결제', '제안서 승인 및 결제', '제안서를 승인하고 결제하면 작업방이 생성됩니다.', consultation.status === 'proposal_sent' ? 'current' : 'pending')}
                    {renderClientOrderStage('작업 중', '작업방 대기', '결제가 끝나면 작업방에서 제작을 진행합니다.', 'pending')}
                    {renderClientOrderStage('상담 후', '상담 완료/리뷰', '작업이 완료되면 결과 확인과 리뷰 작성이 가능합니다.', 'pending')}
                </div>
            </div>
        )
    }

    const renderClientProductOrderManager = () => (
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
                                        ? { label: '의뢰서 보기/수정', to: `/request/${selectedClientOrder.productId}?requestId=${selectedClientOrder.id}` }
                                        : undefined,
                                )}
                                {selectedClientOrderProposal
                                    ? renderClientOrderStage(
                                        '결제',
                                        '제안서 승인 및 결제',
                                        selectedClientOrderWork
                                            ? '결제 완료 후 작업방이 생성되었습니다.'
                                            : selectedClientOrderProposal.paymentStatus === 'paid'
                                                ? '결제 완료 처리가 반영되었습니다. 작업방 생성을 기다립니다.'
                                                : `${selectedClientOrderProposal.totalPrice.toLocaleString()}원 · ${selectedClientOrderProposal.deliveryDays}일 · ${proposalStatusText[selectedClientOrderProposal.status]} · 제안서 화면에서 승인 및 결제를 진행합니다.`,
                                        selectedClientOrderWork || selectedClientOrderProposal.paymentStatus === 'paid' ? 'done' : 'current',
                                        { label: '제안서 보기', to: `/proposal/${selectedClientOrderProposal.id}` },
                                    )
                                    : renderClientOrderStage('결제', '제안서 승인 및 결제', '전문가가 제안서를 보내면 이 단계에서 승인과 결제를 진행합니다.', 'current')}
                                {selectedClientOrderWork
                                    ? renderClientOrderStage(
                                        '작업 중',
                                        getClientWorkStageTitle(selectedClientOrderWork),
                                        getClientWorkStageDescription(selectedClientOrderWork),
                                        selectedClientOrderWork.status === 'completed' ? 'done' : 'current',
                                        { label: getClientWorkStageActionLabel(selectedClientOrderWork), to: `/workroom/${selectedClientOrderWork.id}` },
                                    )
                                    : renderClientOrderStage('작업 중', '작업방 대기', '제안서를 승인하면 작업방이 생성됩니다.', 'pending')}
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

    const renderExpertReceivedWorkManager = () => (
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
                                    selectedExpertRequest.productId ? { label: '상품 보기', to: `/expert/${selectedExpertRequest.productId}` } : undefined,
                                )}
                                {selectedExpertRequestProposal
                                    ? renderClientOrderStage(
                                        '검토 단계',
                                        '제안서 작성/수정',
                                        `${selectedExpertRequestProposal.totalPrice.toLocaleString()}원 · ${selectedExpertRequestProposal.deliveryDays}일 · ${proposalStatusText[selectedExpertRequestProposal.status]}`,
                                        selectedExpertRequestWork ? 'done' : 'current',
                                        { label: '보낸 제안서 보기', to: `/proposal/${selectedExpertRequestProposal.id}` },
                                    )
                                    : renderClientOrderStage('검토 단계', '제안서 작성/수정', '의뢰 내용을 확인하고 제안서를 보낼 수 있습니다.', selectedExpertRequestWork ? 'pending' : 'current')}
                                {selectedExpertRequestProposal
                                    ? renderClientOrderStage(
                                        '결제',
                                        selectedExpertRequestWork || selectedExpertRequestProposal.paymentStatus === 'paid' ? '테스트 결제 완료' : '제안서 승인 및 결제 대기',
                                        selectedExpertRequestWork
                                            ? '의뢰자가 결제 완료 처리 후 작업방이 생성되었습니다.'
                                            : selectedExpertRequestProposal.paymentStatus === 'paid'
                                                ? '의뢰자의 결제 완료 처리가 반영되었습니다. 작업방 생성을 기다립니다.'
                                                : '의뢰자가 제안서를 승인하고 결제를 완료하면 작업방이 생성됩니다.',
                                        selectedExpertRequestWork || selectedExpertRequestProposal.paymentStatus === 'paid' ? 'done' : 'pending',
                                    )
                                    : renderClientOrderStage('결제', '제안서 승인 및 결제 대기', '제안서를 보낸 뒤 의뢰자의 승인과 결제를 기다립니다.', 'pending')}
                                {selectedExpertRequestWork
                                    ? renderClientOrderStage(
                                        '작업 중',
                                        getExpertWorkStageTitle(selectedExpertRequestWork),
                                        getExpertWorkStageDescription(selectedExpertRequestWork),
                                        selectedExpertRequestWork.status === 'completed' ? 'done' : 'current',
                                        { label: getExpertWorkStageActionLabel(selectedExpertRequestWork), to: `/workroom/${selectedExpertRequestWork.id}` },
                                    )
                                    : renderClientOrderStage('작업 중', '작업 진행', '제안서가 승인되면 작업방에서 진행합니다.', 'pending')}
                                {renderClientOrderStage(
                                    '작업 완료',
                                    '작업 완료',
                                    selectedExpertRequestWork?.status === 'completed' ? '의뢰자에게 결과물을 전달한 작업입니다.' : '결과물을 제출하고 의뢰자 확인을 기다립니다.',
                                    selectedExpertRequestWork?.status === 'completed' ? 'done' : 'pending',
                                )}
                            </div>
                            {!selectedExpertRequestProposal && !selectedExpertRequestWork && (
                                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <button type="button" className="btn-primary" onClick={handleSendProductProposal}>
                                        제안서 보내기
                                    </button>
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
                                        받은 상품 의뢰에 바로 제안서를 보냅니다.
                                    </span>
                                </div>
                            )}
                            {expertProposalMessage && (
                                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <p style={{ margin: 0, color: '#166534', fontWeight: 800 }}>{expertProposalMessage}</p>
                                </div>
                            )}
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

        return (
            <div data-testid="client-product-order-flow" style={{ padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', background: 'white' }}>
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
                            ? { label: '의뢰서 보기/수정', to: `/request/${selectedClientOrder.productId}?requestId=${selectedClientOrder.id}` }
                            : undefined,
                    )}
                    {selectedClientOrderProposal
                        ? renderClientOrderStage(
                            '결제',
                            '제안서 승인 및 결제',
                            selectedClientOrderWork
                                ? '결제 완료 후 작업방이 생성되었습니다.'
                                : selectedClientOrderProposal.paymentStatus === 'paid'
                                    ? '결제 완료 처리가 반영되었습니다. 작업방 생성을 기다립니다.'
                                    : `${selectedClientOrderProposal.totalPrice.toLocaleString()}원 · ${selectedClientOrderProposal.deliveryDays}일 · ${proposalStatusText[selectedClientOrderProposal.status]} · 제안서 화면에서 승인 및 결제를 진행합니다.`,
                            selectedClientOrderWork || selectedClientOrderProposal.paymentStatus === 'paid' ? 'done' : 'current',
                            { label: '제안서 보기', to: `/proposal/${selectedClientOrderProposal.id}` },
                        )
                        : renderClientOrderStage('결제', '제안서 승인 및 결제', '전문가가 제안서를 보내면 이 단계에서 승인과 결제를 진행합니다.', 'current')}
                    {selectedClientOrderWork
                        ? renderClientOrderStage(
                            '작업 중',
                            getClientWorkStageTitle(selectedClientOrderWork),
                            getClientWorkStageDescription(selectedClientOrderWork),
                            selectedClientOrderWork.status === 'completed' ? 'done' : 'current',
                            { label: getClientWorkStageActionLabel(selectedClientOrderWork), to: `/workroom/${selectedClientOrderWork.id}` },
                        )
                        : renderClientOrderStage('작업 중', '작업방 대기', '제안서를 승인하면 작업방이 생성됩니다.', 'pending')}
                    {renderClientOrderStage(
                        '작업 후',
                        '완료 확인/리뷰',
                        selectedClientOrderWork?.status === 'completed' ? '결과물을 확인하고 리뷰를 남길 수 있습니다.' : '작업이 완료되면 결과 확인과 리뷰 작성이 가능합니다.',
                        selectedClientOrderWork?.status === 'completed' ? 'current' : 'pending',
                    )}
                </div>
            </div>
        )
    }

    const renderExpertSelectedProductFlow = () => {
        if (!selectedExpertRequest) return null

        return (
            <div data-testid="expert-product-order-flow" style={{ padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', background: 'white' }}>
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
                        selectedExpertRequest.productId ? { label: '상품 보기', to: `/expert/${selectedExpertRequest.productId}` } : undefined,
                    )}
                    {selectedExpertRequestProposal
                        ? renderClientOrderStage(
                            '검토 단계',
                            '제안서 작성/수정',
                            `${selectedExpertRequestProposal.totalPrice.toLocaleString()}원 · ${selectedExpertRequestProposal.deliveryDays}일 · ${proposalStatusText[selectedExpertRequestProposal.status]}`,
                            selectedExpertRequestWork ? 'done' : 'current',
                            { label: '보낸 제안서 보기', to: `/proposal/${selectedExpertRequestProposal.id}` },
                        )
                        : renderClientOrderStage('검토 단계', '제안서 작성/수정', '의뢰 내용을 확인하고 제안서를 보낼 수 있습니다.', selectedExpertRequestWork ? 'pending' : 'current')}
                    {selectedExpertRequestProposal
                        ? renderClientOrderStage(
                            '결제',
                            selectedExpertRequestWork || selectedExpertRequestProposal.paymentStatus === 'paid' ? '테스트 결제 완료' : '제안서 승인 및 결제 대기',
                            selectedExpertRequestWork
                                ? '의뢰자가 결제 완료 처리 후 작업방이 생성되었습니다.'
                                : selectedExpertRequestProposal.paymentStatus === 'paid'
                                    ? '의뢰자의 결제 완료 처리가 반영되었습니다. 작업방 생성을 기다립니다.'
                                    : '의뢰자가 제안서를 승인하고 결제를 완료하면 작업방이 생성됩니다.',
                            selectedExpertRequestWork || selectedExpertRequestProposal.paymentStatus === 'paid' ? 'done' : 'pending',
                        )
                        : renderClientOrderStage('결제', '제안서 승인 및 결제 대기', '제안서를 보낸 뒤 의뢰자의 승인과 결제를 기다립니다.', 'pending')}
                    {selectedExpertRequestWork
                        ? renderClientOrderStage(
                            '작업 중',
                            getExpertWorkStageTitle(selectedExpertRequestWork),
                            getExpertWorkStageDescription(selectedExpertRequestWork),
                            selectedExpertRequestWork.status === 'completed' ? 'done' : 'current',
                            { label: getExpertWorkStageActionLabel(selectedExpertRequestWork), to: `/workroom/${selectedExpertRequestWork.id}` },
                        )
                        : renderClientOrderStage('작업 중', '작업 진행', '제안서가 승인되면 작업방에서 진행합니다.', 'pending')}
                    {renderClientOrderStage(
                        '작업 완료',
                        '작업 완료',
                        selectedExpertRequestWork?.status === 'completed' ? '의뢰자에게 결과물을 전달한 완료 작업입니다.' : '결과물을 제출하고 의뢰자 확인을 기다립니다.',
                        selectedExpertRequestWork?.status === 'completed' ? 'done' : 'pending',
                    )}
                </div>
                {!selectedExpertRequestProposal && !selectedExpertRequestWork && (
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button type="button" className="btn-primary" onClick={handleSendProductProposal}>
                            제안서 보내기
                        </button>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
                            받은 상품 의뢰에 바로 제안서를 보냅니다.
                        </span>
                    </div>
                )}
                {expertProposalMessage && (
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <p style={{ margin: 0, color: '#166534', fontWeight: 800 }}>{expertProposalMessage}</p>
                    </div>
                )}
            </div>
        )
    }

    const renderClientUnifiedWorkManager = () => (
        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
            {clientUnifiedWorkItems.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.9fr) minmax(0, 1.4fr)', gap: '1rem', alignItems: 'start' }}>
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
            )}
        </div>
    )

    const renderExpertUnifiedWorkManager = () => (
        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
            {expertUnifiedWorkItems.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.9fr) minmax(0, 1.4fr)', gap: '1rem', alignItems: 'start' }}>
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
            )}
        </div>
    )

    const renderConsultationPanel = () => (
        <section style={cardStyle}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.5rem' }}>상담 채팅</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.25rem' }}>
                전문가 문의로 시작한 상담을 한 곳에서 확인합니다. 상담 후 제안서를 받아야 결제와 작업방 생성으로 이어집니다.
            </p>

            {roleFilteredConsultations.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.8fr) minmax(0, 1.5fr)', gap: '1rem', alignItems: 'start' }}>
                    <div aria-label="상담 채팅 목록" style={{ display: 'grid', gap: '0.65rem' }}>
                        {roleFilteredConsultations.map((consultation) => {
                            const selected = selectedPanelConsultation?.id === consultation.id
                            const product = products.find((item) => item.id === consultation.productId)
                            return (
                                <button
                                    key={consultation.id}
                                    type="button"
                                    aria-pressed={selected}
                                    onClick={() => {
                                        setActivePanel('consultations')
                                        setSelectedConsultationId(consultation.id)
                                    }}
                                    style={{
                                        textAlign: 'left',
                                        padding: '1rem',
                                        borderRadius: '0.75rem',
                                        border: selected ? '1px solid #2563eb' : '1px solid var(--border-color)',
                                        background: selected ? '#eff6ff' : '#f8fafc',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <strong style={{ display: 'block', color: '#0f172a', marginBottom: '0.35rem' }}>
                                        {consultation.title}
                                    </strong>
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>
                                        {product?.title || '상품 상담'} · {consultation.status === 'proposal_sent' ? '제안서 발송됨' : consultation.status === 'closed' ? '종료됨' : '상담 중'}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    <div style={{ padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', background: '#fff' }}>
                        {selectedPanelConsultation ? (
                            <>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.35rem' }}>
                                    {selectedPanelConsultation.title}
                                </h3>
                                <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem' }}>
                                    {selectedPanelConsultationProduct?.title || '상품 상담'} · {selectedPanelConsultation.status === 'proposal_sent' ? '제안서 발송됨' : selectedPanelConsultation.status === 'closed' ? '종료됨' : '상담 중'}
                                </p>
                                <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                                    {consultationMessages.length > 0 ? (
                                        consultationMessages.map((message) => {
                                            const mine = message.senderId === user?.id
                                            return (
                                                <div
                                                    key={message.id}
                                                    style={{
                                                        justifySelf: mine ? 'end' : 'start',
                                                        maxWidth: '78%',
                                                        padding: '0.8rem 0.9rem',
                                                        borderRadius: '0.75rem',
                                                        background: mine ? '#2563eb' : '#f1f5f9',
                                                        color: mine ? 'white' : '#0f172a',
                                                        fontWeight: 700,
                                                        lineHeight: 1.5,
                                                    }}
                                                >
                                                    {message.body}
                                                </div>
                                            )
                                        })
                                    ) : (
                                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>아직 상담 메시지가 없습니다.</p>
                                    )}
                                </div>
                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                    <label
                                        htmlFor="consultation-message-input"
                                        style={{ fontWeight: 800, color: '#0f172a' }}
                                    >
                                        메시지
                                    </label>
                                    <textarea
                                        id="consultation-message-input"
                                        aria-label="상담 메시지 입력"
                                        value={consultationMessageBody}
                                        onChange={(event) => setConsultationMessageBody(event.target.value)}
                                        rows={3}
                                        placeholder="상담 메시지를 입력하세요."
                                        style={{
                                            width: '100%',
                                            padding: '0.85rem 1rem',
                                            borderRadius: '0.75rem',
                                            border: '1px solid var(--border-color)',
                                            resize: 'vertical',
                                            font: 'inherit',
                                            lineHeight: 1.5,
                                        }}
                                    />
                                    {consultationMessageError && (
                                        <p role="alert" style={{ margin: 0, color: '#e11d48', fontWeight: 700 }}>
                                            {consultationMessageError}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <button
                                            type="button"
                                            className="btn-primary"
                                            disabled={consultationMessageSubmitting || !consultationMessageBody.trim()}
                                            onClick={handleSendConsultationMessage}
                                            style={{ padding: '0.75rem 1rem' }}
                                        >
                                            {consultationMessageSubmitting ? '전송 중' : '메시지 보내기'}
                                        </button>
                                        {selectedPanelConsultation.expertId === user?.id && (
                                            <button
                                                type="button"
                                                className="btn-text"
                                                disabled={consultationProposalSubmitting}
                                                onClick={handleCreateConsultationProposal}
                                            >
                                                {consultationProposalSubmitting ? '제안서 작성 중' : '제안서 작성'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>상담을 선택해주세요.</p>
                        )}
                    </div>
                </div>
            ) : (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>아직 상담 채팅이 없습니다.</p>
            )}
        </section>
    )

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
            return <Profile />
        }

        if (activePanel === 'client') {
            if (mode === 'work') {
                return (
                    <section style={cardStyle}>
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
                <section style={cardStyle}>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 1rem' }}>작업방</h2>
                    {renderWorkCards(roleFilteredActiveWorks, '진행 중인 작업이 없습니다.')}
                </section>
            )
        }

        return (
            <section style={cardStyle}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 1rem' }}>완료 / 리뷰</h2>
                {renderWorkCards(roleFilteredCompletedWorks, '완료된 작업이 없습니다.')}
            </section>
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

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 60px)', padding: '4rem 0' }}>
            <main className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>{pageTitle}</h1>
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                            {pageDescription}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
                    <aside style={{ ...cardStyle, padding: '1.25rem', position: 'sticky', top: '1rem' }}>
                        {mode === 'work' ? (
                            <div style={{ marginBottom: '1.25rem' }}>
                                {renderWorkRoleSwitch()}
                            </div>
                        ) : (
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

                        <nav aria-label={menuLabel} style={{ display: 'grid', gap: '0.45rem' }}>
                            {menuItems.map((item) => {
                                const selected = activePanel === item.id
                                return (
                                    <button
                                        key={item.id}
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
                                        {item.label}
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
                    </aside>

                    <div>
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
                                        const newReview: Review = {
                                            id: `review-${Date.now()}`,
                                            workId: reviewWork.id,
                                            clientId: reviewWork.clientId || user?.id || '',
                                            expertId: reviewWork.expertId,
                                            rating: Number(reviewRating) as 1 | 2 | 3 | 4 | 5,
                                            content: reviewContent,
                                            createdAt: new Date().toISOString(),
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
