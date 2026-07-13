import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.103.3'

export type AppUser = {
    readonly id: string
    readonly email?: string
}

export const getRequiredEnv = (name: string): string => {
    const value = Deno.env.get(name)?.trim()
    if (!value) throw new Error(`${name} is required`)
    return value
}

export const createServiceClient = () => createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
)

export async function requireUser(request: Request): Promise<AppUser> {
    const authorization = request.headers.get('Authorization')
    if (!authorization) throw new Error('Authorization header is required')

    const client = createClient(
        getRequiredEnv('SUPABASE_URL'),
        getRequiredEnv('SUPABASE_ANON_KEY'),
        { global: { headers: { Authorization: authorization } } },
    )
    const { data, error } = await client.auth.getUser()

    if (error || !data.user) throw new Error('Authenticated user is required')
    return { id: data.user.id, ...(data.user.email ? { email: data.user.email } : {}) }
}
