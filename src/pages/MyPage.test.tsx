import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyPage from './MyPage'
import type { Consultation, ConsultationMessage, Proposal, Review, ServiceRequestData } from '../types'

vi.mock('./Profile', () => ({
    default: () => (
        <section aria-label="마이 프로필 편집">
            <h2>마이 프로필</h2>
            <button type="button">프로필 저장하기</button>
        </section>
    ),
}))

function LocationProbe() {
    const location = useLocation()
    return <span data-testid="location">{location.search}</span>
}

function LocationStateProbe() {
    const location = useLocation()
    return <span data-testid="location-state">{JSON.stringify(location.state)}</span>
}

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        session: { user: { id: 'user-demo-01', email: 'demo@example.com' } },
        user: { id: 'user-demo-01', email: 'demo@example.com' },
        loading: false,
        signOut: vi.fn(),
    }),
}))

vi.mock('../lib/supabase', () => ({
    supabase: null,
}))

const saveReview = vi.fn(async (_review: Review) => undefined)
const saveProposal = vi.fn(async (_proposal: Proposal) => 'proposal-product-directed-created')
const getUserReviews = vi.fn(async (_userId: string): Promise<Review[]> => [])
const getUserServiceRequests = vi.fn(async (_userId: string): Promise<ServiceRequestData[]> => [
    {
        id: 'request-product-directed-01',
        title: 'Owned AI product',
        description: '상품 지정 의뢰 상세',
        budget: '30000',
        deadline: '2026-06-01',
        categories: ['AI 영상/숏폼'],
        createdAt: '2026. 6. 1.',
        clientId: 'client-real-01',
        expertId: 'user-demo-01',
        productId: 'product-owned-01',
        selectedPackage: 'standard',
        desiredResult: '상품 지정 요구사항',
        purpose: 'SNS 홍보',
        referenceText: '',
        referenceLinks: [],
        progressType: 'single',
        status: 'pending',
    },
])
const getExpertProducts = vi.fn(async () => [
    {
        id: 'product-owned-01',
        expertId: 'user-demo-01',
        expertName: 'Demo expert',
        title: 'Owned AI product',
        category: 'ai-video-shortform',
        summary: 'Owned summary',
        description: 'Owned description',
        aiTools: ['Runway'],
        sampleLinks: [],
        sampleImageUrl: '',
        startingPrice: 30000,
        deliveryDays: 2,
        revisionCount: 1,
        packages: {
            standard: {
                name: 'Standard',
                price: 30000,
                deliveryDays: 2,
                revisionCount: 1,
                included: ['Draft'],
            },
            deluxe: null,
            premium: null,
        },
        status: 'published',
    },
    {
        id: 'product-client-01',
        expertId: 'expert-real-01',
        expertName: 'Client order expert',
        title: 'AI 숏폼 영상 제작',
        category: 'ai-video-shortform',
        summary: 'Client order summary',
        description: 'Client order description',
        aiTools: ['Runway'],
        sampleLinks: [],
        sampleImageUrl: '',
        startingPrice: 30000,
        deliveryDays: 2,
        revisionCount: 1,
        packages: {
            standard: {
                name: 'Standard',
                price: 30000,
                deliveryDays: 2,
                revisionCount: 1,
                included: ['Draft'],
            },
            deluxe: null,
            premium: null,
        },
        status: 'published',
    },
    {
        id: 'product-client-before',
        expertId: 'expert-real-before',
        expertName: 'Before expert',
        title: '작업 전 테스트 상품',
        category: 'ai-video-shortform',
        summary: 'Before summary',
        description: 'Before description',
        aiTools: ['Runway'],
        sampleLinks: [],
        sampleImageUrl: '',
        startingPrice: 40000,
        deliveryDays: 3,
        revisionCount: 1,
        packages: {
            standard: {
                name: 'Standard',
                price: 40000,
                deliveryDays: 3,
                revisionCount: 1,
                included: ['Draft'],
            },
            deluxe: null,
            premium: null,
        },
        status: 'published',
    },
    {
        id: 'product-client-completed',
        expertId: 'expert-real-completed',
        expertName: 'Completed expert',
        title: '작업 완료 테스트 상품',
        category: 'ai-video-shortform',
        summary: 'Completed summary',
        description: 'Completed description',
        aiTools: ['Runway'],
        sampleLinks: [],
        sampleImageUrl: '',
        startingPrice: 60000,
        deliveryDays: 4,
        revisionCount: 1,
        packages: {
            standard: {
                name: 'Standard',
                price: 60000,
                deliveryDays: 4,
                revisionCount: 1,
                included: ['Final'],
            },
            deluxe: null,
            premium: null,
        },
        status: 'published',
    },
    {
        id: 'product-client-submitted',
        expertId: 'expert-real-submitted',
        expertName: 'Submitted expert',
        title: '결과물 검토 테스트 상품',
        category: 'ai-video-shortform',
        summary: 'Submitted summary',
        description: 'Submitted description',
        aiTools: ['Runway'],
        sampleLinks: [],
        sampleImageUrl: '',
        startingPrice: 50000,
        deliveryDays: 3,
        revisionCount: 1,
        packages: {
            standard: {
                name: 'Standard',
                price: 50000,
                deliveryDays: 3,
                revisionCount: 1,
                included: ['Review'],
            },
            deluxe: null,
            premium: null,
        },
        status: 'published',
    },
    {
        id: 'product-client-revision',
        expertId: 'expert-real-revision',
        expertName: 'Revision expert',
        title: '수정 요청 테스트 상품',
        category: 'ai-video-shortform',
        summary: 'Revision summary',
        description: 'Revision description',
        aiTools: ['Runway'],
        sampleLinks: [],
        sampleImageUrl: '',
        startingPrice: 55000,
        deliveryDays: 3,
        revisionCount: 2,
        packages: {
            standard: {
                name: 'Standard',
                price: 55000,
                deliveryDays: 3,
                revisionCount: 2,
                included: ['Revision'],
            },
            deluxe: null,
            premium: null,
        },
        status: 'published',
    },
    {
        id: 'product-other-01',
        expertId: 'other-user',
        expertName: 'Other expert',
        title: 'Other AI product',
        category: 'ai-image-character',
        summary: 'Other summary',
        description: 'Other description',
        aiTools: ['Midjourney'],
        sampleLinks: [],
        sampleImageUrl: '',
        startingPrice: 50000,
        deliveryDays: 3,
        revisionCount: 1,
        packages: {
            standard: {
                name: 'Standard',
                price: 50000,
                deliveryDays: 3,
                revisionCount: 1,
                included: ['Draft'],
            },
            deluxe: null,
            premium: null,
        },
        status: 'published',
    },
])
const getUserProposals = vi.fn(async (_userId: string) => [
    {
        id: 'proposal-real-client',
        requestId: 'request-product-client-01',
        clientId: 'user-demo-01',
        expertId: 'expert-real-01',
        title: '받은 실제 제안서',
        scope: '테스트 범위',
        deliverables: ['테스트 결과물'],
        totalPrice: 30000,
        deliveryDays: 2,
        revisionCount: 1,
        progressType: 'single',
        milestones: [],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'sent',
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
    {
        id: 'proposal-real-expert',
        requestId: 'request-expert',
        clientId: 'client-real-01',
        expertId: 'user-demo-01',
        title: '보낸 실제 제안서',
        scope: '테스트 범위',
        deliverables: ['테스트 결과물'],
        totalPrice: 50000,
        deliveryDays: 3,
        revisionCount: 1,
        progressType: 'single',
        milestones: [],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'sent',
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
    {
        id: 'proposal-real-client-expired',
        requestId: 'request-client-expired',
        clientId: 'user-demo-01',
        expertId: 'expert-real-02',
        title: 'Expired client proposal',
        scope: 'Expired scope',
        deliverables: ['Expired deliverable'],
        totalPrice: 90000,
        deliveryDays: 5,
        revisionCount: 1,
        progressType: 'single',
        milestones: [],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'expired',
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
    {
        id: 'proposal-real-expert-second',
        requestId: 'request-expert-second',
        clientId: 'client-real-02',
        expertId: 'user-demo-01',
        title: 'Second sent proposal',
        scope: 'Second scope',
        deliverables: ['Second deliverable'],
        totalPrice: 120000,
        deliveryDays: 7,
        revisionCount: 2,
        progressType: 'milestone',
        milestones: ['Step 1'],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'revision_requested',
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
])
const getUserWorks = vi.fn(async (_userId: string) => [
    {
        id: 'work-real-active',
        proposalId: 'proposal-active',
        requestId: 'request-product-client-01',
        clientId: 'user-demo-01',
        expertId: 'expert-real-01',
        title: '진행 중인 실제 작업',
        progressType: 'single',
        status: 'in_progress',
        stepIds: [],
    },
    {
        id: 'work-real-completed',
        proposalId: 'proposal-completed',
        requestId: 'request-completed',
        clientId: 'user-demo-01',
        expertId: 'expert-real-02',
        title: '완료된 실제 작업',
        progressType: 'single',
        status: 'completed',
        totalPrice: 70000,
        platformFee: 8400,
        expertPayout: 61600,
        settlementStatus: 'pending',
        stepIds: [],
    },
    {
        id: 'work-real-submitted',
        proposalId: 'proposal-submitted',
        requestId: 'request-submitted',
        clientId: 'user-demo-01',
        expertId: 'expert-real-03',
        title: 'Submitted work',
        progressType: 'milestone',
        status: 'submitted',
        stepIds: [],
    },
    {
        id: 'work-real-completed-second',
        proposalId: 'proposal-completed-second',
        requestId: 'request-completed-second',
        clientId: 'user-demo-01',
        expertId: 'expert-real-04',
        title: 'Second completed work',
        progressType: 'single',
        status: 'completed',
        stepIds: [],
    },
])
const getUserConsultations = vi.fn(async (_userId: string): Promise<Consultation[]> => [
    {
        id: 'consult-client-01',
        clientId: 'user-demo-01',
        expertId: 'expert-real-01',
        productId: 'product-client-01',
        status: 'open',
        title: 'AI 숏폼 영상 제작 상담',
        lastMessageAt: '2026-06-02T10:00:00.000Z',
        createdAt: '2026-06-02T09:30:00.000Z',
    },
    {
        id: 'consult-expert-01',
        clientId: 'client-real-01',
        expertId: 'user-demo-01',
        productId: 'product-owned-01',
        status: 'proposal_sent',
        title: 'Owned AI product 상담',
        lastMessageAt: '2026-06-01T11:00:00.000Z',
        createdAt: '2026-06-01T10:30:00.000Z',
    },
])
const getConsultationMessages = vi.fn(async (consultationId: string): Promise<ConsultationMessage[]> => [
    {
        id: `${consultationId}-message-01`,
        consultationId,
        senderId: consultationId === 'consult-client-01' ? 'user-demo-01' : 'client-real-01',
        body: consultationId === 'consult-client-01' ? '브랜드 소개용 숏폼 상담 가능할까요?' : '작업 범위를 먼저 확인하고 싶습니다.',
        attachmentUrls: [],
        createdAt: '2026-06-02T10:00:00.000Z',
    },
])
const saveConsultationMessage = vi.fn(async (message: { consultationId: string; senderId: string; body: string }): Promise<ConsultationMessage> => ({
    id: 'message-saved-01',
    consultationId: message.consultationId,
    senderId: message.senderId,
    body: message.body,
    attachmentUrls: [],
    createdAt: '2026-06-02T10:05:00.000Z',
}))

const defaultProposals = () => [
    {
        id: 'proposal-real-client',
        requestId: 'request-product-client-01',
        clientId: 'user-demo-01',
        expertId: 'expert-real-01',
        title: '받은 실제 제안서',
        scope: '테스트 범위',
        deliverables: ['테스트 결과물'],
        totalPrice: 30000,
        deliveryDays: 2,
        revisionCount: 1,
        progressType: 'single' as const,
        milestones: [],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'sent' as const,
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
    {
        id: 'proposal-real-expert',
        requestId: 'request-expert',
        clientId: 'client-real-01',
        expertId: 'user-demo-01',
        title: '보낸 실제 제안서',
        scope: '테스트 범위',
        deliverables: ['테스트 결과물'],
        totalPrice: 50000,
        deliveryDays: 3,
        revisionCount: 1,
        progressType: 'single' as const,
        milestones: [],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'sent' as const,
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
    {
        id: 'proposal-real-client-expired',
        requestId: 'request-client-expired',
        clientId: 'user-demo-01',
        expertId: 'expert-real-02',
        title: 'Expired client proposal',
        scope: 'Expired scope',
        deliverables: ['Expired deliverable'],
        totalPrice: 90000,
        deliveryDays: 5,
        revisionCount: 1,
        progressType: 'single' as const,
        milestones: [],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'expired' as const,
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
    {
        id: 'proposal-real-expert-second',
        requestId: 'request-expert-second',
        clientId: 'client-real-02',
        expertId: 'user-demo-01',
        title: 'Second sent proposal',
        scope: 'Second scope',
        deliverables: ['Second deliverable'],
        totalPrice: 120000,
        deliveryDays: 7,
        revisionCount: 2,
        progressType: 'milestone' as const,
        milestones: ['Step 1'],
        commercialUseAllowed: true,
        sourceFileIncluded: false,
        status: 'revision_requested' as const,
        expiresAt: '2026-06-01T00:00:00.000Z',
    },
]

const defaultWorks = () => [
    {
        id: 'work-real-active',
        proposalId: 'proposal-active',
        requestId: 'request-product-client-01',
        clientId: 'user-demo-01',
        expertId: 'expert-real-01',
        title: '진행 중인 실제 작업',
        progressType: 'single' as const,
        status: 'in_progress' as const,
        stepIds: [],
    },
    {
        id: 'work-real-completed',
        proposalId: 'proposal-completed',
        requestId: 'request-completed',
        clientId: 'user-demo-01',
        expertId: 'expert-real-02',
        title: '완료된 실제 작업',
        progressType: 'single' as const,
        status: 'completed' as const,
        totalPrice: 70000,
        platformFee: 8400,
        expertPayout: 61600,
        settlementStatus: 'pending' as const,
        stepIds: [],
    },
    {
        id: 'work-real-submitted',
        proposalId: 'proposal-submitted',
        requestId: 'request-submitted',
        clientId: 'user-demo-01',
        expertId: 'expert-real-03',
        title: 'Submitted work',
        progressType: 'milestone' as const,
        status: 'submitted' as const,
        stepIds: [],
    },
    {
        id: 'work-real-completed-second',
        proposalId: 'proposal-completed-second',
        requestId: 'request-completed-second',
        clientId: 'user-demo-01',
        expertId: 'expert-real-04',
        title: 'Second completed work',
        progressType: 'single' as const,
        status: 'completed' as const,
        stepIds: [],
    },
    {
        id: 'work-client-submitted-order',
        proposalId: 'proposal-client-submitted-order',
        requestId: 'request-product-client-submitted',
        clientId: 'user-demo-01',
        expertId: 'expert-real-submitted',
        title: '결과물 검토 테스트 상품',
        progressType: 'single' as const,
        status: 'submitted' as const,
        stepIds: [],
    },
    {
        id: 'work-client-revision-order',
        proposalId: 'proposal-client-revision-order',
        requestId: 'request-product-client-revision',
        clientId: 'user-demo-01',
        expertId: 'expert-real-revision',
        title: '수정 요청 테스트 상품',
        progressType: 'single' as const,
        status: 'revision_requested' as const,
        stepIds: [],
    },
    {
        id: 'work-client-completed-order',
        proposalId: 'proposal-client-completed-order',
        requestId: 'request-product-client-completed',
        clientId: 'user-demo-01',
        expertId: 'expert-real-completed',
        title: '작업 완료 테스트 상품',
        progressType: 'single' as const,
        status: 'completed' as const,
        stepIds: [],
    },
    {
        id: 'work-expert-active-order',
        proposalId: 'proposal-expert-active-order',
        requestId: 'request-product-directed-active',
        clientId: 'client-real-active',
        expertId: 'user-demo-01',
        title: '전문가 진행 중 상품',
        progressType: 'single' as const,
        status: 'in_progress' as const,
        stepIds: [],
    },
    {
        id: 'work-expert-submitted-order',
        proposalId: 'proposal-expert-submitted-order',
        requestId: 'request-product-directed-submitted',
        clientId: 'client-real-submitted',
        expertId: 'user-demo-01',
        title: '전문가 제출 완료 상품',
        progressType: 'single' as const,
        status: 'submitted' as const,
        stepIds: [],
    },
    {
        id: 'work-expert-revision-order',
        proposalId: 'proposal-expert-revision-order',
        requestId: 'request-product-directed-revision',
        clientId: 'client-real-revision',
        expertId: 'user-demo-01',
        title: '전문가 수정 요청 상품',
        progressType: 'single' as const,
        status: 'revision_requested' as const,
        stepIds: [],
    },
    {
        id: 'work-expert-completed-order',
        proposalId: 'proposal-expert-completed-order',
        requestId: 'request-product-directed-completed',
        clientId: 'client-real-completed',
        expertId: 'user-demo-01',
        title: '전문가 완료 상품',
        progressType: 'single' as const,
        status: 'completed' as const,
        stepIds: [],
    },
]

vi.mock('../lib/storage', () => ({
    getExpertProducts: () => getExpertProducts(),
    getUserProposals: (userId: string) => getUserProposals(userId),
    getUserReviews: (userId: string) => getUserReviews(userId),
    getUserServiceRequests: (userId: string) => getUserServiceRequests(userId),
    getUserWorks: (userId: string) => getUserWorks(userId),
    getUserConsultations: (userId: string) => getUserConsultations(userId),
    getConsultationMessages: (consultationId: string) => getConsultationMessages(consultationId),
    saveConsultationMessage: (message: { consultationId: string; senderId: string; body: string }) => saveConsultationMessage(message),
    saveProposal: (proposal: Proposal) => saveProposal(proposal),
    saveReview: (review: Review) => saveReview(review),
}))

describe('MyPage', () => {
    beforeEach(() => {
        saveReview.mockClear()
        saveProposal.mockClear()
        getExpertProducts.mockClear()
        getUserProposals.mockReset()
        getUserProposals.mockResolvedValue(defaultProposals())
        getUserReviews.mockReset()
        getUserReviews.mockResolvedValue([])
        getUserServiceRequests.mockReset()
        getUserServiceRequests.mockResolvedValue([
            {
                id: 'request-product-client-01',
                title: 'AI 숏폼 상품 주문',
                description: '의뢰자가 주문한 상품 상세',
                budget: '30000',
                deadline: '2026-06-01',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'user-demo-01',
                expertId: 'expert-real-01',
                productId: 'product-client-01',
                selectedPackage: 'standard',
                desiredResult: '제품 홍보 숏폼',
                purpose: '신제품 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'in_progress',
            },
            {
                id: 'request-product-client-before',
                title: '작업 전 상품 주문',
                description: '아직 작업방이 없는 주문',
                budget: '40000',
                deadline: '2026-06-05',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'user-demo-01',
                expertId: 'expert-real-before',
                productId: 'product-client-before',
                selectedPackage: 'standard',
                desiredResult: '작업 전 요구사항',
                purpose: '런칭 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'pending',
            },
            {
                id: 'request-product-client-completed',
                title: '작업 완료 상품 주문',
                description: '작업이 끝난 주문',
                budget: '60000',
                deadline: '2026-06-10',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'user-demo-01',
                expertId: 'expert-real-completed',
                productId: 'product-client-completed',
                selectedPackage: 'standard',
                desiredResult: '작업 완료 요구사항',
                purpose: '성과 보고',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'completed',
            },
            {
                id: 'request-product-client-submitted',
                title: '결과물 검토 상품 주문',
                description: '전문가가 결과물을 제출한 주문',
                budget: '50000',
                deadline: '2026-06-07',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'user-demo-01',
                expertId: 'expert-real-submitted',
                productId: 'product-client-submitted',
                selectedPackage: 'standard',
                desiredResult: '결과물 검토 요구사항',
                purpose: '성과 검토',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'in_progress',
            },
            {
                id: 'request-product-client-revision',
                title: '수정 요청 상품 주문',
                description: '의뢰자가 수정 요청을 보낸 주문',
                budget: '55000',
                deadline: '2026-06-08',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'user-demo-01',
                expertId: 'expert-real-revision',
                productId: 'product-client-revision',
                selectedPackage: 'standard',
                desiredResult: '수정 요청 요구사항',
                purpose: '수정 확인',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'in_progress',
            },
            {
                id: 'request-product-directed-01',
                title: 'Owned AI product',
                description: '상품 지정 의뢰 상세',
                budget: '30000',
                deadline: '2026-06-01',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'client-real-01',
                expertId: 'user-demo-01',
                productId: 'product-owned-01',
                selectedPackage: 'standard',
                desiredResult: '상품 지정 요구사항',
                purpose: 'SNS 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'pending',
            },
            {
                id: 'request-product-directed-active',
                title: '전문가 진행 중 상품 의뢰',
                description: '전문가가 진행 중인 상품 지정 의뢰',
                budget: '50000',
                deadline: '2026-06-08',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'client-real-active',
                expertId: 'user-demo-01',
                productId: 'product-owned-01',
                selectedPackage: 'standard',
                desiredResult: '전문가 진행 중 요구사항',
                purpose: 'SNS 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'in_progress',
            },
            {
                id: 'request-product-directed-completed',
                title: '전문가 완료 상품 의뢰',
                description: '전문가가 완료한 상품 지정 의뢰',
                budget: '70000',
                deadline: '2026-06-09',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'client-real-completed',
                expertId: 'user-demo-01',
                productId: 'product-owned-01',
                selectedPackage: 'standard',
                desiredResult: '전문가 완료 요구사항',
                purpose: 'SNS 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'completed',
            },
            {
                id: 'request-product-directed-submitted',
                title: '전문가 제출 완료 상품 의뢰',
                description: '전문가가 결과물을 제출하고 승인 대기 중인 의뢰',
                budget: '65000',
                deadline: '2026-06-11',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'client-real-submitted',
                expertId: 'user-demo-01',
                productId: 'product-owned-01',
                selectedPackage: 'standard',
                desiredResult: '전문가 제출 완료 요구사항',
                purpose: 'SNS 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'in_progress',
            },
            {
                id: 'request-product-directed-revision',
                title: '전문가 수정 요청 상품 의뢰',
                description: '의뢰자가 수정 요청을 보낸 상품 지정 의뢰',
                budget: '68000',
                deadline: '2026-06-12',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 6. 1.',
                clientId: 'client-real-revision',
                expertId: 'user-demo-01',
                productId: 'product-owned-01',
                selectedPackage: 'standard',
                desiredResult: '전문가 수정 요청 요구사항',
                purpose: 'SNS 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'in_progress',
            },
        ])
        getUserWorks.mockReset()
        getUserWorks.mockResolvedValue(defaultWorks())
        getUserConsultations.mockReset()
        getUserConsultations.mockResolvedValue([
            {
                id: 'consult-client-01',
                clientId: 'user-demo-01',
                expertId: 'expert-real-01',
                productId: 'product-client-01',
                status: 'open',
                title: 'AI 숏폼 영상 제작 상담',
                lastMessageAt: '2026-06-02T10:00:00.000Z',
                createdAt: '2026-06-02T09:30:00.000Z',
            },
            {
                id: 'consult-expert-01',
                clientId: 'client-real-01',
                expertId: 'user-demo-01',
                productId: 'product-owned-01',
                status: 'proposal_sent',
                title: 'Owned AI product 상담',
                lastMessageAt: '2026-06-01T11:00:00.000Z',
                createdAt: '2026-06-01T10:30:00.000Z',
            },
        ])
        getConsultationMessages.mockReset()
        getConsultationMessages.mockImplementation(async (consultationId: string) => [
            {
                id: `${consultationId}-message-01`,
                consultationId,
                senderId: consultationId === 'consult-client-01' ? 'user-demo-01' : 'client-real-01',
                body: consultationId === 'consult-client-01' ? '브랜드 소개용 숏폼 상담 가능할까요?' : '작업 범위를 먼저 확인하고 싶습니다.',
                attachmentUrls: [],
                createdAt: '2026-06-02T10:00:00.000Z',
            },
        ])
        saveConsultationMessage.mockClear()
        saveConsultationMessage.mockImplementation(async (message: { consultationId: string; senderId: string; body: string }) => ({
            id: 'message-saved-01',
            consultationId: message.consultationId,
            senderId: message.senderId,
            body: message.body,
            attachmentUrls: [],
            createdAt: '2026-06-02T10:05:00.000Z',
        }))
    })

    it('opens profile management from the left menu instead of the top edit button', async () => {
        render(
            <MemoryRouter>
                <MyPage mode="profile" />
                <LocationProbe />
            </MemoryRouter>,
        )

        expect(screen.queryByRole('link', { name: '프로필 수정하기' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: '마이 프로필' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '의뢰자 홈' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '전문가 홈' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '작업방' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '완료 / 리뷰' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '마이 프로필' }))

        expect(await screen.findByLabelText('마이 프로필 편집')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '프로필 저장하기' })).toBeInTheDocument()
        await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('panel=profile'))
    })

    it('shows work management panels in the separated work page mode', async () => {
        render(
            <MemoryRouter>
                <MyPage mode="work" />
            </MemoryRouter>,
        )

        expect(screen.getByRole('heading', { name: '내 작업' })).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: '내 작업 메뉴' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '의뢰자 홈' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '전문가 홈' })).not.toBeInTheDocument()
        expect(screen.queryByText('닉네임')).not.toBeInTheDocument()
        expect(screen.queryByText('접속 계정')).not.toBeInTheDocument()
        expect(screen.queryByText('demo@example.com')).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: '작업 관리' })).not.toBeInTheDocument()
        expect(screen.queryByText('내가 의뢰한 일과 전문가로 받은 일을 역할을 전환하며 확인합니다.')).not.toBeInTheDocument()

        const roleSwitch = screen.getByLabelText('내 작업 역할 전환')
        expect(within(roleSwitch).getByRole('button', { name: '의뢰자로 보기' })).toHaveAttribute('aria-pressed', 'true')
        expect(within(roleSwitch).getByRole('button', { name: '전문가로 보기' })).toHaveAttribute('aria-pressed', 'false')
        expect(screen.getByRole('button', { name: '작업방' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '상담 채팅' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '완료 / 리뷰' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '개요' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: '마이 프로필' })).not.toBeInTheDocument()

        fireEvent.click(within(roleSwitch).getByRole('button', { name: '전문가로 보기' }))

        expect(within(roleSwitch).getByRole('button', { name: '전문가로 보기' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText('받은 일 관리')).toBeInTheDocument()
    })

    it('opens the consultation chat panel with a selected consultation from the query string', async () => {
        render(
            <MemoryRouter initialEntries={['/my-work?panel=consultations&consultation=consult-client-01']}>
                <Routes>
                    <Route path="/my-work" element={<MyPage mode="work" />} />
                </Routes>
                <LocationProbe />
            </MemoryRouter>,
        )

        expect(await screen.findByRole('button', { name: '상담 채팅' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('heading', { name: '상담 채팅' })).toBeInTheDocument()
        expect(screen.getByLabelText('상담 채팅 목록')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /AI 숏폼 영상 제작 상담/ })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('heading', { name: 'AI 숏폼 영상 제작 상담' })).toBeInTheDocument()
        expect(await screen.findByText('브랜드 소개용 숏폼 상담 가능할까요?')).toBeInTheDocument()
        expect(getConsultationMessages).toHaveBeenCalledWith('consult-client-01')
        expect(screen.getByTestId('location').textContent).toContain('panel=consultations')
        expect(screen.getByTestId('location').textContent).toContain('consultation=consult-client-01')
    })

    it('sends a consultation message from the selected chat panel', async () => {
        render(
            <MemoryRouter initialEntries={['/my-work?panel=consultations&consultation=consult-client-01']}>
                <Routes>
                    <Route path="/my-work" element={<MyPage mode="work" />} />
                </Routes>
            </MemoryRouter>,
        )

        const input = await screen.findByLabelText('상담 메시지 입력')
        fireEvent.change(input, { target: { value: '추가 문의드립니다.' } })
        fireEvent.click(screen.getByRole('button', { name: '메시지 보내기' }))

        await waitFor(() => expect(saveConsultationMessage).toHaveBeenCalledWith({
            consultationId: 'consult-client-01',
            senderId: 'user-demo-01',
            body: '추가 문의드립니다.',
        }))
        expect(await screen.findByText('추가 문의드립니다.')).toBeInTheDocument()
        expect(input).toHaveValue('')
    })

    it('switches between consultation chats and workrooms without restoring a stale panel from the URL', async () => {
        render(
            <MemoryRouter initialEntries={['/my-work?panel=consultations&consultation=consult-client-01']}>
                <Routes>
                    <Route path="/my-work" element={<MyPage mode="work" />} />
                </Routes>
                <LocationProbe />
            </MemoryRouter>,
        )

        expect(await screen.findByRole('button', { name: '상담 채팅' })).toHaveAttribute('aria-pressed', 'true')

        fireEvent.click(screen.getByRole('button', { name: '작업방' }))
        await waitFor(() => expect(screen.getByRole('button', { name: '작업방' })).toHaveAttribute('aria-pressed', 'true'))
        expect(screen.getByTestId('location').textContent).toBe('?panel=workroom')

        fireEvent.click(screen.getByRole('button', { name: '상담 채팅' }))
        await waitFor(() => expect(screen.getByRole('button', { name: '상담 채팅' })).toHaveAttribute('aria-pressed', 'true'))
        expect(screen.getByTestId('location').textContent).toContain('panel=consultations')
    })

    it('removes stale order parameters when opening a consultation chat from a work process', async () => {
        render(
            <MemoryRouter initialEntries={['/my-work?panel=consultations&clientOrder=request-product-client-01&consultation=consult-client-01']}>
                <Routes>
                    <Route path="/my-work" element={<MyPage mode="work" />} />
                </Routes>
                <LocationProbe />
            </MemoryRouter>,
        )

        await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('?panel=consultations&consultation=consult-client-01'))
    })

    it('shows expert inquiry orders in work management and links their chat stage to the selected consultation', async () => {
        render(
            <MemoryRouter initialEntries={['/my-work']}>
                <Routes>
                    <Route path="/my-work" element={<MyPage mode="work" />} />
                </Routes>
                <LocationProbe />
            </MemoryRouter>,
        )

        expect(await screen.findByText('전문가 문의')).toBeInTheDocument()
        expect(screen.getByText(/상담 중/)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('link', { name: '상담 채팅 보기' }))

        await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('panel=consultations'))
        expect(screen.getByTestId('location').textContent).toContain('consultation=consult-client-01')
    })

    it('shows client product orders and expert inquiries in one newest-first list with one selected flow', async () => {
        render(
            <MemoryRouter initialEntries={['/mypage?panel=client']}>
                <MyPage />
            </MemoryRouter>,
        )

        const list = await screen.findByTestId('client-unified-work-list')
        const items = within(list).getAllByRole('button')

        expect(items[0]).toHaveAttribute('data-work-item-kind', 'consultation')
        expect(items[0]).toHaveAttribute('data-work-item-id', 'consult-client-01')
        expect(items[1]).toHaveAttribute('data-work-item-kind', 'product')
        expect(items[1]).toHaveAttribute('data-work-item-id', 'request-product-client-01')

        fireEvent.click(items[1])

        expect(screen.getByTestId('client-product-order-flow')).toBeInTheDocument()
        expect(screen.queryByTestId('client-consultation-order-flow')).not.toBeInTheDocument()
    })

    it('opens consultation chat from the selected work process without being restored to work management', async () => {
        render(
            <MemoryRouter initialEntries={['/my-work']}>
                <Routes>
                    <Route path="/my-work" element={<MyPage mode="work" />} />
                </Routes>
                <LocationProbe />
            </MemoryRouter>,
        )

        const list = await screen.findByTestId('client-unified-work-list')
        const consultationItem = within(list).getByRole('button', { pressed: true })
        expect(consultationItem).toHaveAttribute('data-work-item-kind', 'consultation')

        const chatLink = screen.getAllByRole('link').find((link) =>
            link.getAttribute('href')?.includes('panel=consultations&consultation=consult-client-01'),
        )
        expect(chatLink).toBeTruthy()

        fireEvent.click(chatLink!)

        await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('?panel=consultations&consultation=consult-client-01'))
        expect(await screen.findByRole('button', { name: '상담 채팅' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('shows received expert inquiry chats in expert work management', async () => {
        render(
            <MemoryRouter initialEntries={['/my-work']}>
                <Routes>
                    <Route path="/my-work" element={<MyPage mode="work" />} />
                </Routes>
            </MemoryRouter>,
        )

        const roleSwitch = screen.getByLabelText('내 작업 역할 전환')
        fireEvent.click(within(roleSwitch).getByRole('button', { name: '전문가로 보기' }))

        expect(await screen.findByText('전문가 문의 - Owned AI product')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '상담 채팅 보기' })).toHaveAttribute(
            'href',
            '/my-work?panel=consultations&consultation=consult-expert-01',
        )
    })

    it('lets experts create a proposal from the selected consultation chat', async () => {
        render(
            <MemoryRouter initialEntries={['/my-work?panel=consultations&consultation=consult-expert-01']}>
                <Routes>
                    <Route path="/my-work" element={<MyPage mode="work" />} />
                    <Route path="/proposal/:proposalId" element={<LocationStateProbe />} />
                </Routes>
                <LocationProbe />
            </MemoryRouter>,
        )

        expect(await screen.findByRole('heading', { name: 'Owned AI product 상담' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: '제안서 작성' }))

        await waitFor(() => {
            expect(saveProposal).toHaveBeenCalledWith(expect.objectContaining({
                requestId: 'consultation-consult-expert-01',
                clientId: 'client-real-01',
                expertId: 'user-demo-01',
                title: 'Owned AI product 상담 제안서',
            }))
        })
        expect(await screen.findByTestId('location-state')).toHaveTextContent('/my-work')
    })

    it('shows client and expert work sections with current labels', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        expect(screen.getByText('마이페이지')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '의뢰자 홈' }))
        expect(screen.getByText('상품 주문 관리')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '요청 게시판 보기' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))
        expect(screen.getByText('받은 일 관리')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '내가 등록한 상품' })).toHaveAttribute('href', '/profile')
    })

    it('shows client and expert sections with transaction links', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        expect(screen.getByRole('heading', { name: '마이페이지' })).toBeInTheDocument()
        expect(screen.getByRole('navigation', { name: '마이페이지 메뉴' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '개요' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('heading', { name: '전체 현황' })).toBeInTheDocument()
        expect(screen.getByText('의뢰자 영역은 내가 맡긴 일을 관리하는 곳입니다.')).toBeInTheDocument()
        expect(screen.getByText('전문가 영역은 내가 받거나 제안한 일을 관리하는 곳입니다.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '의뢰자 홈' }))
        expect(screen.getByText('내가 맡긴 일')).toBeInTheDocument()
        expect(screen.getByText('상품을 주문한 경우 상품 단위로 들어가 진행 단계를 확인합니다.')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '상품 주문 관리' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'AI 작업 찾기' })).toHaveAttribute('href', '/category')
        expect(screen.queryByRole('link', { name: '요청 게시판 보기' })).not.toBeInTheDocument()
        const clientList = await screen.findByTestId('client-unified-work-list')
        const clientProductOrder = within(clientList)
            .getAllByRole('button')
            .find((button) => button.getAttribute('data-work-item-id') === 'request-product-client-01')
        expect(clientProductOrder).toBeDefined()
        fireEvent.click(clientProductOrder!)
        expect(await screen.findByRole('link', { name: '제안서 보기' })).toHaveAttribute(
            'href',
            '/proposal/proposal-real-client',
        )
        expect(await screen.findByRole('link', { name: '작업방 열기' })).toHaveAttribute(
            'href',
            '/workroom/work-real-active',
        )

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))
        expect(screen.getByText('내가 수행할 일')).toBeInTheDocument()
        expect(screen.getByText('내 상품으로 들어온 의뢰와 내가 보낸 제안서를 확인합니다.')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '받은 일 관리' })).toBeInTheDocument()
        expect(screen.getByText('받은 상품 의뢰와 전문가 문의를 최신순으로 확인하고, 선택한 항목의 진행 과정을 관리합니다.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '내가 등록한 상품' })).toHaveAttribute('href', '/profile')
        expect(screen.queryByRole('link', { name: '요청 게시판에서 제안할 일 찾기' })).not.toBeInTheDocument()
        expect(screen.getAllByText('상품 지정 요구사항').length).toBeGreaterThan(0)
        expect(await screen.findByRole('link', { name: '공개 상품 보기' })).toHaveAttribute(
            'href',
            '/expert/product-owned-01',
        )
        expect(await screen.findByRole('link', { name: '보낸 제안서 보기' })).toHaveAttribute(
            'href',
            '/proposal/proposal-real-expert',
        )
        expect(screen.queryByRole('heading', { name: '전문가 응답 필요' })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: '보낸 제안서' })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: '내가 등록한 상품' })).not.toBeInTheDocument()
    })

    it('lets clients open a product order and manage its related stages together', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '의뢰자 홈' }))

        expect(await screen.findByRole('heading', { name: '상품 주문 관리' })).toBeInTheDocument()
        expect(screen.getByText('상품 주문과 전문가 문의를 최신순으로 확인하고, 선택한 항목의 진행 과정을 관리합니다.')).toBeInTheDocument()

        const productOrderButton = within(screen.getByTestId('client-unified-work-list'))
            .getAllByRole('button')
            .find((button) => button.getAttribute('data-work-item-id') === 'request-product-client-01')
        expect(productOrderButton).toBeDefined()
        fireEvent.click(productOrderButton!)

        expect(screen.getByRole('heading', { name: 'AI 숏폼 영상 제작' })).toBeInTheDocument()
        expect(screen.queryByText(/현재 단계:/)).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '전체 과정' })).toBeInTheDocument()
        expect(screen.getAllByText('작업 전').length).toBeGreaterThan(0)
        expect(screen.getByText('의뢰서 작성')).toBeInTheDocument()
        expect(screen.getAllByText('제품 홍보 숏폼').length).toBeGreaterThan(0)
        expect(screen.getByRole('link', { name: '의뢰서 보기/수정' })).toHaveAttribute(
            'href',
            '/request/product-client-01?requestId=request-product-client-01',
        )
        expect(screen.getByText('제안서 승인 및 결제')).toBeInTheDocument()
        expect(screen.queryByText('제안서 대기')).not.toBeInTheDocument()
        expect(screen.queryByText('상담 후 제안서 대기')).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: '제안서 보기' })).toHaveAttribute('href', '/proposal/proposal-real-client')
        expect(screen.getByText('결제 완료 후 작업방이 생성되었습니다.')).toBeInTheDocument()
        expect(screen.queryByText('테스트 결제 완료')).not.toBeInTheDocument()
        expect(screen.getAllByText('작업 중').length).toBeGreaterThan(0)
        expect(screen.getByText('작업방 진행')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '작업방 열기' })).toHaveAttribute('href', '/workroom/work-real-active')
        expect(screen.getByText('작업 후')).toBeInTheDocument()
        expect(screen.getByText('완료 확인/리뷰')).toBeInTheDocument()

        expect(within(screen.getByLabelText('의뢰서 작성 단계 상태: 완료됨')).getByText('완료됨')).toBeInTheDocument()
        expect(within(screen.getByLabelText('제안서 승인 및 결제 단계 상태: 완료됨')).getByText('완료됨')).toBeInTheDocument()
        expect(within(screen.getByLabelText('작업방 진행 단계 상태: 진행 중')).getAllByText('진행 중').length).toBeGreaterThan(0)
        const pendingReviewStage = screen.getByLabelText('완료 확인/리뷰 단계 상태: 대기')
        expect(within(pendingReviewStage).getByText('대기')).toBeInTheDocument()
        expect(within(pendingReviewStage).getByText('완료 확인/리뷰')).toHaveAttribute('data-stage-muted', 'true')
        expect(within(pendingReviewStage).getByText('작업이 완료되면 결과 확인과 리뷰 작성이 가능합니다.')).toHaveAttribute('data-stage-muted', 'true')
    })

    it('shows only payment as the current stage after a proposal is received but unpaid', async () => {
        getUserProposals.mockResolvedValue([
            ...defaultProposals(),
            {
                id: 'proposal-client-before-payment',
                requestId: 'request-product-client-before',
                clientId: 'user-demo-01',
                expertId: 'expert-real-before',
                title: '결제 대기 제안서',
                scope: '작업 전 주문에 도착한 제안서',
                deliverables: ['AI 숏폼 1편'],
                totalPrice: 40000,
                deliveryDays: 3,
                revisionCount: 1,
                progressType: 'single' as const,
                milestones: [],
                commercialUseAllowed: true,
                sourceFileIncluded: false,
                status: 'sent' as const,
                paymentStatus: 'unpaid' as const,
                expiresAt: '2026-06-05T00:00:00.000Z',
            },
        ])

        render(
            <MemoryRouter initialEntries={['/mypage?panel=client&clientOrder=request-product-client-before']}>
                <MyPage />
            </MemoryRouter>,
        )

        expect(await screen.findByText('제안서 승인 및 결제')).toBeInTheDocument()
        expect(screen.queryByText(/현재 단계:/)).not.toBeInTheDocument()
        expect(within(screen.getByLabelText('제안서 승인 및 결제 단계 상태: 진행 중')).getAllByText('진행 중').length).toBeGreaterThan(0)
        expect(screen.queryByLabelText('테스트 결제 대기 단계 상태: 진행 중')).not.toBeInTheDocument()
    })

    it('lists client product orders by request creation time without phase groups', async () => {
        getUserServiceRequests.mockResolvedValue([
            {
                id: 'client-old-order',
                title: '오래된 상품 주문',
                description: '먼저 보낸 주문',
                budget: '30000',
                deadline: '2026-06-01',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026-06-01T00:00:00.000Z',
                clientId: 'user-demo-01',
                expertId: 'expert-real-01',
                productId: 'product-client-01',
                selectedPackage: 'standard',
                desiredResult: '오래된 의뢰서',
                purpose: 'SNS 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'in_progress',
            },
            {
                id: 'client-new-order',
                title: '최신 상품 주문',
                description: '나중에 보낸 주문',
                budget: '40000',
                deadline: '2026-06-05',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026-06-03T00:00:00.000Z',
                clientId: 'user-demo-01',
                expertId: 'expert-real-before',
                productId: 'product-client-before',
                selectedPackage: 'standard',
                desiredResult: '최신 의뢰서',
                purpose: '런칭 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'pending',
            },
        ])

        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '의뢰자 홈' }))

        const list = await screen.findByTestId('client-unified-work-list')
        expect(within(list).queryByRole('heading', { name: '작업 전' })).not.toBeInTheDocument()
        expect(within(list).queryByRole('heading', { name: '작업 중' })).not.toBeInTheDocument()
        expect(within(list).queryByRole('heading', { name: '작업 완료' })).not.toBeInTheDocument()

        const orders = within(list)
            .getAllByRole('button')
            .filter((button) => button.getAttribute('data-work-item-kind') === 'product')
        expect(orders[0]).toHaveTextContent('최신 의뢰서')
        expect(orders[1]).toHaveTextContent('오래된 의뢰서')
    })

    it('shows submitted product orders as client review tasks', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '의뢰자 홈' }))

        const groups = await screen.findByTestId('client-unified-work-list')
        fireEvent.click(within(groups).getByRole('button', { name: /결과물 검토 요구사항/ }))

        expect(screen.getByRole('heading', { name: '결과물 검토 테스트 상품' })).toBeInTheDocument()
        expect(screen.queryByText(/현재 단계:/)).not.toBeInTheDocument()
        expect(screen.getByText('결과물 검토 대기')).toBeInTheDocument()
        expect(screen.getByText('전문가가 제출한 결과물을 확인하고 승인 또는 수정 요청을 진행합니다.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '결과물 확인하기' })).toHaveAttribute(
            'href',
            '/workroom/work-client-submitted-order',
        )
        expect(
            within(screen.getByLabelText('결과물 검토 대기 단계 상태: 진행 중')).getAllByText('진행 중').length,
        ).toBeGreaterThan(0)
    })

    it('shows revision requested product orders as waiting for expert fixes', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '의뢰자 홈' }))

        const groups = await screen.findByTestId('client-unified-work-list')
        fireEvent.click(within(groups).getByRole('button', { name: /수정 요청 요구사항/ }))

        expect(screen.getByRole('heading', { name: '수정 요청 테스트 상품' })).toBeInTheDocument()
        expect(screen.queryByText(/현재 단계:/)).not.toBeInTheDocument()
        expect(screen.getByText('수정 요청 보냄')).toBeInTheDocument()
        expect(screen.getByText('전문가에게 수정 요청을 보냈고 재제출을 기다립니다.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '수정 요청 확인하기' })).toHaveAttribute(
            'href',
            '/workroom/work-client-revision-order',
        )
    })

    it('lists expert received product requests by received time without phase groups', async () => {
        getUserServiceRequests.mockResolvedValue([
            {
                id: 'expert-old-request',
                title: '오래된 받은 의뢰',
                description: '먼저 받은 상품 의뢰',
                budget: '50000',
                deadline: '2026-06-12',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026-06-01T00:00:00.000Z',
                clientId: 'client-real-01',
                expertId: 'user-demo-01',
                productId: 'product-owned-01',
                selectedPackage: 'standard',
                desiredResult: '오래된 받은 의뢰서',
                purpose: 'SNS 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'pending',
            },
            {
                id: 'expert-new-request',
                title: '최신 받은 의뢰',
                description: '나중에 받은 상품 의뢰',
                budget: '70000',
                deadline: '2026-06-14',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026-06-04T00:00:00.000Z',
                clientId: 'client-real-active',
                expertId: 'user-demo-01',
                productId: 'product-owned-01',
                selectedPackage: 'standard',
                desiredResult: '최신 받은 의뢰서',
                purpose: 'SNS 홍보',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
                status: 'pending',
            },
        ])

        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))

        const list = await screen.findByTestId('expert-unified-work-list')
        expect(within(list).queryByRole('heading', { name: '작업 전' })).not.toBeInTheDocument()
        expect(within(list).queryByRole('heading', { name: '작업 중' })).not.toBeInTheDocument()
        expect(within(list).queryByRole('heading', { name: '작업 완료' })).not.toBeInTheDocument()

        const requests = within(list)
            .getAllByRole('button')
            .filter((button) => button.getAttribute('data-work-item-kind') === 'product')
        expect(requests[0]).toHaveTextContent('최신 받은 의뢰서')
        expect(requests[1]).toHaveTextContent('오래된 받은 의뢰서')

        fireEvent.click(requests[1])
        expect(screen.getByRole('heading', { name: '오래된 받은 의뢰서' })).toBeInTheDocument()
        expect(screen.queryByText(/현재 단계:/)).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: '전체 과정' })).toBeInTheDocument()
        expect(screen.getByText('받은 의뢰')).toBeInTheDocument()
        expect(screen.getByText('제안서 작성/수정')).toBeInTheDocument()
    })

    it('shows submitted expert work as waiting for client approval', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))

        const groups = await screen.findByTestId('expert-unified-work-list')
        fireEvent.click(within(groups).getByRole('button', { name: /전문가 제출 완료 요구사항/ }))

        expect(screen.getByRole('heading', { name: '전문가 제출 완료 요구사항' })).toBeInTheDocument()
        expect(screen.queryByText(/현재 단계:/)).not.toBeInTheDocument()
        expect(screen.getByText('제출 완료 - 승인 대기')).toBeInTheDocument()
        expect(screen.getByText('결과물을 제출했고 의뢰자의 승인 또는 수정 요청을 기다립니다.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '제출물 확인하기' })).toHaveAttribute(
            'href',
            '/workroom/work-expert-submitted-order',
        )
    })

    it('labels the expert payment waiting stage as proposal approval and payment waiting', async () => {
        render(
            <MemoryRouter initialEntries={['/mypage?panel=expert&expertRequest=request-product-directed-01']}>
                <MyPage />
            </MemoryRouter>,
        )

        expect(await screen.findByText('제안서 승인 및 결제 대기')).toBeInTheDocument()
        expect(screen.queryByText(/현재 단계:/)).not.toBeInTheDocument()
        expect(screen.queryByText('의뢰자 결제 대기')).not.toBeInTheDocument()
    })

    it('shows revision requested expert work as needing expert action', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))

        const groups = await screen.findByTestId('expert-unified-work-list')
        fireEvent.click(within(groups).getByRole('button', { name: /전문가 수정 요청 요구사항/ }))

        expect(screen.getByRole('heading', { name: '전문가 수정 요청 요구사항' })).toBeInTheDocument()
        expect(screen.queryByText(/현재 단계:/)).not.toBeInTheDocument()
        expect(screen.getByText('수정 대응 필요')).toBeInTheDocument()
        expect(screen.getByText('의뢰자가 수정 요청을 보냈습니다. 작업방에서 수정본을 다시 제출합니다.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '수정본 제출하기' })).toHaveAttribute(
            'href',
            '/workroom/work-expert-revision-order',
        )
    })

    it('keeps the selected my page panel and order in the URL for browser back navigation', async () => {
        render(
            <MemoryRouter>
                <MyPage />
                <LocationProbe />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))
        const groups = await screen.findByTestId('expert-unified-work-list')
        fireEvent.click(within(groups).getByRole('button', { name: /상품 지정 요구사항/ }))

        await waitFor(() => {
            expect(screen.getByTestId('location').textContent).toContain('panel=expert')
            expect(screen.getByTestId('location').textContent).toContain('expertRequest=request-product-directed-01')
        })
    })

    it('restores the previous my page screen from URL state', async () => {
        render(
            <MemoryRouter initialEntries={['/mypage?panel=client&clientOrder=request-product-client-completed']}>
                <MyPage />
            </MemoryRouter>,
        )

        await waitFor(() => expect(screen.getByRole('button', { name: '의뢰자 홈' })).toHaveAttribute('aria-pressed', 'true'))
        expect(screen.getByRole('button', { name: /작업 완료 요구사항/ })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('heading', { name: /작업 완료 테스트 상품/ })).toBeInTheDocument()
    })

    it('passes the current my page screen to proposal links as the return location', async () => {
        render(
            <MemoryRouter initialEntries={['/mypage']}>
                <Routes>
                    <Route path="/mypage" element={<><MyPage /><LocationProbe /></>} />
                    <Route path="/proposal/:proposalId" element={<LocationStateProbe />} />
                </Routes>
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '의뢰자 홈' }))
        await waitFor(() => expect(screen.getByTestId('location').textContent).toContain('panel=client'))
        const clientList = await screen.findByTestId('client-unified-work-list')
        const clientProductOrder = within(clientList)
            .getAllByRole('button')
            .find((button) => button.getAttribute('data-work-item-id') === 'request-product-client-01')
        expect(clientProductOrder).toBeDefined()
        fireEvent.click(clientProductOrder!)
        fireEvent.click(await screen.findByRole('link', { name: '제안서 보기' }))

        await waitFor(() => {
            expect(screen.getByTestId('location-state').textContent).toContain('"pathname":"/mypage"')
            expect(screen.getByTestId('location-state').textContent).toContain('panel=client')
        })
    })

    it('lets experts send a proposal from a product-directed request in my page', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))

        const groups = await screen.findByTestId('expert-unified-work-list')
        fireEvent.click(within(groups).getByRole('button', { name: /상품 지정 요구사항/ }))
        fireEvent.click(screen.getByRole('button', { name: '제안서 보내기' }))

        await waitFor(() => expect(saveProposal).toHaveBeenCalledWith(
            expect.objectContaining({
                requestId: 'request-product-directed-01',
                clientId: 'client-real-01',
                expertId: 'user-demo-01',
                title: expect.stringContaining('상품 지정 요구사항'),
                status: 'sent',
            }),
        ))
        expect(screen.getByText('제안서를 보냈습니다.')).toBeInTheDocument()
        expect(
            screen
                .getAllByRole('link', { name: '보낸 제안서 보기' })
                .some((link) => link.getAttribute('href') === '/proposal/proposal-product-directed-created'),
        ).toBe(true)
    })

    it('does not link to demo proposal or workroom pages when there is no user data', async () => {
        getUserProposals.mockResolvedValue([])
        getUserWorks.mockResolvedValue([])
        getUserServiceRequests.mockResolvedValue([])
        getUserConsultations.mockResolvedValue([])

        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '의뢰자 홈' }))
        expect(await screen.findByText('아직 작업 내역이 없습니다.')).toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '제안서 보기' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: '작업방 열기' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))
        expect(screen.queryByRole('link', { name: '보낸 제안서 보기' })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /proposal-demo-01/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: /work-demo-01/i })).not.toBeInTheDocument()
    })

    it('shows review button only on completed work', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '완료 / 리뷰' }))
        const completedWork = (await screen.findAllByTestId('completed-work'))[0]
        expect(within(completedWork).getByRole('button', { name: '리뷰 작성' })).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '작업방' }))
        const activeWork = (await screen.findAllByTestId('active-work'))[0]

        expect(within(activeWork).queryByRole('button', { name: '리뷰 작성' })).not.toBeInTheDocument()
    })

    it('shows received and sent proposals through the order stage manager', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '의뢰자 홈' }))
        const clientList = await screen.findByTestId('client-unified-work-list')
        const clientProductOrder = within(clientList)
            .getAllByRole('button')
            .find((button) => button.getAttribute('data-work-item-id') === 'request-product-client-01')
        expect(clientProductOrder).toBeDefined()
        fireEvent.click(clientProductOrder!)
        expect(await screen.findByText('제안서 승인 및 결제')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '제안서 보기' })).toHaveAttribute('href', '/proposal/proposal-real-client')
        expect(screen.queryByText('테스트 결제 완료')).not.toBeInTheDocument()
        expect(screen.getByText('결제 완료 후 작업방이 생성되었습니다.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))
        const groups = await screen.findByTestId('expert-unified-work-list')
        fireEvent.click(within(groups).getByRole('button', { name: /상품 지정 요구사항/ }))
        expect(screen.getByText('제안서 승인 및 결제 대기')).toBeInTheDocument()
        expect(screen.getByText('제안서를 보낸 뒤 의뢰자의 승인과 결제를 기다립니다.')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: '보낸 제안서 보기' })).toHaveAttribute(
            'href',
            '/proposal/proposal-real-expert',
        )
        expect(screen.queryByText('Second sent proposal')).not.toBeInTheDocument()
    })

    it('shows every active and completed work as workroom cards', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '작업방' }))
        expect(await screen.findByRole('link', { name: 'Submitted work' })).toHaveAttribute(
            'href',
            '/workroom/work-real-submitted',
        )
        fireEvent.click(screen.getByRole('button', { name: '완료 / 리뷰' }))
        expect(await screen.findByRole('link', { name: 'Second completed work' })).toHaveAttribute(
            'href',
            '/workroom/work-real-completed-second',
        )
        const completedWorks = await screen.findAllByTestId('completed-work')
        expect(within(completedWorks[0]).getByText('정산 대기')).toBeInTheDocument()
        expect(within(completedWorks[0]).getByText('전문가 정산 예정 61,600원')).toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: '리뷰 작성' })).toHaveLength(3)
    })

    it('does not offer another review for work already reviewed by the client', async () => {
        getUserReviews.mockResolvedValue([
            {
                id: 'review-existing-01',
                workId: 'work-real-completed',
                clientId: 'user-demo-01',
                expertId: 'expert-real-02',
                rating: 5,
                content: 'Already reviewed',
                createdAt: '2026-06-02T00:00:00.000Z',
            },
        ])

        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '완료 / 리뷰' }))
        const completedWorks = await screen.findAllByTestId('completed-work')

        expect(within(completedWorks[0]).queryByRole('button', { name: '리뷰 작성' })).not.toBeInTheDocument()
        expect(within(completedWorks[0]).getByText('리뷰 등록 완료')).toBeInTheDocument()
        expect(within(completedWorks[1]).getByRole('button', { name: '리뷰 작성' })).toBeInTheDocument()
    })

    it('keeps registered products as a compact expert home shortcut only', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '전문가 홈' }))
        expect(await screen.findByRole('link', { name: '공개 상품 보기' })).toHaveAttribute(
            'href',
            '/expert/product-owned-01',
        )
        expect(screen.queryByRole('link', { name: 'Owned AI product' })).not.toBeInTheDocument()
        expect(screen.queryByText('Other AI product')).not.toBeInTheDocument()
    })

    it('opens and submits a review form for completed work', async () => {
        render(
            <MemoryRouter>
                <MyPage />
            </MemoryRouter>,
        )

        fireEvent.click(screen.getByRole('button', { name: '완료 / 리뷰' }))
        fireEvent.click(within((await screen.findAllByTestId('completed-work'))[0]).getByRole('button', { name: '리뷰 작성' }))

        expect(screen.getByRole('heading', { name: '리뷰 작성하기' })).toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('별점'), { target: { value: '5' } })
        fireEvent.change(screen.getByLabelText('리뷰 내용'), {
            target: { value: '결과물이 목적에 잘 맞고 일정 안내도 명확했습니다.' },
        })
        fireEvent.click(screen.getByRole('button', { name: '리뷰 등록' }))

        await waitFor(() =>
            expect(saveReview).toHaveBeenCalledWith(
                expect.objectContaining({
                    workId: 'work-real-completed',
                    clientId: 'user-demo-01',
                    expertId: 'expert-real-02',
                    rating: 5,
                    content: '결과물이 목적에 잘 맞고 일정 안내도 명확했습니다.',
                }),
            ),
        )
        expect(await screen.findByText('리뷰가 등록되었습니다.')).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: '리뷰 작성하기' })).not.toBeInTheDocument()
    })
})
