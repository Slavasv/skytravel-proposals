import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'

// Список travellers клиента через стабильный URL (не серверный экшен).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ clientId: string }> }) {
    const { clientId } = await ctx.params
    if (!clientId) return NextResponse.json({ ok: true, travellers: [] })

    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

    const { data, error } = await supabase
        .from('travellers')
        .select('id, name, title, relation, date_of_birth')
        .eq('client_id', clientId)
        .order('sort_order', { ascending: true })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, travellers: data ?? [] })
}