import { ROUTES } from '../constants/routes'
import type { Consultation, ConsultationMessage, Proposal, ServiceRequestData, Work, WorkMessage } from '../types'
import { getConsultationMessages, getUserConsultations, getUserProposals, getUserServiceRequests, getUserWorks, getWorkMessages } from './storage'

export type UserNotificationKind = 'request' | 'proposal' | 'message' | 'work'

export interface UserNotification {
    id: string
    kind: UserNotificationKind
    title: string
    body: string
    to: string
    createdAt: string
}

export interface UserNotificationSource {
    userId: string
    serviceRequests: ServiceRequestData[]
    proposals: Proposal[]
    consultations: Consultation[]
    messagesByConsultation: Record<string, ConsultationMessage[]>
    works: Work[]
    messagesByWork?: Record<string, WorkMessage[]>
}

export async function getUserNotifications(userId: string): Promise<UserNotification[]> {
    const [serviceRequests, proposals, consultations, works] = await Promise.all([
        getUserServiceRequests(userId),
        getUserProposals(userId),
        getUserConsultations(userId),
        getUserWorks(userId),
    ])
    const messagePairs = await Promise.all(
        consultations.map(async (consultation) => [consultation.id, await getConsultationMessages(consultation.id)] as const),
    )
    const workMessagePairs = await Promise.all(
        works.map(async (work) => [work.id, await getWorkMessages(work.id)] as const),
    )

    return buildUserNotifications({
        userId,
        serviceRequests,
        proposals,
        consultations,
        messagesByConsultation: Object.fromEntries(messagePairs),
        works,
        messagesByWork: Object.fromEntries(workMessagePairs),
    })
}

export function buildUserNotifications({
    userId,
    serviceRequests,
    proposals,
    consultations,
    messagesByConsultation,
    works,
    messagesByWork = {},
}: UserNotificationSource): UserNotification[] {
    const requestNotifications = serviceRequests
        .filter((request) => request.expertId === userId && request.productId && request.status === 'pending')
        .map((request): UserNotification => {
            const updatedAt = request.updatedAt || ''
            const wasUpdated = toTime(updatedAt) > toTime(request.createdAt)
            const eventTime = wasUpdated ? updatedAt : request.createdAt

            return {
                id: wasUpdated ? `request-updated-${request.id}-${eventTime}` : `request-${request.id}`,
                kind: 'request',
                title: wasUpdated ? '의뢰서가 수정됨' : '새 상품 의뢰',
                body: request.desiredResult || request.title,
                to: `${ROUTES.WORK_DASHBOARD}?role=expert&panel=client&expertRequest=${request.id}`,
                createdAt: eventTime,
            }
        })

    const proposalNotifications = proposals
        .filter((proposal) => proposal.clientId === userId && ['sent', 'revision_requested'].includes(proposal.status))
        .map((proposal): UserNotification => ({
            id: `proposal-${proposal.id}`,
            kind: 'proposal',
            title: proposal.status === 'revision_requested' ? '수정된 제안서 도착' : '새 제안서 도착',
            body: `${proposal.title} · ${proposal.totalPrice.toLocaleString('ko-KR')}원`,
            to: `/proposal/${proposal.id}`,
            createdAt: '',
        }))

    const messageNotifications = consultations
        .map((consultation) => {
            const latestMessage = [...(messagesByConsultation[consultation.id] || [])]
                .reverse()
                .find((message) => message.senderId !== userId)
            if (!latestMessage) return null
            return {
                id: `message-${latestMessage.id}`,
                kind: 'message',
                title: '새 상담 메시지',
                body: latestMessage.body || consultation.title,
                to: `${ROUTES.WORK_DASHBOARD}?role=${consultation.expertId === userId ? 'expert' : 'client'}&panel=consultations&consultation=${consultation.id}`,
                createdAt: latestMessage.createdAt || consultation.lastMessageAt,
            } satisfies UserNotification
        })
        .filter((notification): notification is UserNotification => Boolean(notification))

    const workNotifications = works
        .filter((work) => (
            (work.clientId === userId && work.status === 'submitted') ||
            (work.expertId === userId && work.status === 'revision_requested') ||
            (work.expertId === userId && work.status === 'completed')
        ))
        .map((work): UserNotification => ({
            id: work.status === 'completed' ? `work-completed-${work.id}` : `work-${work.id}`,
            kind: 'work',
            title: work.status === 'completed'
                ? '작업 완료 승인'
                : work.clientId === userId
                    ? '작업물 도착'
                    : '수정 요청 도착',
            body: work.title,
            to: `${ROUTES.WORKROOM.replace(':workId', work.id)}`,
            createdAt: new Date().toISOString(),
        }))

    const workMessageNotifications = works
        .map((work) => {
            const latestMessage = [...(messagesByWork[work.id] || [])]
                .reverse()
                .find((message) => message.senderId !== userId)
            if (!latestMessage) return null
            return {
                id: `work-message-${latestMessage.id}`,
                kind: 'message',
                title: '작업방 메시지',
                body: latestMessage.body || work.title,
                to: `${ROUTES.WORKROOM.replace(':workId', work.id)}`,
                createdAt: latestMessage.createdAt,
            } satisfies UserNotification
        })
        .filter((notification): notification is UserNotification => Boolean(notification))

    const cancelledWorkNotifications = works
        .filter((work) => (work.clientId === userId || work.expertId === userId) && work.status === 'cancelled')
        .map((work): UserNotification => ({
            id: `work-cancelled-${work.id}`,
            kind: 'work',
            title: '거래 중단됨',
            body: work.title,
            to: `${ROUTES.WORK_DASHBOARD}?role=${work.expertId === userId ? 'expert' : 'client'}&panel=client&${work.expertId === userId ? 'expertRequest' : 'clientOrder'}=${work.requestId}`,
            createdAt: new Date().toISOString(),
        }))

    return [
        ...requestNotifications,
        ...proposalNotifications,
        ...messageNotifications,
        ...workNotifications,
        ...workMessageNotifications,
        ...cancelledWorkNotifications,
    ].sort((first, second) => toTime(second.createdAt) - toTime(first.createdAt))
}

const toTime = (value: string) => {
    const parsed = Date.parse(value || '')
    return Number.isNaN(parsed) ? 0 : parsed
}
