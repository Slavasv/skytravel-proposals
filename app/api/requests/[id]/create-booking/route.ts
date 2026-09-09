import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// Создание брони из заявки обычным API-роутом (стабильный URL), а НЕ серверным
// экшеном — у экшенов зашифрованные ID расходятся между сборками при деплое
// («Server Action not found»). Возвращаем url, редирект делает клиент.

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id: requestId } = await ctx.params
    const supabase = await createSupabaseServer()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

    const { data: request } = await supabase
        .from('requests')
        .select('client_id, company_id')
        .eq('id', requestId).single()

    if (!request) return NextResponse.json({ ok: false, error: 'Request not found' }, { status: 404 })

    // даты и направление из утверждённого предложения (не destination);
    // нет confirmed — берём самое свежее
    const { data: proposals } = await supabase
        .from('proposals')
        .select('id, status, start_date, end_date, country_ru, country_en')
        .eq('request_id', requestId)
        .neq('kind', 'destination')
        .order('updated_at', { ascending: false })
    const approved = (proposals ?? []).find((p) => p.status === 'confirmed') ?? (proposals ?? [])[0]

    const { data, error } = await supabase
        .from('bookings')
        .insert({
            booking_code: null,
            request_id: requestId,
            client_id: request.client_id,
            proposal_id: approved?.id ?? null,
            start_date: approved?.start_date ?? null,
            end_date: approved?.end_date ?? null,
            destination: approved?.country_ru || approved?.country_en || null,
            status: 'draft',
            company_id: request.company_id,
            owner_id: user?.id ?? null,
        })
        .select().single()

    if (error || !data) return NextResponse.json({ ok: false, error: error?.message || 'Failed to create booking' }, { status: 400 })

    revalidatePath(`/admin/requests/${requestId}`)
    return NextResponse.json({ ok: true, url: `/admin/bookings/${data.id}` })
}
