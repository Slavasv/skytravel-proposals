import 'server-only'
import { createSupabaseAdmin } from './supabase-admin'
import { graphFetch } from './microsoft'

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

// Отправить письмо от подключённого аккаунта компании (через /me/sendMail).
// Терпимо к ошибкам: возвращает {ok,error}, ничего не роняет.
export async function sendMailForCompany(
    companyId: string,
    to: string,
    subject: string,
    html: string,
): Promise<{ ok: boolean; error?: string }> {
    try {
        const res = await graphFetch(companyId, '/me/sendMail', {
            method: 'POST',
            body: JSON.stringify({
                message: {
                    subject,
                    body: { contentType: 'HTML', content: html },
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
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'unknown' }
    }
}

// Письмо исполнителю о назначенной задаче. Best-effort: если почта не подключена
// или у исполнителя нет адреса — тихо выходим (не мешаем созданию задачи).
export async function sendTaskAssignedEmail(params: {
    companyId: string
    assigneeId: string
    title: string
    description?: string | null
    dueAt?: string | null
    url: string
    lang: 'ru' | 'en'
}): Promise<void> {
    try {
        const admin = createSupabaseAdmin()

        // почта подключена?
        const { data: integ } = await admin
            .from('microsoft_integration')
            .select('refresh_token')
            .eq('company_id', params.companyId)
            .single()
        if (!integ?.refresh_token) return

        // адрес исполнителя: рабочий ms_email приоритетнее логина
        const { data: prof } = await admin
            .from('profiles')
            .select('email, ms_email')
            .eq('id', params.assigneeId)
            .single()
        const to = ((prof?.ms_email as string | null) || (prof?.email as string | null)) ?? null
        if (!to) return

        const ru = params.lang === 'ru'
        const subject = (ru ? 'Новая задача: ' : 'New task: ') + params.title
        const due = params.dueAt
            ? new Date(params.dueAt).toLocaleString(ru ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : null

        const parts = [
            `<p style="font-size:16px;margin:0 0 12px"><b>${escapeHtml(params.title)}</b></p>`,
            params.description ? `<p style="margin:0 0 12px;color:#444;white-space:pre-wrap">${escapeHtml(params.description)}</p>` : '',
            due ? `<p style="margin:0 0 12px;color:#444">${ru ? 'Срок' : 'Due'}: ${escapeHtml(due)}</p>` : '',
            `<p style="margin:20px 0"><a href="${params.url}" style="background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">${ru ? 'Открыть задачу' : 'Open task'}</a></p>`,
        ]
        const html = `<div style="font-family:system-ui,-apple-system,sans-serif;color:#111;font-size:14px;line-height:1.5">${parts.join('')}<p style="font-size:12px;color:#999;margin-top:28px">Travel System</p></div>`

        await sendMailForCompany(params.companyId, to, subject, html)
    } catch {
        /* best-effort — глотаем */
    }
}