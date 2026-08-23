import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// Сохранение блока дня предложения (номера, цены, тексты) через стабильный URL.

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params
    const supabase = await createSupabaseServer()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

    let updates: Record<string, unknown>
    try {
        updates = (await req.json()) as Record<string, unknown>
    } catch {
        return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 })
    }

    const { error } = await supabase.from('day_blocks').update(updates).eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    // revalidate предложения: day_blocks → day_id → days.proposal_id
    const { data: db } = await supabase.from('day_blocks').select('day_id').eq('id', id).single()
    if (db?.day_id) {
        const { data: d } = await supabase.from('days').select('proposal_id').eq('id', db.day_id).single()
        if (d?.proposal_id) revalidatePath(`/admin/proposals/${d.proposal_id}`)
    }

    return NextResponse.json({ ok: true })
}