import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

type Op = 'simple_update' | 'room_add' | 'room_update' | 'room_delete'
type Body = { op: Op; patch?: Record<string, unknown>; roomId?: string }

const SIMPLE_FIELDS = ['title', 'hotel_name', 'date_from', 'date_to', 'occupancy', 'meal', 'status', 'client_id', 'request_id']
const ROOM_FIELDS = ['sort_order', 'room_type', 'room_link', 'room_note', 'price', 'currency', 'extra_label', 'extra_price', 'is_recommended']

function pick(src: Record<string, unknown> | undefined, allowed: string[]) {
  const out: Record<string, unknown> = {}
  if (!src) return out
  for (const k of allowed) if (k in src) out[k] = src[k]
  return out
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: Body
  try { body = (await req.json()) as Body } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }) }
  const now = new Date().toISOString()

  async function roomInSimple(roomId: string): Promise<boolean> {
    const { data } = await supabase.from('simple_rooms').select('id').eq('id', roomId).eq('simple_id', id).single()
    return !!data
  }

  try {
    switch (body.op) {
      case 'simple_update': {
        const { error } = await supabase.from('simple_proposals').update({ ...pick(body.patch, SIMPLE_FIELDS), updated_at: now }).eq('id', id)
        if (error) throw error
        break
      }
      case 'room_add': {
        const { data: rows } = await supabase.from('simple_rooms').select('sort_order').eq('simple_id', id)
        const next = (rows || []).reduce((m, r) => Math.max(m, (r.sort_order ?? 0) + 1), 0)
        const { data, error } = await supabase.from('simple_rooms').insert({ simple_id: id, sort_order: next, currency: 'EUR' }).select().single()
        if (error) throw error
        return done({ room: data })
      }
      case 'room_update': {
        if (!body.roomId || !(await roomInSimple(body.roomId))) throw new Error('room not found')
        const { error } = await supabase.from('simple_rooms').update({ ...pick(body.patch, ROOM_FIELDS), updated_at: now }).eq('id', body.roomId)
        if (error) throw error
        break
      }
      case 'room_delete': {
        if (!body.roomId || !(await roomInSimple(body.roomId))) throw new Error('room not found')
        const { error } = await supabase.from('simple_rooms').delete().eq('id', body.roomId)
        if (error) throw error
        break
      }
      default:
        return NextResponse.json({ ok: false, error: 'unknown op' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 400 })
  }

  return done()
  function done(extra?: Record<string, unknown>) {
    revalidatePath('/admin/simple')
    revalidatePath(`/admin/simple/${id}`)
    return NextResponse.json({ ok: true, ...(extra || {}) })
  }
}
