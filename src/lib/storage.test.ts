import { describe, expect, it, vi } from 'vitest'
import type { AiServiceRequest, Deliverable, ExpertProduct, Proposal, Review, Work, WorkStep } from '../types'

const user = {
    id: 'user-test-01',
    email: 'tester@example.com',
    user_metadata: { display_name: '테스터' },
}

const product: ExpertProduct = {
    id: 'product-test-01',
    expertId: 'expert-test-01',
    expertName: '테스트 전문가',
    title: 'AI 테스트 상품',
    category: 'ai-video-shortform',
    summary: '테스트 요약',
    description: '테스트 설명',
    aiTools: ['ChatGPT', 'Runway'],
    sampleLinks: ['https://example.com/sample'],
    sampleImageUrl: 'https://example.com/sample.jpg',
    startingPrice: 30000,
    deliveryDays: 2,
    revisionCount: 1,
    packages: {
        standard: {
            name: 'Standard',
            price: 30000,
            deliveryDays: 2,
            revisionCount: 1,
            included: ['1차 시안'],
        },
        deluxe: null,
        premium: null,
    },
    status: 'published',
}

describe('expert product storage', () => {
    it('saves expert products to Supabase using expert_products columns', async () => {
        vi.resetModules()
        const upsert = vi.fn().mockResolvedValue({ error: null })
        const from = vi.fn(() => ({ upsert }))

        vi.doMock('./supabase', () => ({
            supabase: { from },
        }))

        const { saveExpertProduct } = await import('./storage')

        await saveExpertProduct(product)

        expect(from).toHaveBeenCalledWith('expert_products')
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                id: product.id,
                expert_id: product.expertId,
                title: product.title,
                category: product.category,
                ai_tools: product.aiTools,
                sample_links: product.sampleLinks,
                sample_file_urls: [product.sampleImageUrl],
                starting_price: product.startingPrice,
                delivery_days: product.deliveryDays,
                packages: product.packages,
                status: 'published',
            }),
        )
    })

    it('loads published expert products from Supabase', async () => {
        vi.resetModules()
        const order = vi.fn().mockResolvedValue({
            data: [
                {
                id: product.id,
                expert_id: product.expertId,
                title: product.title,
                    category: product.category,
                    summary: product.summary,
                    description: product.description,
                    ai_tools: product.aiTools,
                    sample_links: product.sampleLinks,
                    sample_file_urls: product.sampleImageUrl ? [product.sampleImageUrl] : [],
                    starting_price: product.startingPrice,
                    delivery_days: product.deliveryDays,
                    revision_count: product.revisionCount,
                    packages: product.packages,
                    status: product.status,
                },
            ],
            error: null,
        })
        const eq = vi.fn(() => ({ order }))
        const select = vi.fn(() => ({ eq }))
        const from = vi.fn(() => ({ select }))

        vi.doMock('./supabase', () => ({
            supabase: { from },
        }))

        const { getExpertProducts } = await import('./storage')

        await expect(getExpertProducts()).resolves.toEqual([{ ...product, expertName: 'AI 전문가' }])
        expect(from).toHaveBeenCalledWith('expert_products')
        expect(select).toHaveBeenCalledWith('*')
        expect(eq).toHaveBeenCalledWith('status', 'published')
    })
})

describe('profile storage', () => {
    it('ensures a minimal user profile row for foreign key references', async () => {
        vi.resetModules()
        const upsert = vi.fn().mockResolvedValue({ error: null })
        const from = vi.fn(() => ({ upsert }))

        vi.doMock('./supabase', () => ({
            supabase: { from },
        }))

        const { ensureUserProfile } = await import('./storage')

        await ensureUserProfile(user)

        expect(from).toHaveBeenCalledWith('profiles')
        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                id: user.id,
                email: user.email,
                display_name: '테스터',
            }),
            { onConflict: 'id' },
        )
    })
})

