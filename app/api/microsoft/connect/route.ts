import { NextRequest, NextResponse } from 'next/server'
import { getProfile, canManageBrand } from '@/lib/get-profile'
import { buildAuthUrl, msConfigured } from '@/lib/microsoft'

// Старт OAuth: только owner/admin. Ставим CSRF-state в куку НА ОТВЕТ-редирект
// (иначе Set-Cookie не прикрепляется к редиректу) и уводим на Microsoft.
export async function GET(req: NextRequest) {
    const profile = await getProfile()
    if (!canManageBrand(profile?.role)) {
        return NextResponse.redirect(new URL('/admin', req.url))
    }
    if (!msConfigured()) {
        return NextResponse.redirect(new URL('/admin/settings?ms=notconfigured', req.url))
    }

    const state = globalThis.crypto.randomUUID()
    const redirectUri = new URL('/api/microsoft/callback', req.url).toString()

    const res = NextResponse.redirect(buildAuthUrl(redirectUri, state))
    res.cookies.set('ms_oauth_state', state, {
        httpOnly: true,
        secure: req.nextUrl.protocol === 'https:',
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
    })
    return res
}