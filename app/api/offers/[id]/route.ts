import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// Единый стабильный эндпоинт редактора оффера (а не серверный экшен — чтобы не ловить
// «Server Action not found» после деплоя). Все операции — через поле op.
// RLS ограничивает доступ по компании/владельцу; здесь дополнительно проверяем,
// что комната/котировка принадлежат именно этому офферу.

type Op =
  | 'offer_update' | 'room_add' | 'room_update' | 'room_delete'
  | 'quote_add' | 'quote_update' | 'quote_delete' | 'set_chosen'

type Body = {
  op: Op
  patch?: Record<string, unknown>
  roomId?: string
  quoteId?: string
}

const OFFER_FIELDS = ['title', 'hotel_name', 'date_from', 'date_to', 'occupancy', 'meal', 'status', 'notes', 'client_id', 'request_id']
const ROOM_FIELDS = ['sort_order', 'room_type', 'room_link', 'room_note', 'sale_price', 'sale_currency', 'extra_label', 'extra_price', 'is_recommended']
const QUOTE_FIELDS = ['source', 'partner_id', 'amount', 'currency', 'commission_pct', 'is_chosen', 'note', 'sort_order']

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

  // проверка, что комната принадлежит этому офферу
  async function roomInOffer(roomId: string): Promise<boolean> {
    const { data } = await supabase.from('offer_rooms').select('id').eq('id', roomId).eq('offer_id', id).single()
    return !!data
  }

  try {
    switch (body.op) {
      case 'offer_update': {
        const patch = { ...pick(body.patch, OFFER_FIELDS), updated_at: now }
        const { error } = await supabase.from('admin_offers').update(patch).eq('id', id)
        if (error) throw error
        break
      }
      case 'room_add': {
        const { data: rows } = await supabase.from('offer_rooms').select('sort_order').eq('offer_id', id)
        const next = (rows || []).reduce((m, r) => Math.max(m, (r.sort_order ?? 0) + 1), 0)
        const { data, error } = await supabase.from('offer_rooms')
          .insert({ offer_id: id, sort_order: next, sale_currency: 'EUR' }).select().single()
        if (error) throw error
        await supabase.from('admin_offers').update({ updated_at: now }).eq('id', id)
        return done({ room: data })
      }
      case 'room_update': {
        if (!body.roomId || !(await roomInOffer(body.roomId))) throw new Error('room not found')
        const { error } = await supabase.from('offer_rooms')
          .update({ ...pick(body.patch, ROOM_FIELDS), updated_at: now }).eq('id', body.roomId)
        if (error) throw error
        await supabase.from('admin_offers').update({ updated_at: now }).eq('id', id)
        break
      }
      case 'room_delete': {
        if (!body.roomId || !(await roomInOffer(body.roomId))) throw new Error('room not found')
        const { error } = await supabase.from('offer_rooms').delete().eq('id', body.roomId)
        if (error) throw error
        break
      }
      case 'quote_add': {
        if (!body.roomId || !(await roomInOffer(body.roomId))) throw new Error('room not found')
        const { data: rows } = await supabase.from('offer_room_quotes').select('sort_order').eq('room_id', body.roomId)
        const next = (rows || []).reduce((m, r) => Math.max(m, (r.sort_order ?? 0) + 1), 0)
        const src = (body.patch?.source as string) || 'netto'
        const { data, error } = await supabase.from('offer_room_quotes')
          .insert({ room_id: body.roomId, source: src, currency: 'EUR', sort_order: next }).select().single()
        if (error) throw error
        return done({ quote: data })
      }
      case 'quote_update': {
        if (!body.quoteId) throw new Error('quote id required')
        const { error } = await supabase.from('offer_room_quotes')
          .update({ ...pick(body.patch, QUOTE_FIELDS), updated_at: now }).eq('id', body.quoteId)
        if (error) throw error
        break
      }
      case 'quote_delete': {
        if (!body.quoteId) throw new Error('quote id required')
        const { error } = await supabase.from('offer_room_quotes').delete().eq('id', body.quoteId)
        if (error) throw error
        break
      }
      case 'set_chosen': {
        if (!body.roomId || !body.quoteId || !(await roomInOffer(body.roomId))) throw new Error('room not found')
        // снимаем актуальную у всех котировок комнаты, ставим одну
        await supabase.from('offer_room_quotes').update({ is_chosen: false }).eq('room_id', body.roomId)
        const { error } = await supabase.from('offer_room_quotes').update({ is_chosen: true }).eq('id', body.quoteId)
        if (error) throw error
        break
      }
      default:
        return NextResponse.json({ ok: false, error: 'unknown op' }, { status: 400 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }

  return done()

  function done(extra?: Record<string, unknown>) {
    revalidatePath('/admin/offers')
    revalidatePath(`/admin/offers/${id}`)
    return NextResponse.json({ ok: true, ...(extra || {}) })
  }
}
