import { describe, expect, it } from 'vitest'
import { buildUserNotifications } from './notifications'
import type { Consultation, ConsultationMessage, Proposal, ServiceRequestData, Work } from '../types'

describe('buildUserNotifications', () => {
    it('sends a new expert notification when a received request is updated', () => {
        const requests: ServiceRequestData[] = [
            {
                id: 'request-updated-01',
                title: 'AI 영상 상품',
                description: '처음 보낸 의뢰서',
                budget: '50000',
                deadline: '2026-06-20',
                categories: [],
                createdAt: '2026-06-10T10:00:00.000Z',
                updatedAt: '2026-06-11T09:00:00.000Z',
                clientId: 'client-01',
                expertId: 'expert-01',
                productId: 'product-01',
                status: 'pending',
                desiredResult: '수정된 의뢰 내용',
            },
        ]

        const notifications = buildUserNotifications({
            userId: 'expert-01',
            serviceRequests: requests,
            proposals: [],
            consultations: [],
            messagesByConsultation: {},
            works: [],
        })

        expect(notifications).toHaveLength(1)
        expect(notifications[0]).toMatchObject({
            id: 'request-updated-request-updated-01-2026-06-11T09:00:00.000Z',
            title: '의뢰서 수정됨',
            body: '수정된 의뢰 내용',
            to: '/my-work?role=expert&panel=client&expertRequest=request-updated-01',
            createdAt: '2026-06-11T09:00:00.000Z',
        })
    })

    it('turns received marketplace events into direct work links newest first', () => {
        const requests: ServiceRequestData[] = [
            {
                id: 'request-01',
                title: '신규 상품 의뢰',
                description: '제품 소개 영상',
                budget: '50000',
                deadline: '2026-06-20',
                categories: [],
                createdAt: '2026-06-10T10:00:00.000Z',
                clientId: 'client-01',
                expertId: 'expert-01',
                productId: 'product-01',
                status: 'pending',
            },
        ]
        const proposals: Proposal[] = [
            {
                id: 'proposal-01',
                requestId: 'request-02',
                clientId: 'client-01',
                expertId: 'expert-01',
                title: '제안서가 도착했습니다',
                scope: '작업 범위',
                deliverables: ['결과물'],
                totalPrice: 70000,
                deliveryDays: 3,
                revisionCount: 1,
                progressType: 'single',
                milestones: [],
                commercialUseAllowed: true,
                sourceFileIncluded: false,
                status: 'sent',
                paymentStatus: 'unpaid',
                expiresAt: '2026-06-30T00:00:00.000Z',
            },
        ]
        const consultations: Consultation[] = [
            {
                id: 'consultation-01',
                clientId: 'client-01',
                expertId: 'expert-01',
                productId: 'product-01',
                status: 'open',
                title: '상담 문의',
                createdAt: '2026-06-10T09:00:00.000Z',
                lastMessageAt: '2026-06-10T12:00:00.000Z',
            },
        ]
        const messagesByConsultation: Record<string, ConsultationMessage[]> = {
            'consultation-01': [
                {
                    id: 'message-01',
                    consultationId: 'consultation-01',
                    senderId: 'client-01',
                    body: '견적 문의드립니다.',
                    attachmentUrls: [],
                    createdAt: '2026-06-10T12:00:00.000Z',
                },
            ],
        }
        const works: Work[] = [
            {
                id: 'work-01',
                proposalId: 'proposal-01',
                requestId: 'request-02',
                clientId: 'client-01',
                expertId: 'expert-01',
                title: '작업물 제출됨',
                progressType: 'single',
                status: 'submitted',
                stepIds: [],
            },
        ]

        const expertNotifications = buildUserNotifications({
            userId: 'expert-01',
            serviceRequests: requests,
            proposals,
            consultations,
            messagesByConsultation,
            works,
        })
        const clientNotifications = buildUserNotifications({
            userId: 'client-01',
            serviceRequests: requests,
            proposals,
            consultations,
            messagesByConsultation,
            works,
        })

        expect(expertNotifications.map((item) => item.title)).toEqual(['새 상담 메시지', '새 상품 의뢰'])
        expect(expertNotifications[0].to).toBe('/my-work?role=expert&panel=consultations&consultation=consultation-01')
        expect(expertNotifications[1].to).toBe('/my-work?role=expert&panel=client&expertRequest=request-01')
        expect(clientNotifications.map((item) => item.title)).toEqual(['작업물 도착', '새 제안서 도착'])
        expect(clientNotifications[0].to).toBe('/workroom/work-01')
        expect(clientNotifications[1].to).toBe('/proposal/proposal-01')
    })
})