const request: AiServiceRequest = {
    id: 'request-test-01',
    clientId: 'client-test-01',
    expertId: 'expert-test-01',
    productId: product.id,
    selectedPackage: 'standard',
    desiredResult: '15초 숏폼 영상',
    purpose: 'SNS 홍보',
    referenceText: 'https://example.com/ref',
    referenceLinks: ['https://example.com/ref'],
    deadline: '2026-06-01',
    progressType: 'milestone',
    checklist: {
        commercialUseNeeded: true,
        sourceFileNeeded: false,
        revisionNeeded: true,
        usageContext: '인스타그램',
    },
    additionalRequest: '밝은 톤',
    status: 'submitted',
}

const proposal: Proposal = {
    id: 'proposal-test-01',
    requestId: request.id,
    clientId: request.clientId,
    expertId: request.expertId,
    title: 'AI 숏폼 제작 제안',
    scope: '콘셉트와 1차 영상 시안 제작',
    deliverables: ['영상 시안', '콘셉트 요약'],
    totalPrice: 70000,
    deliveryDays: 4,
    revisionCount: 2,
    progressType: 'milestone',
    milestones: ['콘셉트 확인', '1차 시안', '최종 제출'],
    commercialUseAllowed: true,
    sourceFileIncluded: false,
    status: 'sent',
    expiresAt: '2026-06-04T00:00:00.000Z',
}

const work: Work = {
    id: 'work-test-01',
    proposalId: proposal.id,
    requestId: request.id,
    clientId: request.clientId,
    expertId: request.expertId,
    title: proposal.title,
    progressType: 'milestone',
    status: 'in_progress',
    stepIds: ['step-test-01'],
}

const step: WorkStep = {
    id: 'step-test-01',
    workId: work.id,
    stepOrder: 1,
    title: '콘셉트 확인',
    description: '작업 방향을 확인합니다.',
    status: 'submitted',
}

const deliverable: Deliverable = {
    id: 'deliverable-test-01',
    workId: work.id,
    stepId: step.id,
    expertId: request.expertId,
    description: '1차 시안 링크',
    externalUrl: 'https://example.com/deliverable',
    status: 'submitted',
    submittedAt: '2026-06-01T00:00:00.000Z',
}

const review: Review = {
    id: 'review-test-01',
    workId: work.id,
    clientId: request.clientId,
    expertId: request.expertId,
    rating: 5,
    content: '좋은 결과물이었습니다.',
    createdAt: '2026-06-02T00:00:00.000Z',
}

