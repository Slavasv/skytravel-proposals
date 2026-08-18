'use server'

import { getProfile, canManageBrand } from '@/lib/get-profile'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAccessTokenForCompany, graphFetch } from '@/lib/microsoft'
import { pullPlannerForCompany } from '@/lib/microsoft-planner'

async function myCompanyId(): Promise<string | null> {
    const profile = await getProfile()
    if (!profile || !canManageBrand(profile.role)) return null
    const admin = createSupabaseAdmin()
    const { data: me } = await admin.from('profiles').select('company_id').eq('id', profile.id).single()
    return (me?.company_id as string | undefined) ?? null
}

export async function getMicrosoftStatus(): Promise<{ connected: boolean; email: string | null }> {
    const companyId = await myCompanyId()
    if (!companyId) return { connected: false, email: null }
    const admin = createSupabaseAdmin()
    const { data } = await admin
        .from('microsoft_integration')
        .select('account_email, refresh_token')
        .eq('company_id', companyId)
        .single()
    return { connected: !!data?.refresh_token, email: (data?.account_email as string | null) ?? null }
}

// ---- Planner: список планов, которые видит интеграционный аккаунт ----
// Собираем из двух источников, чтобы ловить и «базовые» планы нового Planner:
//   1) /me/planner/plans (классические планы),
//   2) планы каждой группы, где аккаунт участник (/groups/{id}/planner/plans).
export async function getPlannerPlans(): Promise<{ id: string; title: string }[]> {
    const companyId = await myCompanyId()
    if (!companyId) return []

    const found = new Map<string, string>()

    // 1) напрямую доступные планы
    try {
        const res = await graphFetch(companyId, '/me/planner/plans')
        if (res.ok) {
            const json = (await res.json()) as { value?: { id: string; title: string }[] }
            for (const p of json.value ?? []) if (p?.id) found.set(p.id, p.title || '—')
        }
    } catch { /* ignore */ }

    // 2) планы всех групп, где состоит аккаунт (ловит новые «базовые» планы)
    try {
        const gr = await graphFetch(companyId, '/me/memberOf/microsoft.graph.group?$select=id&$top=200')
        if (gr.ok) {
            const gj = (await gr.json()) as { value?: { id: string }[] }
            const groupIds = (gj.value ?? []).map((g) => g.id).filter(Boolean)
            await Promise.all(
                groupIds.map(async (gid) => {
                    try {
                        const pr = await graphFetch(companyId, `/groups/${gid}/planner/plans`)
                        if (pr.ok) {
                            const pj = (await pr.json()) as { value?: { id: string; title: string }[] }
                            for (const p of pj.value ?? []) if (p?.id) found.set(p.id, p.title || '—')
                        }
                    } catch { /* ignore */ }
                })
            )
        }
    } catch { /* ignore */ }

    return Array.from(found.entries()).map(([id, title]) => ({ id, title }))
}

export async function getSelectedPlan(): Promise<string | null> {
    const companyId = await myCompanyId()
    if (!companyId) return null
    const admin = createSupabaseAdmin()
    const { data } = await admin.from('microsoft_integration').select('plan_id').eq('company_id', companyId).single()
    return (data?.plan_id as string | null) ?? null
}

export async function savePlan(planId: string): Promise<void> {
    const companyId = await myCompanyId()
    if (!companyId) return
    const admin = createSupabaseAdmin()
    await admin
        .from('microsoft_integration')
        .update({ plan_id: planId || null, updated_at: new Date().toISOString() })
        .eq('company_id', companyId)
}

// Ручной запуск входящей синхронизации (Planner → наша система) из настроек.
export async function syncNow(): Promise<{ ok: boolean; updated: number; created: number; error?: string }> {
    const companyId = await myCompanyId()
    if (!companyId) return { ok: false, updated: 0, created: 0, error: 'no access' }
    const res = await pullPlannerForCompany(companyId)
    return { ok: !res.error, updated: res.updated, created: res.created, error: res.error }
}

export async function disconnectMicrosoft(): Promise<void> {
    const companyId = await myCompanyId()
    if (!companyId) return
    const admin = createSupabaseAdmin()
    await admin.from('microsoft_integration').delete().eq('company_id', companyId)
}

export async function sendTestEmail(toEmail: string): Promise<{ ok: boolean; error?: string }> {
    const companyId = await myCompanyId()
    if (!companyId) return { ok: false, error: 'no access' }
    const to = toEmail.trim()
    if (!to) return { ok: false, error: 'no recipient' }

    const token = await getAccessTokenForCompany(companyId)
    if (!token) return { ok: false, error: 'not connected' }

    const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: {
                subject: 'Travel System — тест связи',
                body: { contentType: 'Text', content: 'Тестовое письмо из Travel System. Связь с Microsoft работает ✅' },
                toRecipients: [{ emailAddress: { address: to } }],
            },
            saveToSentItems: true,
        }),
    })
    if (!res.ok) {
        const t = await res.text()
        return { ok: false, error: `Graph ${res.status}: ${t.slice(0, 200)}` }
    }
    return { ok: true }
}