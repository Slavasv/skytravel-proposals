import 'server-only'
import { createSupabaseAdmin } from './supabase-admin'

const TENANT = process.env.MS_TENANT_ID
const CLIENT_ID = process.env.MS_CLIENT_ID
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET

// Права, которые запрашиваем у аккаунта (совпадают с делегированными в Azure).
export const MS_SCOPES = 'offline_access User.Read User.Read.All Tasks.ReadWrite Group.Read.All Mail.Send'

export function msConfigured(): boolean {
    return !!(TENANT && CLIENT_ID && CLIENT_SECRET)
}

export function buildAuthUrl(redirectUri: string, state: string): string {
    const p = new URLSearchParams({
        client_id: CLIENT_ID || '',
        response_type: 'code',
        redirect_uri: redirectUri,
        response_mode: 'query',
        scope: MS_SCOPES,
        state,
        prompt: 'select_account',
    })
    return `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize?${p.toString()}`
}

type TokenResponse = {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
    error_description?: string
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
    const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
    })
    return (await res.json()) as TokenResponse
}

export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
    return tokenRequest({
        client_id: CLIENT_ID || '',
        client_secret: CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        scope: MS_SCOPES,
    })
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    return tokenRequest({
        client_id: CLIENT_ID || '',
        client_secret: CLIENT_SECRET || '',
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: MS_SCOPES,
    })
}

// Свежий access-токен для компании: берём refresh из БД, обновляем,
// сохраняем ротированный refresh-токен обратно. null — если не подключено/ошибка.
export async function getAccessTokenForCompany(companyId: string): Promise<string | null> {
    const admin = createSupabaseAdmin()
    const { data: row } = await admin
        .from('microsoft_integration')
        .select('refresh_token')
        .eq('company_id', companyId)
        .single()
    const refresh = row?.refresh_token as string | undefined
    if (!refresh) return null

    const tok = await refreshAccessToken(refresh)
    if (tok.error || !tok.access_token) return null

    if (tok.refresh_token && tok.refresh_token !== refresh) {
        await admin
            .from('microsoft_integration')
            .update({ refresh_token: tok.refresh_token, updated_at: new Date().toISOString() })
            .eq('company_id', companyId)
    }
    return tok.access_token
}

// Обёртка над Graph с автоподстановкой токена компании.
export async function graphFetch(companyId: string, path: string, init?: RequestInit): Promise<Response> {
    const token = await getAccessTokenForCompany(companyId)
    if (!token) throw new Error('Microsoft not connected')
    return fetch(`https://graph.microsoft.com/v1.0${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(init?.headers || {}),
        },
    })
}