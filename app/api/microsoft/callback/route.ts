import { NextRequest, NextResponse } from 'next/server'
import { getProfile, canManageBrand } from '@/lib/get-profile'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { exchangeCode } from '@/lib/microsoft'

// Возврат от Microsoft: меняем code на токены, сохраняем refresh для компании.
export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const oauthError = url.searchParams.get('error')
    const oauthErrorDesc = url.searchParams.get('error_description')
    const savedState = req.cookies.get('ms_oauth_state')?.value

    const fail = (reason: string) => {
        const to = new URL('/admin/settings', req.url)
        to.searchParams.set('ms', 'error')
        to.searchParams.set('reason', reason.slice(0, 300))
        const res = NextResponse.redirect(to)
        res.cookies.delete('ms_oauth_state')
        return res
    }

    if (oauthError) return fail(`ms:${oauthError} ${oauthErrorDesc || ''}`)
    if (!code) return fail('no_code')
    if (!state || !savedState || state !== savedState) return fail('state_mismatch')

    // целевой режим подключения (совпадает с тем, что ставили в connect)
    const target = req.cookies.get('ms_oauth_target')?.value === 'user' ? 'user' : 'company'

    const profile = await getProfile()
    if (!profile) return fail('no_session')
    // общий аккаунт компании — только owner/admin; личный — любой залогиненный
    if (target === 'company' && !canManageBrand(profile.role)) return fail('no_admin_session')

    const admin = createSupabaseAdmin()
    const { data: me } = await admin.from('profiles').select('company_id').eq('id', profile.id).single()
    if (!me?.company_id) return fail('no_company')

    const redirectUri = new URL('/api/microsoft/callback', req.url).toString()
    const tok = await exchangeCode(code, redirectUri)
    if (tok.error || !tok.refresh_token || !tok.access_token) {
        return fail(`token:${tok.error || 'no_refresh'} ${tok.error_description || ''}`)
    }

    // кто именно подключился (email/имя аккаунта)
    let email: string | null = null
    let name: string | null = null
    try {
        const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${tok.access_token}` },
        })
        if (meRes.ok) {
            const meJson = (await meRes.json()) as { mail?: string; userPrincipalName?: string; displayName?: string }
            email = meJson.mail || meJson.userPrincipalName || null
            name = meJson.displayName || null
        }
    } catch { /* ignore */ }

    if (target === 'user') {
        // Вариант А: личный токен сотрудника
        await admin.from('microsoft_user_tokens').upsert(
            {
                user_id: profile.id,
                refresh_token: tok.refresh_token,
                account_email: email,
                account_name: name,
                tenant_id: process.env.MS_TENANT_ID || null,
                connected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
        )
        // заодно проставим рабочий ms_email в профиль (для сопоставления в Planner/почте)
        if (email) {
            await admin.from('profiles').update({ ms_email: email.toLowerCase() }).eq('id', profile.id)
        }
    } else {
        // общий аккаунт компании (как было)
        await admin.from('microsoft_integration').upsert(
            {
                company_id: me.company_id,
                account_email: email,
                account_name: name,
                refresh_token: tok.refresh_token,
                tenant_id: process.env.MS_TENANT_ID || null,
                connected_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'company_id' }
        )
    }

    const ok = new URL('/admin/settings', req.url)
    ok.searchParams.set('ms', target === 'user' ? 'me_connected' : 'connected')
    const res = NextResponse.redirect(ok)
    res.cookies.delete('ms_oauth_state')
    res.cookies.delete('ms_oauth_target')
    return res
}