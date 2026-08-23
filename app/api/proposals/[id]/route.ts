import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// Сохранение верхних полей предложения через стабильный URL (не серверный экшен).

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

    const { error } = await supabase
        .from('proposals')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    revalidatePath('/admin')
    revalidatePath(`/admin/proposals/${id}`)
    return NextResponse.json({ ok: true })
}