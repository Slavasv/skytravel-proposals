'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export type TravellerBrief = {
  id: string
  name: string | null
  title: string | null
  relation: string | null
  date_of_birth: string | null
}

// Все travellers клиента — для выбора «кто едет»
export async function getClientTravellers(clientId: string): Promise<TravellerBrief[]> {
  if (!clientId) return []
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('travellers')
    .select('id, name, title, relation, date_of_birth')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as TravellerBrief[]
}

// Сохранить состав поездки в запросе
export async function setRequestTravellers(requestId: string, travellerIds: string[]) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('requests')
    .update({ traveller_ids: travellerIds, updated_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/requests/${requestId}`)
}

// Создать нового traveller у клиента прямо из запроса
export async function createTravellerQuick(
  clientId: string,
  name: string,
  title: string,
  dateOfBirth?: string | null,
): Promise<TravellerBrief | null> {
  if (!clientId || !name.trim()) return null

  const supabase = await createSupabaseServer()

  const { data: client } = await supabase
    .from('clients')
    .select('company_id')
    .eq('id', clientId)
    .single()

  if (!client) return null

  const { data: existing } = await supabase
    .from('travellers')
    .select('sort_order')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  const { data: code } = await supabase.rpc('next_traveller_code', {
    p_company_id: client.company_id,
  })

  const { data, error } = await supabase
    .from('travellers')
    .insert({
      client_id: clientId,
      company_id: client.company_id,
      name: name.trim(),
      title: title || 'Mr',
      date_of_birth: dateOfBirth || null,
      traveller_code: code ?? null,
      sort_order: nextOrder,
    })
    .select('id, name, title, relation, date_of_birth')
    .single()

  if (error) return null
  return data as TravellerBrief
}