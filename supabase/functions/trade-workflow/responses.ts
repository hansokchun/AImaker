import { jsonResponse } from '../_shared/cors.ts'
import type { RowRecord } from './types.ts'

export const responseError = (message: string, status: number): Response => jsonResponse({ message }, { status })
export const ok = (body: RowRecord = {}): Response => jsonResponse(body)
