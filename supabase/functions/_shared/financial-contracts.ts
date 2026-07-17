import type { createServiceClient } from './supabase.ts'

type ServiceClient = ReturnType<typeof createServiceClient>
type RpcArguments = Readonly<Record<string, boolean | number | string | null | Readonly<Record<string, unknown>>>>

export type FinancialContractResult = Readonly<Record<string, unknown>> & {
    readonly kind?: string
}

export class FinancialContractError extends Error {
    override readonly name = 'FinancialContractError'

    constructor(
        readonly contract: string,
        readonly databaseMessage: string,
    ) {
        super('Financial contract failed')
    }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

export async function executeFinancialRpc(
    client: ServiceClient,
    contract: string,
    arguments_: RpcArguments,
): Promise<FinancialContractResult> {
    const { data, error } = await client.rpc(contract, arguments_)
    if (error) throw new FinancialContractError(contract, error.message)
    if (!isRecord(data)) throw new FinancialContractError(contract, 'Database returned an invalid contract result')
    return data
}

export const requiredString = (result: FinancialContractResult, key: string): string => {
    const value = result[key]
    if (typeof value !== 'string' || value.length === 0) {
        throw new FinancialContractError(key, 'Expected a non-empty string result')
    }
    return value
}

export const optionalString = (result: FinancialContractResult, key: string): string | null => {
    const value = result[key]
    if (value === null || value === undefined) return null
    if (typeof value !== 'string') throw new FinancialContractError(key, 'Expected a string result')
    return value
}

export const requiredNumber = (result: FinancialContractResult, key: string): number => {
    const value = result[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new FinancialContractError(key, 'Expected a finite number result')
    }
    return value
}
