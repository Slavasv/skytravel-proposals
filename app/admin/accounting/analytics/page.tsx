import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProfile, canSeeAccounting, getUiLang } from '@/lib/get-profile'
import AnalyticsClient, { type ProfitRow } from './analytics-client'

function one<T>(v: T | T[] | null | undefined): T | null {
    if (v == null) return null
    return Array.isArray(v) ? (v[0] ?? null) : v
}

export default async function AnalyticsPage() {
    const profile = await getProfile()
    if (!canSeeAccounting(profile?.role)) redirect('/admin')
    const lang = await getUiLang()

    const supabase = await createSupabaseServer()

    // услуги с брутто/нетто (прибыль = gross - net)
    const { data: svcRaw } = await supabase
        .from('booking_services')
        .select('booking_id, service_type, gross, net, currency, source_block_id')

    // брони + клиент
    const { data: bkRaw } = await supabase
        .from('bookings')
        .select('id, client_id, owner_id, request_id, start_date, created_at, clients ( name )')

    // агенты (owner_id -> email)
    const { data: profRaw } = await supabase.from('profiles').select('id, email')
    const agentEmail = new Map<string, string>()
    for (const p of profRaw ?? []) agentEmail.set(p.id, (p.email as string | null) || '—')

    // регион заявки — первый по sort_order
    const { data: destRaw } = await supabase
        .from('request_destinations')
        .select('request_id, region, sort_order')
        .order('sort_order', { ascending: true })
    const regionByReq = new Map<string, string>()
    for (const d of destRaw ?? []) {
        if (d.region && !regionByReq.has(d.request_id)) regionByReq.set(d.request_id, d.region)
    }

    // названия отелей из библиотеки
    const { data: cbRaw } = await supabase
        .from('content_blocks')
        .select('id, title_ru, title_en')
        .eq('type', 'hotel')
    const hotelName = new Map<string, string>()
    for (const b of cbRaw ?? []) {
        hotelName.set(b.id, (lang === 'ru' ? b.title_ru : b.title_en) || b.title_ru || b.title_en || '—')
    }

    // контекст брони: клиент / агент / регион / месяц
    const bookingInfo = new Map<string, { client: string; agent: string; region: string; month: string }>()
    for (const b of bkRaw ?? []) {
        const c = one(b.clients as unknown)
        const date = (b.start_date as string | null) || (b.created_at as string | null) || ''
        const month = date ? date.slice(0, 7) : '—'
        bookingInfo.set(b.id, {
            client: (c as { name?: string | null } | null)?.name || '—',
            agent: (b.owner_id && agentEmail.get(b.owner_id)) || '—',
            region: (b.request_id && regionByReq.get(b.request_id)) || '—',
            month: month || '—',
        })
    }

    const rows: ProfitRow[] = (svcRaw ?? []).map((s) => {
        const info = bookingInfo.get(s.booking_id) || { client: '—', agent: '—', region: '—', month: '—' }
        const profit = Number(s.gross ?? 0) - Number(s.net ?? 0)
        return {
            profit,
            currency: (s.currency as string | null) || 'EUR',
            client: info.client,
            agent: info.agent,
            region: info.region,
            month: info.month,
            hotel: s.source_block_id ? (hotelName.get(s.source_block_id) || '—') : '—',
            service_type: (s.service_type as string | null) || '—',
        }
    }).filter((r) => r.profit !== 0)

    return <AnalyticsClient rows={rows} />
}