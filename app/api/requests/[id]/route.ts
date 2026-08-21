import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// Сохранение заявки обычным API-роутом (стабильный URL), а НЕ серверным экшеном.
// У экшенов зашифрованные ID, которые расходятся между сборками при деплое
// («Server Action not found»). У этого эндпоинта URL постоянный — такой ошибки быть не может.

const CLOSING_STATUSES = ['confirmed', 'cancelled']

type Body = {
    client_id?: string | null
    destination?: string | null
    details?: string | null
    status?: string
    priority?: string | null
    cancel_reason?: string | null
    cancel_note?: string | null
    client_notes?: string | null
    agent_notes?: string | null
    trip_rating?: number | null
    trip_feedback?: string | null
    trip_start?: string | null
    trip_end?: string | null
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params
    const supabase = await createSupabaseServer()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

    let updates: Body
    try {
        updates = (await req.json()) as Body
    } catch {
        return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 })
    }

    const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }

    // та же логика closed_at, что и в updateRequest
    if (updates.status !== undefined) {
        if (CLOSING_STATUSES.includes(updates.status)) {
            const { data: current } = await supabase
                .from('requests')
                .select('closed_at')
                .eq('id', id)
                .single()
            if (!current?.closed_at) patch.closed_at = new Date().toISOString()
        } else {
            patch.closed_at = null
        }
    }

    const { error } = await supabase.from('requests').update(patch).eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    revalidatePath('/admin/requests')
    revalidatePath(`/admin/requests/${id}`)
    return NextResponse.json({ ok: true })
}