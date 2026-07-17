export type WithdrawalActor = {
    readonly accessToken: string
    readonly userId: string
}

export type SessionRevocationOutcome = {
    readonly detail: string | null
    readonly succeeded: boolean
}

export interface AccountWithdrawalDependencies {
    readonly authenticate: (request: Request) => Promise<WithdrawalActor>
    readonly blockAndAnonymize: (userId: string) => Promise<void>
    readonly recordSessionRevocation: (userId: string, outcome: SessionRevocationOutcome) => Promise<void>
    readonly revokeGlobalSessions: (accessToken: string) => Promise<void>
}

const response = (body: Readonly<Record<string, unknown>>, status: number): Response => new Response(
    JSON.stringify(body),
    { headers: { 'Content-Type': 'application/json' }, status },
)

const errorDetail = (error: unknown): string => error instanceof Error ? error.message : 'unknown error'

export async function handleAccountWithdrawal(
    request: Request,
    dependencies: AccountWithdrawalDependencies,
): Promise<Response> {
    if (request.method !== 'POST') return response({ message: 'Only POST requests are supported.' }, 405)

    let actor: WithdrawalActor
    try {
        actor = await dependencies.authenticate(request)
    } catch {
        return response({ message: 'Authenticated user is required.' }, 401)
    }

    try {
        await dependencies.blockAndAnonymize(actor.userId)
    } catch {
        return response({ accessBlocked: false, message: 'Account access could not be blocked.' }, 500)
    }

    let outcome: SessionRevocationOutcome = { detail: null, succeeded: true }
    try {
        await dependencies.revokeGlobalSessions(actor.accessToken)
    } catch (error) {
        outcome = { detail: errorDetail(error), succeeded: false }
    }

    try {
        await dependencies.recordSessionRevocation(actor.userId, outcome)
    } catch {
        return response({
            accessBlocked: true,
            message: 'The session revocation outcome could not be recorded.',
            sessionRevocation: 'outcome_unrecorded',
        }, 500)
    }

    if (!outcome.succeeded) {
        return response({ accessBlocked: true, sessionRevocation: 'recovery_required' }, 202)
    }
    return response({ accessBlocked: true, sessionRevocation: 'revoked' }, 200)
}
