import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { createServiceClient, requireUser } from '../_shared/supabase.ts'
import { handleAccountWithdrawal, type AccountWithdrawalDependencies } from './handler.ts'

const authorizationToken = (request: Request): string => {
    const authorization = request.headers.get('Authorization')?.trim() ?? ''
    const match = /^Bearer\s+(.+)$/i.exec(authorization)
    if (!match?.[1]) throw new Error('Authorization header is required')
    return match[1]
}

const client = createServiceClient()
const dependencies: AccountWithdrawalDependencies = {
    authenticate: async (request) => {
        const user = await requireUser(request)
        return { accessToken: authorizationToken(request), userId: user.id }
    },
    blockAndAnonymize: async (userId) => {
        const { error } = await client.rpc('withdraw_account', { requested_user_id: userId })
        if (error) throw error
    },
    recordSessionRevocation: async (userId, outcome) => {
        const { error } = await client.rpc('record_withdrawal_session_revocation', {
            detail_text: outcome.detail,
            requested_user_id: userId,
            revocation_succeeded: outcome.succeeded,
        })
        if (error) throw error
    },
    revokeGlobalSessions: async (accessToken) => {
        const { error } = await client.auth.admin.signOut(accessToken, 'global')
        if (error) throw error
    },
}

Deno.serve(async (request) => {
    const options = handleOptions(request)
    if (options) return options

    const result = await handleAccountWithdrawal(request, dependencies)
    const body = await result.json()
    return jsonResponse(body, { status: result.status })
})
