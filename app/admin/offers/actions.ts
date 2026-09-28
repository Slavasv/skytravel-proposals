'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { resolveCreateCompanyId } from '@/lib/brand-filter'
import { getUiLang } from '@/lib/get-profile'
import { buildOccupancy, type TravellerLite } from '@/lib/occupancy'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function companyAndUser() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  const companyId = await resolveCreateCompanyId()
  return { supabase, user, companyId }
}

export async function createOffer() {
  const { supabase, user, companyId } = await companyAndUser()
  if (!companyId) throw new Error('Компания не найдена')
  const { data, error } = await supabase
    .from('admin_offers')
    .insert({ title: '', status: 'draft', company_id: companyId, owner_id: user?.id ?? null })
    .select()
    .single()
  if (error || !data) throw new Error(error?.message || 'Не удалось создать оффер')
  revalidatePath('/admin/offers')
  redirect(`/admin/offers/${data.id}`)
}

export async function deleteOffer(id: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('admin_offers').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/offers')
}

// Создать оффер из заявки: подтягиваем клиента, даты и состав гостей.
export async function createOfferFromRequest(requestId: string) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  const lang = await getUiLang()

  const { data: request } = await supabase
    .from('requests')
    .select('client_id, company_id, traveller_ids, trip_start, trip_end, destination')
    .eq('id', requestId)
    .single()
  if (!request) throw new Error('Request not found')
  if (!request.company_id) throw new Error('Компания не найдена')

  let clientName = ''
  if (request.client_id) {
    const { data: client } = await supabase.from('clients').select('name').eq('id', request.client_id).single()
    clientName = client?.name || ''
  }

  let occupancy = ''
  const ids = Array.isArray(request.traveller_ids) ? request.traveller_ids : []
  if (ids.length > 0) {
    const { data: travellers } = await supabase.from('travellers').select('title, relation, date_of_birth').in('id', ids)
    occupancy = buildOccupancy((travellers ?? []) as TravellerLite[], lang)
  }

  const { data, error } = await supabase
    .from('admin_offers')
    .insert({
      request_id: requestId, client_id: request.client_id ?? null,
      title: clientName || request.destination || null,
      date_from: request.trip_start ?? null, date_to: request.trip_end ?? null,
      occupancy: occupancy || null, status: 'draft',
      company_id: request.company_id, owner_id: user?.id ?? null,
    })
    .select().single()
  if (error || !data) throw new Error(error?.message || 'Не удалось создать оффер')

  revalidatePath(`/admin/requests/${requestId}`)
  redirect(`/admin/offers/${data.id}`)
}

export type LinkedOffer = { id: string; hotel_name: string | null; title: string | null; status: string | null }
export async function getOffersForRequest(requestId: string): Promise<LinkedOffer[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('admin_offers')
    .select('id, hotel_name, title, status')
    .eq('request_id', requestId)
    .order('updated_at', { ascending: false })
  return (data ?? []) as LinkedOffer[]
}
