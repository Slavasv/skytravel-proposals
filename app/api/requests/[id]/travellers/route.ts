import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// Сохранить состав поездки (traveller_ids) в заявке через стабильный URL.
type Body = { travellerIds?: string[] }

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const { id: requestId } = await ctx.params
    const supabase = await createSupabaseServer()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

    let body: Body
    try {
        body = (await req.json()) as Body
    } catch {
        return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 })
    }

    const ids = Array.isArray(body.travellerIds) ? body.travellerIds : []

    const { error } = await supabase
        .from('requests')
        .update({ traveller_ids: ids, updated_at: new Date().toISOString() })
        .eq('id', requestId)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    revalidatePath(`/admin/requests/${requestId}`)
    return NextResponse.json({ ok: true })
}
