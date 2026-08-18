'use server'

import { getProfile, canManageBrand } from '@/lib/get-profile'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getAccessTokenForCompany, graphFetch } from '@/lib/microsoft'

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
export async function getPlannerPlans(): Promise<{ id: string; title: string }[]> {
  const companyId = await myCompanyId()
  if (!companyId) return []
  try {
    const res = await graphFetch(companyId, '/me/planner/plans')
    if (!res.ok) return []
    const json = (await res.json()) as { value?: { id: string; title: string }[] }
    return (json.value ?? []).map((p) => ({ id: p.id, title: p.title }))
  } catch {
    return []
  }
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