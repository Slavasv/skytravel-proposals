'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

function slug(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6)
}

// Создать «Симпл» из оффера: снимок отеля/номеров + ТОЛЬКО цена клиенту.
// Если симпл для этого оффера уже есть — открываем его (без перезаписи правок).
export async function createSimpleFromOffer(offerId: string) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  let companyId: string | null = null
  if (user) {
    const { data: me } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    companyId = me?.company_id ?? null
  }
  if (!companyId) throw new Error('Компания не найдена')

  const existing = await supabase.from('simple_proposals').select('id').eq('source_offer_id', offerId).limit(1).maybeSingle()
  if (existing.data?.id) redirect(`/admin/simple/${existing.data.id}`)

  const { data: offer, error } = await supabase
    .from('admin_offers')
    .select('*, offer_rooms(*)')
    .eq('id', offerId)
    .single()
  if (error || !offer) throw new Error('Оффер не найден')

  const { data: simple, error: e2 } = await supabase
    .from('simple_proposals')
    .insert({
      slug: slug(), source_offer_id: offerId,
      request_id: offer.request_id ?? null, client_id: offer.client_id ?? null,
      title: offer.title ?? null, hotel_name: offer.hotel_name ?? null,
      date_from: offer.date_from ?? null, date_to: offer.date_to ?? null,
      occupancy: offer.occupancy ?? null, meal: offer.meal ?? null,
      status: 'draft', company_id: companyId, owner_id: user?.id ?? null,
    })
    .select()
    .single()
  if (e2 || !simple) throw new Error(e2?.message || 'Не удалось создать симпл')

  const rooms = [...((offer.offer_rooms as Array<Record<string, unknown>>) || [])]
    .sort((a, b) => ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0))
  if (rooms.length > 0) {
    await supabase.from('simple_rooms').insert(rooms.map((r, i) => ({
      simple_id: simple.id, sort_order: i,
      room_type: r.room_type ?? null, room_link: r.room_link ?? null, room_note: r.room_note ?? null,
      price: r.sale_price ?? null, currency: (r.sale_currency as string) || 'EUR',
    })))
  }

  revalidatePath('/admin/simple')
  redirect(`/admin/simple/${simple.id}`)
}

export async function deleteSimple(id: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('simple_proposals').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/simple')
}