describe('transaction storage', () => {
    it('saves service requests to Supabase using service_requests columns', async () => {
        vi.resetModules()
        const insert = vi.fn().mockResolvedValue({ error: null })
        const from = vi.fn(() => ({ insert }))
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { saveServiceRequest } = await import('./storage')

        await saveServiceRequest(request)

        expect(from).toHaveBeenCalledWith('service_requests')
        expect(insert).toHaveBeenCalledWith([
            expect.objectContaining({
                client_id: request.clientId,
                expert_id: request.expertId,
                product_id: request.productId,
                selected_package: request.selectedPackage,
                desired_result: request.desiredResult,
                purpose: request.purpose,
                reference_text: request.referenceText,
                reference_links: request.referenceLinks,
                progress_type: request.progressType,
                checklist: request.checklist,
                status: 'submitted',
            }),
        ])
    })

    it('loads service requests from Supabase', async () => {
        vi.resetModules()
        const order = vi.fn().mockResolvedValue({
            data: [
                {
                    id: request.id,
                    client_id: request.clientId,
                    expert_id: request.expertId,
                    product_id: request.productId,
                    selected_package: request.selectedPackage,
                    desired_result: request.desiredResult,
                    purpose: request.purpose,
                    reference_text: request.referenceText,
                    reference_links: request.referenceLinks,
                    deadline: request.deadline,
                    progress_type: request.progressType,
                    checklist: request.checklist,
                    additional_request: request.additionalRequest,
                    status: request.status,
                    created_at: '2026-06-01T00:00:00.000Z',
                },
            ],
            error: null,
        })
        const select = vi.fn(() => ({ order }))
        const from = vi.fn(() => ({ select }))
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { getServiceRequests } = await import('./storage')

        await expect(getServiceRequests()).resolves.toEqual([request])
        expect(from).toHaveBeenCalledWith('service_requests')
    })

    it('saves and accepts proposals through Supabase', async () => {
        vi.resetModules()
        const insert = vi.fn().mockResolvedValue({ error: null })
        const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
        const from = vi.fn(() => ({ insert, update }))
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { saveProposal, acceptProposal } = await import('./storage')

        await saveProposal(proposal)
        await acceptProposal(proposal)

        expect(from).toHaveBeenCalledWith('proposals')
        expect(insert).toHaveBeenCalledWith([
            expect.objectContaining({
                request_id: proposal.requestId,
                total_price: proposal.totalPrice,
                expires_at: proposal.expiresAt,
            }),
        ])
        expect(from).toHaveBeenCalledWith('works')
    })

    it('loads proposals where the user is a client or expert', async () => {
        vi.resetModules()
        const order = vi.fn().mockResolvedValue({
            data: [
                {
                    id: proposal.id,
                    request_id: proposal.requestId,
                    client_id: proposal.clientId,
                    expert_id: proposal.expertId,
                    title: proposal.title,
                    scope: proposal.scope,
                    deliverables: proposal.deliverables,
                    total_price: proposal.totalPrice,
                    delivery_days: proposal.deliveryDays,
                    revision_count: proposal.revisionCount,
                    progress_type: proposal.progressType,
                    milestones: proposal.milestones,
                    commercial_use_allowed: proposal.commercialUseAllowed,
                    source_file_included: proposal.sourceFileIncluded,
                    status: proposal.status,
                    expires_at: proposal.expiresAt,
                },
            ],
            error: null,
        })
        const or = vi.fn(() => ({ order }))
        const select = vi.fn(() => ({ or }))
        const from = vi.fn(() => ({ select }))
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { getUserProposals } = await import('./storage')

        await expect(getUserProposals(request.clientId)).resolves.toEqual([proposal])
        expect(from).toHaveBeenCalledWith('proposals')
        expect(or).toHaveBeenCalledWith(`client_id.eq.${request.clientId},expert_id.eq.${request.clientId}`)
        expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    })

    it('loads workroom data and saves deliverables', async () => {
        vi.resetModules()
        const workSingle = vi.fn().mockResolvedValue({
            data: {
                id: work.id,
                proposal_id: work.proposalId,
                request_id: work.requestId,
                client_id: work.clientId,
                expert_id: work.expertId,
                title: work.title,
                progress_type: work.progressType,
                status: work.status,
            },
            error: null,
        })
        const workEq = vi.fn(() => ({ single: workSingle }))
        const stepOrder = vi.fn().mockResolvedValue({
            data: [
                {
                    id: step.id,
                    work_id: step.workId,
                    step_order: step.stepOrder,
                    title: step.title,
                    description: step.description,
                    status: step.status,
                },
            ],
            error: null,
        })
        const deliverableInsert = vi.fn().mockResolvedValue({ error: null })
        const deliverableOrder = vi.fn().mockResolvedValue({
            data: [
                {
                    id: deliverable.id,
                    work_id: deliverable.workId,
                    step_id: deliverable.stepId,
                    expert_id: deliverable.expertId,
                    description: deliverable.description,
                    external_url: deliverable.externalUrl,
                    status: deliverable.status,
                    submitted_at: deliverable.submittedAt,
                },
            ],
            error: null,
        })
        const from = vi.fn((table: string) => {
            if (table === 'works') return { select: vi.fn(() => ({ eq: workEq })) }
            if (table === 'work_steps') return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: stepOrder })) })) }
            if (table === 'deliverables') {
                return {
                    select: vi.fn(() => ({ eq: vi.fn(() => ({ order: deliverableOrder })) })),
                    insert: deliverableInsert,
                }
            }
            return {}
        })
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { getWorkroomData, saveDeliverable } = await import('./storage')

        await expect(getWorkroomData(work.id)).resolves.toEqual({
            work,
            steps: [step],
            deliverables: [deliverable],
        })
        await saveDeliverable(deliverable)
        expect(deliverableInsert).toHaveBeenCalledWith([
            expect.objectContaining({
                work_id: deliverable.workId,
                external_url: deliverable.externalUrl,
            }),
        ])
    })

    it('loads works where the user is a client or expert', async () => {
        vi.resetModules()
        const order = vi.fn().mockResolvedValue({
            data: [
                {
                    id: work.id,
                    proposal_id: work.proposalId,
                    request_id: work.requestId,
                    client_id: work.clientId,
                    expert_id: work.expertId,
                    title: work.title,
                    progress_type: work.progressType,
                    status: work.status,
                },
            ],
            error: null,
        })
        const or = vi.fn(() => ({ order }))
        const select = vi.fn(() => ({ or }))
        const from = vi.fn(() => ({ select }))
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { getUserWorks } = await import('./storage')

        await expect(getUserWorks(request.clientId)).resolves.toEqual([{ ...work, stepIds: [] }])
        expect(from).toHaveBeenCalledWith('works')
        expect(or).toHaveBeenCalledWith(`client_id.eq.${request.clientId},expert_id.eq.${request.clientId}`)
        expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    })

    it('approves a deliverable and completes its work through Supabase', async () => {
        vi.resetModules()
        const deliverableEq = vi.fn().mockResolvedValue({ error: null })
        const deliverableUpdate = vi.fn(() => ({ eq: deliverableEq }))
        const workEq = vi.fn().mockResolvedValue({ error: null })
        const workUpdate = vi.fn(() => ({ eq: workEq }))
        const from = vi.fn((table: string) => {
            if (table === 'deliverables') return { update: deliverableUpdate }
            if (table === 'works') return { update: workUpdate }
            return {}
        })
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { approveWorkDeliverable } = await import('./storage')

        await approveWorkDeliverable(work.id, deliverable.id)

        expect(from).toHaveBeenCalledWith('deliverables')
        expect(deliverableUpdate).toHaveBeenCalledWith({ status: 'approved' })
        expect(deliverableEq).toHaveBeenCalledWith('id', deliverable.id)
        expect(from).toHaveBeenCalledWith('works')
        expect(workUpdate).toHaveBeenCalledWith({ status: 'completed' })
        expect(workEq).toHaveBeenCalledWith('id', work.id)
    })

    it('requests a deliverable revision and marks its work as revision requested through Supabase', async () => {
        vi.resetModules()
        const deliverableEq = vi.fn().mockResolvedValue({ error: null })
        const deliverableUpdate = vi.fn(() => ({ eq: deliverableEq }))
        const workEq = vi.fn().mockResolvedValue({ error: null })
        const workUpdate = vi.fn(() => ({ eq: workEq }))
        const from = vi.fn((table: string) => {
            if (table === 'deliverables') return { update: deliverableUpdate }
            if (table === 'works') return { update: workUpdate }
            return {}
        })
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { requestWorkRevision } = await import('./storage')

        await requestWorkRevision(work.id, deliverable.id)

        expect(from).toHaveBeenCalledWith('deliverables')
        expect(deliverableUpdate).toHaveBeenCalledWith({ status: 'revision_requested' })
        expect(deliverableEq).toHaveBeenCalledWith('id', deliverable.id)
        expect(from).toHaveBeenCalledWith('works')
        expect(workUpdate).toHaveBeenCalledWith({ status: 'revision_requested' })
        expect(workEq).toHaveBeenCalledWith('id', work.id)
    })

    it('saves reviews to Supabase', async () => {
        vi.resetModules()
        const insert = vi.fn().mockResolvedValue({ error: null })
        const from = vi.fn(() => ({ insert }))
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { saveReview } = await import('./storage')

        await saveReview(review)

        expect(from).toHaveBeenCalledWith('reviews')
        expect(insert).toHaveBeenCalledWith([
            expect.objectContaining({
                work_id: review.workId,
                client_id: review.clientId,
                rating: review.rating,
                content: review.content,
            }),
        ])
    })
})
