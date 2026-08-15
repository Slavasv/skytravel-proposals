import 'server-only'
import webpush from 'web-push'
import { createSupabaseAdmin } from './supabase-admin'

let configured = false
function configure(): boolean {
    if (configured) return true
    const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const priv = process.env.VAPID_PRIVATE_KEY
    const subject = process.env.VAPID_SUBJECT || 'mailto:noreply@skytravel.app'
    if (!pub || !priv) return false
    webpush.setVapidDetails(subject, pub, priv)
    configured = true
    return true
}

type PushPayload = { title: string; body?: string; url?: string; tag?: string }

// Отправить web-push всем браузерам сотрудника. Тихо игнорирует, если ключи не заданы.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!userId) return
    if (!configure()) return

    const admin = createSupabaseAdmin()
    const { data: subs } = await admin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('profile_id', userId)
    if (!subs || subs.length === 0) return

    const body = JSON.stringify(payload)
    await Promise.all(
        subs.map(async (s) => {
            try {
                await webpush.sendNotification(
                    { endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } },
                    body
                )
            } catch (err: unknown) {
                const code = (err as { statusCode?: number })?.statusCode
                // подписка протухла — удаляем, чтобы не копить мусор
                if (code === 404 || code === 410) {
                    await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint as string)
                }
            }
        })
    )
}