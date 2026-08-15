'use server'

import { createSupabaseServer } from '@/lib/supabase-server'

// Сохранить/обновить подписку текущего браузера сотрудника.
export async function savePushSubscription(sub: { endpoint: string; p256dh: string; auth: string }): Promise<{ ok: boolean }> {
    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false }
    const { data: me } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()

    const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
            { profile_id: user.id, company_id: me?.company_id ?? null, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            { onConflict: 'endpoint' }
        )
    return { ok: !error }
}

// Отписать этот браузер (по endpoint).
export async function deletePushSubscription(endpoint: string): Promise<void> {
    const supabase = await createSupabaseServer()
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}