import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, requireUser } from '../_shared/supabase.ts'

type DeleteTarget = {
    readonly table: string
    readonly column: string
}

const deleteTargets: readonly DeleteTarget[] = [
    { column: 'user_id', table: 'notification_events' },
    { column: 'user_id', table: 'notification_preferences' },
    { column: 'expert_id', table: 'expert_payout_accounts' },
]

const logOperation = async (
    client: ReturnType<typeof createServiceClient>,
    userId: string,
    eventType: string,
    detail: Record<string, unknown>,
) => {
    await client.from('operation_logs').insert({
        actor_id: userId,
        detail,
        event_type: eventType,
        target_id: userId,
        target_type: 'user',
    })
}

Deno.serve(async (request) => {
    const options = handleOptions(request)
    if (options) return options

    if (request.method !== 'POST') {
        return jsonResponse({ message: 'Only POST requests are supported.' }, { status: 405 })
    }

    let userId = ''
    try {
        const user = await requireUser(request)
        userId = user.id
    } catch {
        return jsonResponse({ message: 'Authenticated user is required.' }, { status: 401 })
    }

    const client = createServiceClient()
    await logOperation(client, userId, 'account_withdrawal_started', {})

    const failures: string[] = []
    for (const target of deleteTargets) {
        const { error } = await client.from(target.table).delete().eq(target.column, userId)
        if (error) failures.push(`${target.table}.${target.column}`)
    }

    const { error: productError } = await client.from('expert_products').update({
        display_order: 0,
        is_featured: false,
        status: 'hidden',
        updated_at: new Date().toISOString(),
    }).eq('expert_id', userId)
    if (productError) failures.push('expert_products.expert_id')

    const { error: profileError } = await client.from('profiles').update({
        account_status: 'restricted',
        ai_tools: [],
        avatar_url: null,
        display_name: '탈퇴한 사용자',
        email: null,
        expert_intro: null,
        interests: [],
        name: '탈퇴한 사용자',
        request_purposes: [],
        sample_links: [],
        updated_at: new Date().toISOString(),
    }).eq('id', userId)
    if (profileError) failures.push('profiles.id')

    if (failures.length > 0) {
        await logOperation(client, userId, 'account_withdrawal_failed', { failures })
        return jsonResponse({ failures, message: 'Failed to delete all account data.' }, { status: 500 })
    }

    await logOperation(client, userId, 'account_withdrawal_completed', {})
    return jsonResponse({ anonymized: true, deleted: true })
})
