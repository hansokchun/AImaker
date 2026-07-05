import { describe, expect, it, vi } from 'vitest'
import type { AiServiceRequest, Deliverable, ExpertProduct, ExpertProfile, Proposal, Review, Work, WorkStep } from '../types'

const futureIsoDate = (daysFromNow = 7) => {
    const date = new Date()
    date.setDate(date.getDate() + daysFromNow)
    return date.toISOString()
}

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
    sampleLinks: ['https://example.com/sample'],
    sampleImageUrl: 'https://example.com/sample.jpg',
    startingPrice: 30000,
    deliveryDays: 2,
    revisionCount: 1,
    createdAt: '2026-06-10T10:00:00.000Z',
    taxInvoiceAvailable: true,
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
    it('blocks local product saving for a restricted expert profile', async () => {
        vi.resetModules()
        vi.doMock('./supabase', () => ({ supabase: null }))
        localStorage.setItem(`ai_profile_${product.expertId}`, JSON.stringify({
            name: '제한된 전문가',
            moderationStatus: 'restricted',
        }))
        const { saveExpertProduct } = await import('./storage')

        await expect(saveExpertProduct(product)).rejects.toThrow('활동 제한된 회원은 상품을 등록하거나 수정할 수 없습니다.')
        expect(localStorage.getItem('ai_products')).toBeNull()
    })

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
                sample_links: product.sampleLinks,
                sample_file_urls: [product.sampleImageUrl],
                starting_price: product.startingPrice,
                delivery_days: product.deliveryDays,
                packages: product.packages,
                tax_invoice_available: true,
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
                    sample_links: product.sampleLinks,
                    sample_file_urls: product.sampleImageUrl ? [product.sampleImageUrl] : [],
                    starting_price: product.startingPrice,
                    delivery_days: product.deliveryDays,
                    revision_count: product.revisionCount,
                    created_at: product.createdAt,
                    tax_invoice_available: true,
                    packages: product.packages,
                    status: product.status,
                },
            ],
            error: null,
        })
        const eq = vi.fn(() => ({ order }))
        const select = vi.fn(() => ({ eq }))
        const profileIn = vi.fn().mockResolvedValue({ data: [], error: null })
        const profileSelect = vi.fn(() => ({ in: profileIn }))
        const from = vi.fn((table: string) => (
            table === 'expert_products'
                ? { select }
                : { select: profileSelect }
        ))

        vi.doMock('./supabase', () => ({
            supabase: { from },
        }))

        const { getExpertProducts } = await import('./storage')

        await expect(getExpertProducts()).resolves.toEqual([
            expect.objectContaining({
                ...product,
                expertName: 'AI 전문가',
                expertImageUrl: '',
            }),
        ])
        expect(from).toHaveBeenCalledWith('expert_products')
        expect(select).toHaveBeenCalledWith('*')
        expect(eq).toHaveBeenCalledWith('status', 'published')
    })

    it('adds seller profile names and avatars to Supabase product listings', async () => {
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
                    sample_links: product.sampleLinks,
                    sample_file_urls: product.sampleImageUrl ? [product.sampleImageUrl] : [],
                    starting_price: product.startingPrice,
                    delivery_days: product.deliveryDays,
                    revision_count: product.revisionCount,
                    created_at: product.createdAt,
                    tax_invoice_available: true,
                    packages: product.packages,
                    status: product.status,
                },
            ],
            error: null,
        })
        const productEq = vi.fn(() => ({ order }))
        const productSelect = vi.fn(() => ({ eq: productEq }))
        const profileIn = vi.fn().mockResolvedValue({
            data: [
                {
                    id: product.expertId,
                    name: 'Profile seller',
                    display_name: 'Display seller',
                    avatar_url: 'https://example.com/profile-avatar.jpg',
                },
            ],
            error: null,
        })
        const profileSelect = vi.fn(() => ({ in: profileIn }))
        const from = vi.fn((table: string) => (
            table === 'expert_products'
                ? { select: productSelect }
                : { select: profileSelect }
        ))

        vi.doMock('./supabase', () => ({
            supabase: { from },
        }))

        const { getExpertProducts } = await import('./storage')

        await expect(getExpertProducts()).resolves.toEqual([
            expect.objectContaining({
                expertName: 'Profile seller',
                expertImageUrl: 'https://example.com/profile-avatar.jpg',
            }),
        ])
        expect(from).toHaveBeenCalledWith('profiles')
        expect(profileSelect).toHaveBeenCalledWith('id, name, display_name, avatar_url')
        expect(profileIn).toHaveBeenCalledWith('id', [product.expertId])
    })

    it('falls back to expert profile images when the basic profile row has no avatar', async () => {
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
                    sample_links: product.sampleLinks,
                    sample_file_urls: product.sampleImageUrl ? [product.sampleImageUrl] : [],
                    starting_price: product.startingPrice,
                    delivery_days: product.deliveryDays,
                    revision_count: product.revisionCount,
                    created_at: product.createdAt,
                    tax_invoice_available: true,
                    packages: product.packages,
                    status: product.status,
                },
            ],
            error: null,
        })
        const productEq = vi.fn(() => ({ order }))
        const productSelect = vi.fn(() => ({ eq: productEq }))
        const basicProfileIn = vi.fn().mockResolvedValue({ data: [], error: null })
        const basicProfileSelect = vi.fn(() => ({ in: basicProfileIn }))
        const expertProfileIn = vi.fn().mockResolvedValue({
            data: [
                {
                    user_id: product.expertId,
                    name: 'Expert profile seller',
                    image_url: 'https://example.com/expert-profile-avatar.jpg',
                },
            ],
            error: null,
        })
        const expertProfileSelect = vi.fn(() => ({ in: expertProfileIn }))
        const from = vi.fn((table: string) => {
            if (table === 'expert_products') return { select: productSelect }
            if (table === 'profiles') return { select: basicProfileSelect }
            return { select: expertProfileSelect }
        })

        vi.doMock('./supabase', () => ({
            supabase: { from },
        }))

        const { getExpertProducts } = await import('./storage')

        await expect(getExpertProducts()).resolves.toEqual([
            expect.objectContaining({
                expertName: 'Expert profile seller',
                expertImageUrl: 'https://example.com/expert-profile-avatar.jpg',
            }),
        ])
        expect(from).toHaveBeenCalledWith('expert_profiles')
        expect(expertProfileSelect).toHaveBeenCalledWith('user_id, name, image_url')
        expect(expertProfileIn).toHaveBeenCalledWith('user_id', [product.expertId])
    })

    it('normalizes Supabase package includes into the UI package shape', async () => {
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
                    sample_links: product.sampleLinks,
                    sample_file_urls: [],
                    starting_price: 50000,
                    delivery_days: 3,
                    revision_count: 1,
                    packages: {
                        standard: {
                            price: 50000,
                            includes: ['영상 1편', '썸네일 1장'],
                            description: '15초 숏폼 영상 1편',
                            deliveryDays: 3,
                            revisionCount: 1,
                        },
                    },
                    status: product.status,
                },
            ],
            error: null,
        })
        const eq = vi.fn(() => ({ order }))
        const select = vi.fn(() => ({ eq }))
        const profileIn = vi.fn().mockResolvedValue({ data: [], error: null })
        const profileSelect = vi.fn(() => ({ in: profileIn }))
        const from = vi.fn((table: string) => (
            table === 'expert_products'
                ? { select }
                : { select: profileSelect }
        ))

        vi.doMock('./supabase', () => ({
            supabase: { from },
        }))

        const { getExpertProducts } = await import('./storage')

        const [loadedProduct] = await getExpertProducts()

        expect(loadedProduct.packages.standard).toEqual({
            name: 'Standard',
            price: 50000,
            deliveryDays: 3,
            revisionCount: 1,
            included: ['영상 1편', '썸네일 1장'],
        })
        expect(loadedProduct.packages.deluxe).toBeNull()
        expect(loadedProduct.packages.premium).toBeNull()
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
                avatar_url: null,
            }),
            { onConflict: 'id' },
        )
    })

    it('stores OAuth avatar metadata on the basic user profile row', async () => {
        vi.resetModules()
        const upsert = vi.fn().mockResolvedValue({ error: null })
        const from = vi.fn(() => ({ upsert }))

        vi.doMock('./supabase', () => ({
            supabase: { from },
        }))

        const { ensureUserProfile } = await import('./storage')

        await ensureUserProfile({
            ...user,
            user_metadata: { display_name: '테스터', avatar_url: 'https://example.com/oauth-avatar.jpg' },
        })

        expect(upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                avatar_url: 'https://example.com/oauth-avatar.jpg',
            }),
            { onConflict: 'id' },
        )
    })

    it('loads the basic user profile image for shared profile display', async () => {
        vi.resetModules()
        const single = vi.fn().mockResolvedValue({
            data: {
                name: '테스터',
                display_name: 'Tester',
                avatar_url: 'https://example.com/basic-avatar.jpg',
                is_expert: false,
            },
            error: null,
        })
        const eq = vi.fn(() => ({ single }))
        const select = vi.fn(() => ({ eq }))
        const from = vi.fn(() => ({ select }))

        vi.doMock('./supabase', () => ({
            supabase: { from },
        }))

        const { getUserDisplayProfile } = await import('./storage')

        await expect(getUserDisplayProfile('user-test-01')).resolves.toEqual({
            name: '테스터',
            imageUrl: 'https://example.com/basic-avatar.jpg',
            isExpert: false,
        })
        expect(from).toHaveBeenCalledWith('profiles')
        expect(select).toHaveBeenCalledWith('name, display_name, avatar_url, is_expert')
    })

    it('deletes the current public profile row for account withdrawal', async () => {
        vi.resetModules()
        const eq = vi.fn().mockResolvedValue({ error: null })
        const deleteQuery = vi.fn(() => ({ eq }))
        const from = vi.fn(() => ({ delete: deleteQuery }))

        vi.doMock('./supabase', () => ({
            supabase: { from },
        }))

        const { deleteUserPublicAccountData } = await import('./storage')

        await deleteUserPublicAccountData('user-test-01')

        expect(from).toHaveBeenCalledWith('profiles')
        expect(deleteQuery).toHaveBeenCalledTimes(1)
        expect(eq).toHaveBeenCalledWith('id', 'user-test-01')
    })

    it('stores and loads expert contact availability fields through Supabase', async () => {
        vi.resetModules()
        const profile: ExpertProfile = {
            imageUrl: 'https://example.com/profile.jpg',
            profession: 'AI video',
            name: 'Rumi AI Studio',
            oneLiner: '',
            greeting: '',
            activities: [],
            awards: [],
            aiTools: ['Runway'],
            editTools: [],
            sampleLinks: [],
            contactAvailableTime: '평일 10:00-18:00',
            averageResponseTime: '평균 2시간 이내',
            packages: {
                standard: { price: '', description: '', workDays: '', revisions: '', features: [''] },
                deluxe: { price: '', description: '', workDays: '', revisions: '', features: [''] },
                premium: { price: '', description: '', workDays: '', revisions: '', features: [''] },
            },
        }
        const profileUpdateEq = vi.fn().mockResolvedValue({ error: null })
        const profileUpdate = vi.fn(() => ({ eq: profileUpdateEq }))
        const upsert = vi.fn().mockResolvedValue({ error: null })
        const single = vi.fn().mockResolvedValue({
            data: {
                user_id: user.id,
                image_url: profile.imageUrl,
                profession: profile.profession,
                name: profile.name,
                one_liner: '',
                greeting: '',
                activities: [],
                awards: [],
                ai_tools: profile.aiTools,
                edit_tools: [],
                sample_links: [],
                contact_available_time: profile.contactAvailableTime,
                average_response_time: profile.averageResponseTime,
                packages: profile.packages,
                updated_at: '2026-06-17T00:00:00.000Z',
            },
            error: null,
        })
        const eq = vi.fn(() => ({ single }))
        const select = vi.fn(() => ({ eq }))
        const from = vi.fn((table: string) => {
            if (table === 'profiles') return { update: profileUpdate }
            return { upsert, select }
        })

        vi.doMock('./supabase', () => ({
            supabase: { from },
        }))

        const { getStoredProfile, saveProfile } = await import('./storage')

        await saveProfile(user.id, profile)

        expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
            contact_available_time: '평일 10:00-18:00',
            average_response_time: '평균 2시간 이내',
        }))
        await expect(getStoredProfile(user.id)).resolves.toEqual(
            expect.objectContaining({
                contactAvailableTime: '평일 10:00-18:00',
                averageResponseTime: '평균 2시간 이내',
            }),
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
    expiresAt: futureIsoDate(),
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

        const uuidRequest = {
            ...request,
            clientId: '11111111-1111-4111-8111-111111111111',
            expertId: '22222222-2222-4222-8222-222222222222',
            productId: '33333333-3333-4333-8333-333333333333',
        }

        await saveServiceRequest(uuidRequest)

        expect(from).toHaveBeenCalledWith('service_requests')
        expect(insert).toHaveBeenCalledWith([
            expect.objectContaining({
                client_id: uuidRequest.clientId,
                expert_id: uuidRequest.expertId,
                product_id: uuidRequest.productId,
                selected_package: uuidRequest.selectedPackage,
                desired_result: uuidRequest.desiredResult,
                purpose: uuidRequest.purpose,
                reference_text: uuidRequest.referenceText,
                reference_links: uuidRequest.referenceLinks,
                progress_type: uuidRequest.progressType,
                checklist: uuidRequest.checklist,
                status: 'submitted',
            }),
        ])
    })

    it('saves board request fields and omits non-uuid foreign keys for Supabase inserts', async () => {
        vi.resetModules()
        const insert = vi.fn().mockResolvedValue({ error: null })
        const from = vi.fn(() => ({ insert }))
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { saveRequest } = await import('./storage')
        const clientId = '11111111-1111-4111-8111-111111111111'

        await saveRequest(
            {
                id: 12345,
                title: 'QA Test Request',
                description: 'QA 요청 상세',
                budget: '45000',
                deadline: '2026-06-01',
                categories: ['AI 영상/숏폼'],
                createdAt: '2026. 5. 21.',
                status: 'pending',
                productId: 'product-ai-shortform-01',
                expertId: 'expert-video-01',
                selectedPackage: 'standard',
                desiredResult: 'QA Test Request',
                purpose: '다른 전문가 계정에서 보여야 합니다.',
                referenceText: '',
                referenceLinks: [],
                progressType: 'single',
            },
            clientId,
        )

        const payload = insert.mock.calls[0][0][0]
        expect(payload).toEqual(
            expect.objectContaining({
                client_id: clientId,
                title: 'QA Test Request',
                description: '다른 전문가 계정에서 보여야 합니다.',
                budget: 45000,
                categories: ['AI 영상/숏폼'],
                status: 'submitted',
            }),
        )
        expect(payload).not.toHaveProperty('product_id')
        expect(payload).not.toHaveProperty('expert_id')
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
                    created_at: '2026-06-01T12:34:56.000Z',
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

    it('loads board-ready service requests from Supabase', async () => {
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
                    title: '게시판 제목',
                    description: '게시판 설명',
                    budget: 88000,
                    categories: ['AI 영상/숏폼'],
                    status: 'submitted',
                    created_at: '2026-06-01T12:34:56.000Z',
                },
            ],
            error: null,
        })
        const isExpertNull = vi.fn(() => ({ order }))
        const isProductNull = vi.fn(() => ({ is: isExpertNull }))
        const select = vi.fn(() => ({ is: isProductNull }))
        const from = vi.fn(() => ({ select }))
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { getStoredRequests } = await import('./storage')

        await expect(getStoredRequests()).resolves.toEqual([
            expect.objectContaining({
                id: request.id,
                title: '게시판 제목',
                description: '게시판 설명',
                budget: '88000',
                categories: ['AI 영상/숏폼'],
                clientId: request.clientId,
                expertId: request.expertId,
                productId: request.productId,
                selectedPackage: request.selectedPackage,
                desiredResult: request.desiredResult,
                purpose: request.purpose,
                referenceText: request.referenceText,
                referenceLinks: request.referenceLinks,
                progressType: request.progressType,
                status: 'pending',
            }),
        ])
        expect(from).toHaveBeenCalledWith('service_requests')
        expect(isProductNull).toHaveBeenCalledWith('product_id', null)
        expect(isExpertNull).toHaveBeenCalledWith('expert_id', null)
    })

    it('keeps product-directed requests out of the local request board', async () => {
        vi.resetModules()
        localStorage.clear()
        vi.doMock('./supabase', () => ({ supabase: null }))
        localStorage.setItem(
            'ai_requests',
            JSON.stringify([
                {
                    id: 'public-board-request',
                    title: '공개 요청',
                    description: '전문가 제안을 받는 공개 요청',
                    budget: '70000',
                    deadline: '2026-06-01',
                    categories: ['AI 영상/숏폼'],
                    createdAt: '2026. 5. 17.',
                    clientId: request.clientId,
                    status: 'pending',
                },
                {
                    id: request.id,
                    title: request.desiredResult,
                    description: request.purpose,
                    budget: '70000',
                    deadline: request.deadline,
                    categories: ['AI 영상/숏폼'],
                    createdAt: '2026. 5. 17.',
                    clientId: request.clientId,
                    expertId: request.expertId,
                    productId: request.productId,
                    status: 'pending',
                    selectedPackage: request.selectedPackage,
                    desiredResult: request.desiredResult,
                    purpose: request.purpose,
                    referenceText: request.referenceText,
                    referenceLinks: request.referenceLinks,
                    progressType: request.progressType,
                },
            ]),
        )

        const { getStoredRequests } = await import('./storage')

        await expect(getStoredRequests()).resolves.toEqual([
            expect.objectContaining({ id: 'public-board-request' }),
        ])
    })

    it('loads user-visible service requests including product-directed requests', async () => {
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
                    title: request.desiredResult,
                    description: request.purpose,
                    budget: 70000,
                    categories: ['AI 영상/숏폼'],
                    status: 'submitted',
                    created_at: '2026-06-01T12:34:56.000Z',
                },
            ],
            error: null,
        })
        const or = vi.fn(() => ({ order }))
        const select = vi.fn(() => ({ or }))
        const from = vi.fn(() => ({ select }))
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { getUserServiceRequests } = await import('./storage')

        await expect(getUserServiceRequests(request.expertId)).resolves.toEqual([
            expect.objectContaining({
                id: request.id,
                expertId: request.expertId,
                productId: request.productId,
                title: request.desiredResult,
                createdAt: '2026-06-01T12:34:56.000Z',
            }),
        ])
        expect(from).toHaveBeenCalledWith('service_requests')
        expect(or).toHaveBeenCalledWith(`client_id.eq.${request.expertId},expert_id.eq.${request.expertId}`)
    })

    it('saves and accepts proposals through Supabase', async () => {
        vi.resetModules()
        const proposalSingle = vi.fn().mockResolvedValue({ data: { id: 'proposal-db-01' }, error: null })
        const proposalSelect = vi.fn(() => ({ single: proposalSingle }))
        const insert = vi.fn(() => ({ select: proposalSelect }))
        const stepInsert = vi.fn().mockResolvedValue({ error: null })
        const workSingle = vi.fn().mockResolvedValue({ data: { id: work.id }, error: null })
        const workSelect = vi.fn(() => ({ single: workSingle }))
        const workInsert = vi.fn(() => ({ select: workSelect }))
        const proposalEq = vi.fn().mockResolvedValue({ error: null })
        const proposalUpdate = vi.fn(() => ({ eq: proposalEq }))
        const requestEq = vi.fn().mockResolvedValue({ error: null })
        const requestUpdate = vi.fn(() => ({ eq: requestEq }))
        const from = vi.fn((table: string) => {
            if (table === 'works') return { insert: workInsert }
            if (table === 'work_steps') return { insert: stepInsert }
            if (table === 'service_requests') return { update: requestUpdate }
            return { insert, update: proposalUpdate }
        })
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { saveProposal, acceptProposal } = await import('./storage')

        await expect(saveProposal(proposal)).resolves.toBe('proposal-db-01')
        await expect(acceptProposal(proposal)).resolves.toBe(work.id)

        expect(from).toHaveBeenCalledWith('proposals')
        expect(insert).toHaveBeenCalledWith([
            expect.objectContaining({
                request_id: proposal.requestId,
                total_price: proposal.totalPrice,
                payment_status: 'unpaid',
                platform_fee_rate: 0,
                expires_at: proposal.expiresAt,
            }),
        ])
        expect(proposalSelect).toHaveBeenCalledWith('id')
        expect(proposalSingle).toHaveBeenCalled()
        expect(proposalUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'accepted',
                payment_status: 'paid',
                platform_fee_rate: 0,
            }),
        )
        expect(from).toHaveBeenCalledWith('works')
        expect(workInsert).toHaveBeenCalledWith([
            expect.objectContaining({
                proposal_id: proposal.id,
                total_price: proposal.totalPrice,
                platform_fee: 0,
                expert_payout: 70000,
                settlement_status: 'held',
            }),
        ])
        expect(workSelect).toHaveBeenCalledWith('id')
        expect(from).toHaveBeenCalledWith('work_steps')
        expect(stepInsert).toHaveBeenCalledWith([
            expect.objectContaining({
                work_id: work.id,
                step_order: 1,
                title: '콘셉트 확인',
                status: 'in_progress',
            }),
            expect.objectContaining({
                work_id: work.id,
                step_order: 2,
                title: '1차 시안',
                status: 'waiting',
            }),
            expect.objectContaining({
                work_id: work.id,
                step_order: 3,
                title: '최종 제출',
                status: 'waiting',
            }),
        ])
        expect(from).toHaveBeenCalledWith('service_requests')
        expect(requestUpdate).toHaveBeenCalledWith({ status: 'in_progress' })
        expect(requestEq).toHaveBeenCalledWith('id', proposal.requestId)
    })

    it('keeps local proposal and request status in sync when accepting proposals', async () => {
        vi.resetModules()
        localStorage.clear()
        vi.doMock('./supabase', () => ({ supabase: null }))
        localStorage.setItem(
            'ai_requests',
            JSON.stringify([
                {
                    id: request.id,
                    title: request.desiredResult,
                    description: request.purpose,
                    budget: '70000',
                    deadline: request.deadline,
                    categories: ['AI 영상/숏폼'],
                    createdAt: '2026. 5. 17.',
                    clientId: request.clientId,
                    expertId: request.expertId,
                    status: 'pending',
                    productId: request.productId,
                    selectedPackage: request.selectedPackage,
                    desiredResult: request.desiredResult,
                    purpose: request.purpose,
                    referenceText: request.referenceText,
                    referenceLinks: request.referenceLinks,
                    progressType: request.progressType,
                },
            ]),
        )
        localStorage.setItem('ai_proposals', JSON.stringify([proposal]))

        const { acceptProposal, getStoredRequests, getUserProposals } = await import('./storage')

        await expect(acceptProposal(proposal)).resolves.toBe(`work-${proposal.id}`)
        const updatedRequests = JSON.parse(localStorage.getItem('ai_requests') || '[]')
        expect(updatedRequests).toEqual([
            expect.objectContaining({ id: request.id, status: 'in_progress' }),
        ])
        await expect(getStoredRequests()).resolves.toEqual([])
        await expect(getUserProposals(request.clientId)).resolves.toEqual([
            expect.objectContaining({ id: proposal.id, status: 'accepted', paymentStatus: 'paid' }),
        ])
    })

    it('does not create duplicate local work when a paid proposal is accepted again', async () => {
        vi.resetModules()
        localStorage.clear()
        vi.doMock('./supabase', () => ({ supabase: null }))
        localStorage.setItem('ai_proposals', JSON.stringify([{ ...proposal, status: 'accepted', paymentStatus: 'paid' }]))
        localStorage.setItem(
            'ai_works',
            JSON.stringify([
                {
                    ...work,
                    id: 'work-existing-paid-01',
                    proposalId: proposal.id,
                },
            ]),
        )

        const { acceptProposal, getUserWorks } = await import('./storage')

        await expect(acceptProposal({ ...proposal, status: 'accepted', paymentStatus: 'paid' })).resolves.toBe('work-existing-paid-01')
        await expect(getUserWorks(proposal.clientId)).resolves.toHaveLength(1)
    })

    it('does not create duplicate Supabase work when a paid proposal is accepted again', async () => {
        vi.resetModules()
        const existingWorkSingle = vi.fn().mockResolvedValue({ data: { id: 'work-existing-db-01' }, error: null })
        const existingWorkEq = vi.fn(() => ({ single: existingWorkSingle }))
        const workSelect = vi.fn(() => ({ eq: existingWorkEq }))
        const workInsert = vi.fn()
        const proposalUpdate = vi.fn()
        const from = vi.fn((table: string) => {
            if (table === 'works') return { select: workSelect, insert: workInsert }
            if (table === 'proposals') return { update: proposalUpdate }
            return {}
        })
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { acceptProposal } = await import('./storage')

        await expect(acceptProposal({ ...proposal, status: 'accepted', paymentStatus: 'paid' })).resolves.toBe('work-existing-db-01')
        expect(from).toHaveBeenCalledWith('works')
        expect(workSelect).toHaveBeenCalledWith('id')
        expect(existingWorkEq).toHaveBeenCalledWith('proposal_id', proposal.id)
        expect(workInsert).not.toHaveBeenCalled()
        expect(proposalUpdate).not.toHaveBeenCalled()
    })

    it('keeps the full local paid work lifecycle ordered around the latest deliverable', async () => {
        vi.resetModules()
        localStorage.clear()
        vi.doMock('./supabase', () => ({ supabase: null }))
        localStorage.setItem(
            'ai_requests',
            JSON.stringify([
                {
                    id: request.id,
                    title: request.desiredResult,
                    description: request.purpose,
                    budget: '70000',
                    deadline: request.deadline,
                    categories: ['AI 영상/숏폼'],
                    createdAt: '2026. 5. 17.',
                    clientId: request.clientId,
                    expertId: request.expertId,
                    status: 'pending',
                    productId: request.productId,
                    selectedPackage: request.selectedPackage,
                    desiredResult: request.desiredResult,
                    purpose: request.purpose,
                    referenceText: request.referenceText,
                    referenceLinks: request.referenceLinks,
                    progressType: request.progressType,
                },
            ]),
        )
        localStorage.setItem('ai_proposals', JSON.stringify([proposal]))

        const {
            acceptProposal,
            approveWorkDeliverable,
            getStoredRequests,
            getUserProposals,
            getWorkroomData,
            requestWorkRevision,
            saveDeliverable,
        } = await import('./storage')

        const workId = await acceptProposal(proposal)

        await expect(getUserProposals(proposal.clientId)).resolves.toEqual([
            expect.objectContaining({ id: proposal.id, status: 'accepted', paymentStatus: 'paid' }),
        ])

        let workroom = await getWorkroomData(workId)
        expect(workroom.work).toEqual(
            expect.objectContaining({
                id: workId,
                status: 'in_progress',
                settlementStatus: 'held',
                totalPrice: proposal.totalPrice,
                platformFee: 0,
                expertPayout: 70000,
                revisionLimit: proposal.revisionCount,
                revisionUsed: 0,
            }),
        )

        const firstStep = workroom.steps[0]
        const firstDeliverable: Deliverable = {
            id: 'deliverable-first-flow',
            workId,
            stepId: firstStep.id,
            expertId: proposal.expertId,
            description: '1차 제출물 링크',
            externalUrl: 'https://example.com/first-flow',
            status: 'submitted',
            submittedAt: '2026-06-01T00:00:00.000Z',
        }
        await saveDeliverable(firstDeliverable)
        await requestWorkRevision(workId, firstDeliverable.id, firstStep.id)

        workroom = await getWorkroomData(workId)
        expect(workroom.work).toEqual(expect.objectContaining({ status: 'revision_requested', revisionUsed: 1 }))
        expect(workroom.deliverables[0]).toEqual(expect.objectContaining({ id: firstDeliverable.id, status: 'revision_requested' }))

        const revisedDeliverable: Deliverable = {
            ...firstDeliverable,
            id: 'deliverable-revision-flow',
            description: '수정본 링크',
            externalUrl: 'https://example.com/revision-flow',
            submittedAt: '2026-06-02T00:00:00.000Z',
            status: 'submitted',
        }
        await saveDeliverable(revisedDeliverable)

        workroom = await getWorkroomData(workId)
        expect(workroom.work).toEqual(expect.objectContaining({ status: 'submitted' }))
        expect(workroom.steps[0]).toEqual(expect.objectContaining({ status: 'submitted' }))
        expect(workroom.deliverables[0]).toEqual(
            expect.objectContaining({ id: revisedDeliverable.id, description: '수정본 링크', status: 'submitted' }),
        )

        await approveWorkDeliverable(workId, revisedDeliverable.id, proposal.requestId, firstStep.id)

        workroom = await getWorkroomData(workId)
        expect(workroom.work).toEqual(expect.objectContaining({ status: 'completed', settlementStatus: 'pending' }))
        await expect(getStoredRequests()).resolves.toEqual([])
        expect(JSON.parse(localStorage.getItem('ai_requests') || '[]')).toEqual([
            expect.objectContaining({ id: proposal.requestId, status: 'completed' }),
        ])
    })

    it('blocks local revision requests after the proposal revision count is used', async () => {
        vi.resetModules()
        localStorage.clear()
        vi.doMock('./supabase', () => ({ supabase: null }))
        localStorage.setItem('ai_works', JSON.stringify([{ ...work, revisionLimit: 1, revisionUsed: 1 }]))
        localStorage.setItem('ai_deliverables', JSON.stringify([deliverable]))
        localStorage.setItem('ai_work_steps', JSON.stringify([step]))

        const { requestWorkRevision } = await import('./storage')

        await expect(requestWorkRevision(work.id, deliverable.id, deliverable.stepId)).rejects.toThrow(
            '수정 요청 가능 횟수를 모두 사용했습니다.',
        )

        expect(JSON.parse(localStorage.getItem('ai_works') || '[]')).toEqual([
            expect.objectContaining({ id: work.id, status: 'in_progress', revisionUsed: 1 }),
        ])
    })

    it('marks cancelled local work as fee-excluded refund pending instead of refunded', async () => {
        vi.resetModules()
        localStorage.clear()
        vi.doMock('./supabase', () => ({ supabase: null }))
        localStorage.setItem('ai_works', JSON.stringify([work]))

        const { cancelWork } = await import('./storage')

        await cancelWork(work.id, 'before_start')

        expect(JSON.parse(localStorage.getItem('ai_works') || '[]')).toEqual([
            expect.objectContaining({
                id: work.id,
                status: 'cancelled',
                settlementStatus: 'held',
                refundStatus: 'fee_excluded_refund_pending',
                cancellationReason: 'before_start',
            }),
        ])
    })

    it('marks revised local work as submitted again after resubmission', async () => {
        vi.resetModules()
        localStorage.clear()
        vi.doMock('./supabase', () => ({ supabase: null }))
        localStorage.setItem(
            'ai_works',
            JSON.stringify([
                {
                    ...work,
                    status: 'revision_requested',
                },
            ]),
        )
        localStorage.setItem(
            'ai_work_steps',
            JSON.stringify([
                {
                    ...step,
                    status: 'revision_requested',
                },
            ]),
        )

        const { saveDeliverable, getUserWorks, getWorkroomData } = await import('./storage')

        await saveDeliverable({
            ...deliverable,
            description: '수정본 링크',
            status: 'submitted',
        })

        await expect(getUserWorks(work.clientId)).resolves.toEqual([
            expect.objectContaining({ id: work.id, status: 'submitted' }),
        ])
        await expect(getWorkroomData(work.id)).resolves.toEqual(
            expect.objectContaining({
                steps: [expect.objectContaining({ id: step.id, status: 'submitted' })],
                deliverables: [expect.objectContaining({ description: '수정본 링크', status: 'submitted' })],
            }),
        )
    })

    it('finds an existing local work by proposal id', async () => {
        vi.resetModules()
        localStorage.clear()
        vi.doMock('./supabase', () => ({ supabase: null }))
        localStorage.setItem(
            'ai_works',
            JSON.stringify([
                {
                    id: 'work-existing-01',
                    proposalId: proposal.id,
                    requestId: proposal.requestId,
                    clientId: proposal.clientId,
                    expertId: proposal.expertId,
                    title: proposal.title,
                    progressType: proposal.progressType,
                    status: 'in_progress',
                    stepIds: [],
                },
            ]),
        )

        const { getWorkByProposal } = await import('./storage')

        await expect(getWorkByProposal(proposal.id)).resolves.toEqual(
            expect.objectContaining({ id: 'work-existing-01', proposalId: proposal.id }),
        )
        await expect(getWorkByProposal('missing-proposal')).resolves.toBeNull()
    })

    it('blocks accepting expired proposals before creating work', async () => {
        vi.resetModules()
        const from = vi.fn()
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { acceptProposal } = await import('./storage')

        await expect(
            acceptProposal({
                ...proposal,
                status: 'expired',
                expiresAt: '2000-01-01T00:00:00.000Z',
            }),
        ).rejects.toThrow('만료된 제안서는 승인할 수 없습니다.')
        expect(from).not.toHaveBeenCalled()
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

        await expect(getUserProposals(request.clientId)).resolves.toEqual([
            { ...proposal, paymentStatus: 'unpaid', platformFeeRate: 0 },
        ])
        expect(from).toHaveBeenCalledWith('proposals')
        expect(or).toHaveBeenCalledWith(`client_id.eq.${request.clientId},expert_id.eq.${request.clientId}`)
        expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    })

    it('normalizes object milestones from Supabase proposals into renderable titles', async () => {
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
                    progress_type: 'milestone',
                    milestones: [
                        { title: '흐름설계', amount: 25000 },
                        { title: '결과물 제출', amount: 50000 },
                    ],
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

        await expect(getUserProposals(request.clientId)).resolves.toEqual([
            expect.objectContaining({
                milestones: ['흐름설계', '결과물 제출'],
            }),
        ])
    })

    it('loads consultation chats and messages from Supabase', async () => {
        vi.resetModules()
        const consultationOrder = vi.fn().mockResolvedValue({
            data: [
                {
                    id: 'consultation-db-01',
                    client_id: request.clientId,
                    expert_id: request.expertId,
                    product_id: request.productId,
                    status: 'open',
                    title: 'AI 숏폼 상담',
                    last_message_at: '2026-06-02T10:00:00.000Z',
                    created_at: '2026-06-02T09:00:00.000Z',
                },
            ],
            error: null,
        })
        const consultationOr = vi.fn(() => ({ order: consultationOrder }))
        const consultationSelect = vi.fn(() => ({ or: consultationOr }))
        const messageOrder = vi.fn().mockResolvedValue({
            data: [
                {
                    id: 'message-db-01',
                    consultation_id: 'consultation-db-01',
                    sender_id: request.clientId,
                    body: '브랜드 소개용 숏폼 상담 가능할까요?',
                    attachment_urls: [],
                    created_at: '2026-06-02T10:00:00.000Z',
                },
            ],
            error: null,
        })
        const messageEq = vi.fn(() => ({ order: messageOrder }))
        const messageSelect = vi.fn(() => ({ eq: messageEq }))
        const from = vi.fn((table: string) => {
            if (table === 'consultation_messages') return { select: messageSelect }
            return { select: consultationSelect }
        })
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { getConsultationMessages, getUserConsultations } = await import('./storage')

        await expect(getUserConsultations(request.clientId)).resolves.toEqual([
            {
                id: 'consultation-db-01',
                clientId: request.clientId,
                expertId: request.expertId,
                productId: request.productId,
                status: 'open',
                title: 'AI 숏폼 상담',
                lastMessageAt: '2026-06-02T10:00:00.000Z',
                createdAt: '2026-06-02T09:00:00.000Z',
            },
        ])
        await expect(getConsultationMessages('consultation-db-01')).resolves.toEqual([
            {
                id: 'message-db-01',
                consultationId: 'consultation-db-01',
                senderId: request.clientId,
                body: '브랜드 소개용 숏폼 상담 가능할까요?',
                attachmentUrls: [],
                createdAt: '2026-06-02T10:00:00.000Z',
            },
        ])
        expect(from).toHaveBeenCalledWith('consultations')
        expect(consultationOr).toHaveBeenCalledWith(`client_id.eq.${request.clientId},expert_id.eq.${request.clientId}`)
        expect(consultationOrder).toHaveBeenCalledWith('last_message_at', { ascending: false })
        expect(messageEq).toHaveBeenCalledWith('consultation_id', 'consultation-db-01')
        expect(messageOrder).toHaveBeenCalledWith('created_at', { ascending: true })
    })

    it('creates a consultation and its first message in Supabase', async () => {
        vi.resetModules()
        const consultationSingle = vi.fn().mockResolvedValue({
            data: {
                id: 'consultation-created-01',
                client_id: request.clientId,
                expert_id: request.expertId,
                product_id: request.productId,
                status: 'open',
                title: 'AI 숏폼 상담',
                last_message_at: '2026-06-02T10:00:00.000Z',
                created_at: '2026-06-02T10:00:00.000Z',
            },
            error: null,
        })
        const consultationSelect = vi.fn(() => ({ single: consultationSingle }))
        const consultationInsert = vi.fn(() => ({ select: consultationSelect }))
        const messageInsert = vi.fn().mockResolvedValue({ error: null })
        const from = vi.fn((table: string) => {
            if (table === 'consultation_messages') return { insert: messageInsert }
            return { insert: consultationInsert }
        })
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { createConsultation } = await import('./storage')

        await expect(createConsultation({
            clientId: request.clientId,
            expertId: request.expertId,
            productId: request.productId,
            title: 'AI 숏폼 상담',
            initialMessage: '작업 범위를 먼저 문의하고 싶습니다.',
        })).resolves.toEqual({
            id: 'consultation-created-01',
            clientId: request.clientId,
            expertId: request.expertId,
            productId: request.productId,
            status: 'open',
            title: 'AI 숏폼 상담',
            lastMessageAt: '2026-06-02T10:00:00.000Z',
            createdAt: '2026-06-02T10:00:00.000Z',
        })
        expect(from).toHaveBeenCalledWith('consultations')
        expect(consultationInsert).toHaveBeenCalledWith({
            client_id: request.clientId,
            expert_id: request.expertId,
            product_id: request.productId,
            title: 'AI 숏폼 상담',
            status: 'open',
        })
        expect(from).toHaveBeenCalledWith('consultation_messages')
        expect(messageInsert).toHaveBeenCalledWith({
            consultation_id: 'consultation-created-01',
            sender_id: request.clientId,
            body: '작업 범위를 먼저 문의하고 싶습니다.',
            attachment_urls: [],
        })
    })

    it('creates a consultation without a first message when no initial message is provided', async () => {
        vi.resetModules()
        const consultationSingle = vi.fn().mockResolvedValue({
            data: {
                id: 'consultation-created-02',
                client_id: request.clientId,
                expert_id: request.expertId,
                product_id: request.productId,
                status: 'open',
                title: 'AI ?륂뤌 ?곷떞',
                last_message_at: '2026-06-02T10:00:00.000Z',
                created_at: '2026-06-02T10:00:00.000Z',
            },
            error: null,
        })
        const consultationSelect = vi.fn(() => ({ single: consultationSingle }))
        const consultationInsert = vi.fn(() => ({ select: consultationSelect }))
        const messageInsert = vi.fn().mockResolvedValue({ error: null })
        const from = vi.fn((table: string) => {
            if (table === 'consultation_messages') return { insert: messageInsert }
            return { insert: consultationInsert }
        })
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { createConsultation } = await import('./storage')

        await expect(createConsultation({
            clientId: request.clientId,
            expertId: request.expertId,
            productId: request.productId,
            title: 'AI ?륂뤌 ?곷떞',
        })).resolves.toEqual({
            id: 'consultation-created-02',
            clientId: request.clientId,
            expertId: request.expertId,
            productId: request.productId,
            status: 'open',
            title: 'AI ?륂뤌 ?곷떞',
            lastMessageAt: '2026-06-02T10:00:00.000Z',
            createdAt: '2026-06-02T10:00:00.000Z',
        })
        expect(from).toHaveBeenCalledWith('consultations')
        expect(from).not.toHaveBeenCalledWith('consultation_messages')
        expect(messageInsert).not.toHaveBeenCalled()
    })

    it('saves a consultation message and refreshes the consultation timestamp in Supabase', async () => {
        vi.resetModules()
        const messageSingle = vi.fn().mockResolvedValue({
            data: {
                id: 'message-created-02',
                consultation_id: 'consultation-db-01',
                sender_id: request.clientId,
                body: '추가 메시지입니다.',
                attachment_urls: [],
                created_at: '2026-06-02T10:05:00.000Z',
            },
            error: null,
        })
        const messageSelect = vi.fn(() => ({ single: messageSingle }))
        const messageInsert = vi.fn(() => ({ select: messageSelect }))
        const consultationEq = vi.fn().mockResolvedValue({ error: null })
        const consultationUpdate = vi.fn(() => ({ eq: consultationEq }))
        const from = vi.fn((table: string) => {
            if (table === 'consultation_messages') return { insert: messageInsert }
            return { update: consultationUpdate }
        })
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { saveConsultationMessage } = await import('./storage')

        await expect(saveConsultationMessage({
            consultationId: 'consultation-db-01',
            senderId: request.clientId,
            body: '추가 메시지입니다.',
        })).resolves.toEqual({
            id: 'message-created-02',
            consultationId: 'consultation-db-01',
            senderId: request.clientId,
            body: '추가 메시지입니다.',
            attachmentUrls: [],
            createdAt: '2026-06-02T10:05:00.000Z',
        })
        expect(from).toHaveBeenCalledWith('consultation_messages')
        expect(messageInsert).toHaveBeenCalledWith({
            consultation_id: 'consultation-db-01',
            sender_id: request.clientId,
            body: '추가 메시지입니다.',
            attachment_urls: [],
        })
        expect(from).toHaveBeenCalledWith('consultations')
        expect(consultationUpdate).toHaveBeenCalledWith({ last_message_at: '2026-06-02T10:05:00.000Z' })
        expect(consultationEq).toHaveBeenCalledWith('id', 'consultation-db-01')
    })

    it('rejects consultation messages that try to move the deal outside the marketplace', async () => {
        vi.resetModules()
        const insert = vi.fn()
        const from = vi.fn(() => ({ insert }))
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { saveConsultationMessage } = await import('./storage')

        await expect(saveConsultationMessage({
            consultationId: 'consultation-db-01',
            senderId: request.clientId,
            body: '카톡으로 이야기해요. 010-1234-5678',
        })).rejects.toThrow('연락처나 외부 결제 유도 문구가 포함되어 있어 메시지를 보낼 수 없습니다.')
        expect(from).not.toHaveBeenCalled()
    })

    it('rejects workroom messages that try to move payment outside the marketplace', async () => {
        vi.resetModules()
        const insert = vi.fn()
        const from = vi.fn(() => ({ insert }))
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { saveWorkMessage } = await import('./storage')

        await expect(saveWorkMessage({
            workId: work.id,
            senderId: request.clientId,
            body: '수수료 아까우니 계좌이체로 따로 거래해요.',
        })).rejects.toThrow('연락처나 외부 결제 유도 문구가 포함되어 있어 메시지를 보낼 수 없습니다.')
        expect(from).not.toHaveBeenCalled()
    })

    it('marks expired user proposals from Supabase as expired', async () => {
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
                    status: 'sent',
                    expires_at: '2000-01-01T00:00:00.000Z',
                },
            ],
            error: null,
        })
        const or = vi.fn(() => ({ order }))
        const select = vi.fn(() => ({ or }))
        const from = vi.fn(() => ({ select }))
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { getUserProposals } = await import('./storage')

        await expect(getUserProposals(request.clientId)).resolves.toEqual([
            expect.objectContaining({ status: 'expired' }),
        ])
    })

    it('updates proposal revision request and cancellation status through Supabase', async () => {
        vi.resetModules()
        const eq = vi.fn().mockResolvedValue({ error: null })
        const update = vi.fn(() => ({ eq }))
        const from = vi.fn(() => ({ update }))
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { cancelProposal, requestProposalRevision } = await import('./storage')

        await requestProposalRevision(proposal.id)
        expect(update).toHaveBeenCalledWith({ status: 'revision_requested' })
        expect(eq).toHaveBeenCalledWith('id', proposal.id)

        await cancelProposal(proposal.id)
        expect(update).toHaveBeenCalledWith({ status: 'cancelled' })
        expect(eq).toHaveBeenCalledWith('id', proposal.id)
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
        const stepUpdateEq = vi.fn().mockResolvedValue({ error: null })
        const stepUpdate = vi.fn(() => ({ eq: stepUpdateEq }))
        const workUpdateEq = vi.fn().mockResolvedValue({ error: null })
        const workUpdate = vi.fn(() => ({ eq: workUpdateEq }))
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
            if (table === 'works') return { select: vi.fn(() => ({ eq: workEq })), update: workUpdate }
            if (table === 'work_steps') return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: stepOrder })) })), update: stepUpdate }
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
            work: {
                ...work,
                totalPrice: 0,
                platformFee: 0,
                expertPayout: 0,
                settlementStatus: 'held',
            },
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
        expect(stepUpdate).toHaveBeenCalledWith({ status: 'submitted' })
        expect(stepUpdateEq).toHaveBeenCalledWith('id', deliverable.stepId)
        expect(workUpdate).toHaveBeenCalledWith({ status: 'submitted' })
        expect(workUpdateEq).toHaveBeenCalledWith('id', deliverable.workId)
    })

    it('marks revised deliverables as submitted again after resubmission through Supabase', async () => {
        vi.resetModules()
        const deliverableInsert = vi.fn().mockResolvedValue({ error: null })
        const stepEq = vi.fn().mockResolvedValue({ error: null })
        const stepUpdate = vi.fn(() => ({ eq: stepEq }))
        const workEq = vi.fn().mockResolvedValue({ error: null })
        const workUpdate = vi.fn(() => ({ eq: workEq }))
        const from = vi.fn((table: string) => {
            if (table === 'deliverables') return { insert: deliverableInsert }
            if (table === 'work_steps') return { update: stepUpdate }
            if (table === 'works') return { update: workUpdate }
            return {}
        })
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { saveDeliverable } = await import('./storage')

        await saveDeliverable({
            ...deliverable,
            description: '수정본 링크',
            status: 'submitted',
        })

        expect(from).toHaveBeenCalledWith('deliverables')
        expect(deliverableInsert).toHaveBeenCalledWith([
            expect.objectContaining({
                work_id: deliverable.workId,
                step_id: deliverable.stepId,
                description: '수정본 링크',
                status: 'submitted',
            }),
        ])
        expect(from).toHaveBeenCalledWith('work_steps')
        expect(stepUpdate).toHaveBeenCalledWith({ status: 'submitted' })
        expect(stepEq).toHaveBeenCalledWith('id', deliverable.stepId)
        expect(from).toHaveBeenCalledWith('works')
        expect(workUpdate).toHaveBeenCalledWith({ status: 'submitted' })
        expect(workEq).toHaveBeenCalledWith('id', deliverable.workId)
    })

    it('blocks external contact details in deliverable descriptions before saving', async () => {
        vi.resetModules()
        const from = vi.fn()
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { saveDeliverable } = await import('./storage')

        await expect(
            saveDeliverable({
                ...deliverable,
                description: '결과물 확인 후 010-1234-5678로 연락 주세요',
            }),
        ).rejects.toThrow('외부 연락처는 입력할 수 없습니다.')
        expect(from).not.toHaveBeenCalled()
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

        await expect(getUserWorks(request.clientId)).resolves.toEqual([{
            ...work,
            totalPrice: 0,
            platformFee: 0,
            expertPayout: 0,
            settlementStatus: 'held',
            stepIds: [],
        }])
        expect(from).toHaveBeenCalledWith('works')
        expect(or).toHaveBeenCalledWith(`client_id.eq.${request.clientId},expert_id.eq.${request.clientId}`)
        expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    })

    it('approves a deliverable and completes its work through Supabase', async () => {
        vi.resetModules()
        const deliverableEq = vi.fn().mockResolvedValue({ error: null })
        const deliverableUpdate = vi.fn(() => ({ eq: deliverableEq }))
        const stepEq = vi.fn().mockResolvedValue({ error: null })
        const stepUpdate = vi.fn(() => ({ eq: stepEq }))
        const workEq = vi.fn().mockResolvedValue({ error: null })
        const workUpdate = vi.fn(() => ({ eq: workEq }))
        const requestEq = vi.fn().mockResolvedValue({ error: null })
        const requestUpdate = vi.fn(() => ({ eq: requestEq }))
        const from = vi.fn((table: string) => {
            if (table === 'deliverables') return { update: deliverableUpdate }
            if (table === 'work_steps') return { update: stepUpdate }
            if (table === 'works') return { update: workUpdate }
            if (table === 'service_requests') return { update: requestUpdate }
            return {}
        })
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { approveWorkDeliverable } = await import('./storage')

        await approveWorkDeliverable(work.id, deliverable.id, work.requestId, deliverable.stepId)

        expect(from).toHaveBeenCalledWith('deliverables')
        expect(deliverableUpdate).toHaveBeenCalledWith({ status: 'approved' })
        expect(deliverableEq).toHaveBeenCalledWith('id', deliverable.id)
        expect(from).toHaveBeenCalledWith('work_steps')
        expect(stepUpdate).toHaveBeenCalledWith({ status: 'approved' })
        expect(stepEq).toHaveBeenCalledWith('id', deliverable.stepId)
        expect(from).toHaveBeenCalledWith('works')
        expect(workUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'completed',
                settlement_status: 'pending',
            }),
        )
        expect(workEq).toHaveBeenCalledWith('id', work.id)
        expect(from).toHaveBeenCalledWith('service_requests')
        expect(requestUpdate).toHaveBeenCalledWith({ status: 'completed' })
        expect(requestEq).toHaveBeenCalledWith('id', work.requestId)
    })

    it('requests a deliverable revision and marks its work as revision requested through Supabase', async () => {
        vi.resetModules()
        const deliverableEq = vi.fn().mockResolvedValue({ error: null })
        const deliverableUpdate = vi.fn(() => ({ eq: deliverableEq }))
        const stepEq = vi.fn().mockResolvedValue({ error: null })
        const stepUpdate = vi.fn(() => ({ eq: stepEq }))
        const workUpdateEq = vi.fn().mockResolvedValue({ error: null })
        const workUpdate = vi.fn(() => ({ eq: workUpdateEq }))
        const workSingle = vi.fn().mockResolvedValue({
            data: { revision_limit: 2, revision_used: 0 },
            error: null,
        })
        const workSelectEq = vi.fn(() => ({ single: workSingle }))
        const workSelect = vi.fn(() => ({ eq: workSelectEq }))
        const from = vi.fn((table: string) => {
            if (table === 'deliverables') return { update: deliverableUpdate }
            if (table === 'work_steps') return { update: stepUpdate }
            if (table === 'works') return { select: workSelect, update: workUpdate }
            return {}
        })
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { requestWorkRevision } = await import('./storage')

        await requestWorkRevision(work.id, deliverable.id, deliverable.stepId)

        expect(from).toHaveBeenCalledWith('deliverables')
        expect(deliverableUpdate).toHaveBeenCalledWith({ status: 'revision_requested' })
        expect(deliverableEq).toHaveBeenCalledWith('id', deliverable.id)
        expect(from).toHaveBeenCalledWith('work_steps')
        expect(stepUpdate).toHaveBeenCalledWith({ status: 'revision_requested' })
        expect(stepEq).toHaveBeenCalledWith('id', deliverable.stepId)
        expect(from).toHaveBeenCalledWith('works')
        expect(workSelect).toHaveBeenCalledWith('revision_limit, revision_used')
        expect(workSelectEq).toHaveBeenCalledWith('id', work.id)
        expect(workUpdate).toHaveBeenCalledWith({ status: 'revision_requested', revision_used: 1 })
        expect(workUpdateEq).toHaveBeenCalledWith('id', work.id)
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

    it('loads reviews for a user from Supabase', async () => {
        vi.resetModules()
        const order = vi.fn().mockResolvedValue({
            data: [
                {
                    id: review.id,
                    work_id: review.workId,
                    client_id: review.clientId,
                    client_name: '김민지',
                    client_image_url: 'https://example.com/client-minji.jpg',
                    expert_id: review.expertId,
                    rating: review.rating,
                    content: review.content,
                    created_at: review.createdAt,
                    price_range_label: '3만 원대',
                    work_duration_days: 2,
                },
            ],
            error: null,
        })
        const or = vi.fn(() => ({ order }))
        const select = vi.fn(() => ({ or }))
        const from = vi.fn(() => ({ select }))
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { getUserReviews } = await import('./storage')

        await expect(getUserReviews(review.clientId)).resolves.toEqual([{
            ...review,
            clientName: '김민지',
            clientImageUrl: 'https://example.com/client-minji.jpg',
            priceRangeLabel: '3만 원대',
            workDurationDays: 2,
        }])
        expect(from).toHaveBeenCalledWith('reviews')
        expect(or).toHaveBeenCalledWith(`client_id.eq.${review.clientId},expert_id.eq.${review.clientId}`)
        expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    })

    it('loads public reviews for an expert from Supabase', async () => {
        vi.resetModules()
        const order = vi.fn().mockResolvedValue({
            data: [
                {
                    id: review.id,
                    work_id: review.workId,
                    client_id: review.clientId,
                    client_name: '김민지',
                    client_image_url: 'https://example.com/client-minji.jpg',
                    expert_id: review.expertId,
                    rating: review.rating,
                    content: review.content,
                    created_at: review.createdAt,
                    price_range_label: '3만 원대',
                    work_duration_days: 2,
                },
            ],
            error: null,
        })
        const eq = vi.fn(() => ({ order }))
        const select = vi.fn(() => ({ eq }))
        const from = vi.fn(() => ({ select }))
        vi.doMock('./supabase', () => ({ supabase: { from } }))

        const { getExpertReviews } = await import('./storage')

        await expect(getExpertReviews(review.expertId)).resolves.toEqual([{
            ...review,
            clientName: '김민지',
            clientImageUrl: 'https://example.com/client-minji.jpg',
            priceRangeLabel: '3만 원대',
            workDurationDays: 2,
        }])
        expect(from).toHaveBeenCalledWith('reviews')
        expect(eq).toHaveBeenCalledWith('expert_id', review.expertId)
        expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
    })

    it('enables the benet9827 demo account to inspect every trade stage and review flow', async () => {
        vi.resetModules()
        localStorage.clear()
        vi.doMock('./supabase', () => ({ supabase: null }))

        const {
            ensureUserProfile,
            getConsultationMessages,
            getExpertProducts,
            getExpertReviews,
            getProposal,
            getRequestById,
            getStoredProfile,
            getUserConsultations,
            getUserProposals,
            getUserReviews,
            getUserServiceRequests,
            getUserWorks,
            getWorkByProposal,
            getWorkMessages,
            getWorkroomData,
        } = await import('./storage')

        const demoUser = {
            id: 'benet-user-01',
            email: 'benet9827@gmail.com',
            user_metadata: { display_name: '석준' },
        }

        await ensureUserProfile(demoUser)

        const [products, requests, proposals, works, consultations, reviews, profile] = await Promise.all([
            getExpertProducts(),
            getUserServiceRequests(demoUser.id),
            getUserProposals(demoUser.id),
            getUserWorks(demoUser.id),
            getUserConsultations(demoUser.id),
            getUserReviews(demoUser.id),
            getStoredProfile(demoUser.id),
        ])

        expect(profile).toEqual(expect.objectContaining({
            name: '석준',
            contactAvailableTime: '평일 10:00-19:00',
            averageResponseTime: '보통 2시간 이내',
        }))
        expect(products.some((item) => item.expertId === demoUser.id)).toBe(true)
        expect(products.some((item) => item.expertId !== demoUser.id)).toBe(true)
        expect(requests.some((item) => item.clientId === demoUser.id && item.expertId !== demoUser.id)).toBe(true)
        expect(requests.some((item) => item.expertId === demoUser.id && item.clientId !== demoUser.id)).toBe(true)
        expect(requests.map((item) => item.status)).toEqual(expect.arrayContaining(['pending', 'in_progress', 'completed']))
        expect(proposals.map((item) => item.status)).toEqual(expect.arrayContaining(['sent', 'accepted', 'revision_requested']))
        expect(proposals.map((item) => item.paymentStatus)).toEqual(expect.arrayContaining(['unpaid', 'paid']))
        expect(works.map((item) => item.status)).toEqual(expect.arrayContaining([
            'in_progress',
            'submitted',
            'revision_requested',
            'completed',
            'cancelled',
        ]))
        expect(works.some((item) => item.clientId === demoUser.id)).toBe(true)
        expect(works.some((item) => item.expertId === demoUser.id)).toBe(true)
        expect(works.some((item) => item.status === 'completed' && item.clientId === demoUser.id)).toBe(true)
        expect(consultations.map((item) => item.status)).toEqual(expect.arrayContaining(['open', 'proposal_sent']))
        expect(reviews[0]).toEqual(expect.objectContaining({
            clientName: expect.any(String),
            clientImageUrl: expect.stringContaining('https://'),
            priceRangeLabel: expect.any(String),
            workDurationDays: expect.any(Number),
        }))

        const submittedWork = works.find((item) => item.status === 'submitted')
        expect(submittedWork).toBeDefined()
        if (!submittedWork) return

        const workroom = await getWorkroomData(submittedWork.id)
        expect(workroom.work).toEqual(expect.objectContaining({ id: submittedWork.id, status: 'submitted' }))
        expect(workroom.steps).toEqual(expect.arrayContaining([
            expect.objectContaining({ status: 'submitted' }),
            expect.objectContaining({ title: '결과물 승인 및 정산' }),
        ]))
        expect(workroom.deliverables).toEqual([
            expect.objectContaining({
                workId: submittedWork.id,
                status: 'submitted',
                externalUrl: expect.stringContaining('https://'),
            }),
        ])

        const demoProposal = proposals.find((item) => item.id === submittedWork.proposalId)
        expect(demoProposal).toBeDefined()
        if (!demoProposal) return

        await expect(getProposal(demoProposal.id)).resolves.toEqual(expect.objectContaining({ id: demoProposal.id }))
        await expect(getWorkByProposal(demoProposal.id)).resolves.toEqual(expect.objectContaining({ id: submittedWork.id }))
        await expect(getRequestById(submittedWork.requestId)).resolves.toEqual(expect.objectContaining({ id: submittedWork.requestId }))
        await expect(getWorkMessages(submittedWork.id)).resolves.toEqual(expect.arrayContaining([
            expect.objectContaining({ workId: submittedWork.id, senderId: demoUser.id }),
        ]))

        const firstConsultation = consultations[0]
        expect(firstConsultation).toBeDefined()
        if (!firstConsultation) return

        await expect(getConsultationMessages(firstConsultation.id)).resolves.toEqual(expect.arrayContaining([
            expect.objectContaining({ consultationId: firstConsultation.id }),
        ]))
        await expect(getExpertReviews(firstConsultation.expertId)).resolves.toEqual(expect.arrayContaining([
            expect.objectContaining({ expertId: firstConsultation.expertId }),
        ]))
    })
})
