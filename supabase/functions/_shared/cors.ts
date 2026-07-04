export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const

export const jsonResponse = (body: unknown, init?: ResponseInit): Response =>
    new Response(JSON.stringify(body), {
        ...init,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    })

export const handleOptions = (request: Request): Response | null =>
    request.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null
