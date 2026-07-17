import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { executeFinancialRpc } from '../_shared/financial-contracts.ts'
import { createServiceClient, getRequiredEnv } from '../_shared/supabase.ts'

const AUTO_PURCHASE_CONFIRM_DAYS = 7
const CANCELLATION_RESPONSE_HOURS = 24

const requireAutomationSecret = (request: Request): Response | null => {
    const expectedSecret = getRequiredEnv('TRADE_AUTOMATION_SECRET')
    const actualSecret = request.headers.get('x-automation-secret')?.trim()
    return actualSecret === expectedSecret
        ? null
        : jsonResponse({ message: 'Automation secret is invalid.' }, { status: 401 })
}

Deno.serve(async (request) => {
    const options = handleOptions(request)
    if (options) return options
    if (request.method !== 'POST') {
        return jsonResponse({ message: 'Only POST requests are supported.' }, { status: 405 })
    }

    const unauthorized = requireAutomationSecret(request)
    if (unauthorized) return unauthorized

    try {
        const now = new Date()
        const result = await executeFinancialRpc(createServiceClient(), 'claim_due_trade_automation', {
            p_auto_cancel_before: new Date(
                now.getTime() - CANCELLATION_RESPONSE_HOURS * 60 * 60 * 1000,
            ).toISOString(),
            p_auto_confirm_before: new Date(
                now.getTime() - AUTO_PURCHASE_CONFIRM_DAYS * 24 * 60 * 60 * 1000,
            ).toISOString(),
            p_batch_size: 100,
            p_run_key: `automation:${now.toISOString().slice(0, 13)}`,
        })
        const attempted = result.attempted
        const succeeded = result.succeeded
        const skipped = result.skipped
        const failed = result.failed
        if (typeof attempted !== 'number'
            || typeof succeeded !== 'number'
            || typeof skipped !== 'number'
            || typeof failed !== 'number'
            || attempted !== succeeded + skipped + failed) {
            return jsonResponse({ message: 'Automation count conservation failed.' }, { status: 500 })
        }
        return jsonResponse(result)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Trade automation failed.'
        return jsonResponse({ message }, { status: 500 })
    }
})
