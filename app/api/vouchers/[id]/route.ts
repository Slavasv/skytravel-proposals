import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// Сохранение ваучера обычным API-роутом (стабильный URL), а не серверным экшеном —
// чтобы автосейв не ловил «Server Action not found» при деплое.

type Body = {
    issue_date?: string | null
    greeting_for?: string | null
    guests?: unknown
    show_transfer?: boolean
    show_greeting?: boolean
    transfers?: unknown
    notes?: string | null
    client_id?: string | null
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

    const { error } = await supabase
        .from('vouchers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    revalidatePath(`/admin/vouchers/${id}`)
    return NextResponse.json({ ok: true })
}