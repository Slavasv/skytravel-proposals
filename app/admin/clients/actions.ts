'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { getUiLang } from '@/lib/get-profile'
import { tr } from '@/lib/i18n'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type ClientUpdate = {
  name?: string
  client_code?: string | null
  client_type?: string
  client_status?: string
  lead_source?: string | null
  countries?: string[]
  phone?: string | null
  email?: string | null
  balance_usd?: number | null
  balance_eur?: number | null
  notes?: string | null
}

// ============ Создание ============

export async function createClient() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  // company_id из профиля
  let companyId: string | null = null
  if (user) {
    const { data: me } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()
    companyId = me?.company_id ?? null
  }

  if (!companyId) throw new Error(tr(await getUiLang(), 'Company not found', 'Компания не найдена'))

  // Авто-код CL-001, CL-002...
  const { data: code } = await supabase.rpc('next_client_code', { p_company_id: companyId })

  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: '',
      client_code: code ?? null,
      client_type: 'individual',
      client_status: 'new',
      countries: [],
      balance_usd: 0,
      balance_eur: 0,
      company_id: companyId,
      owner_id: user?.id ?? null,
    })
    .select()
    .single()

  if (error || !data) throw new Error(error?.message || tr(await getUiLang(), 'Failed to create client', 'Не удалось создать клиента'))

  revalidatePath('/admin/clients')
  redirect(`/admin/clients/${data.id}`)
}

// ============ Обновление ============

export async function updateClient(id: string, updates: ClientUpdate) {
  const supabase = await createSupabaseServer()

  const { error } = await supabase
    .from('clients')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/clients')
  revalidatePath(`/admin/clients/${id}`)
}

// ============ Удаление ============

export async function deleteClient(id: string) {
  const supabase = await createSupabaseServer()

  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/clients')
}

// ============ Дублирование ============

export async function duplicateClient(id: string) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: original, error: fetchError } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !original) throw new Error(tr(await getUiLang(), 'Client not found', 'Клиент не найден'))

  // новый код для копии
  const { data: code } = await supabase.rpc('next_client_code', {
    p_company_id: original.company_id,
  })

  const { error: createError } = await supabase
    .from('clients')
    .insert({
      name: original.name ? `${original.name} (copy)` : '',
      client_code: code ?? null,
      client_type: original.client_type,
      client_status: original.client_status,
      lead_source: original.lead_source,
      countries: original.countries,
      phone: original.phone,
      email: original.email,
      balance_usd: original.balance_usd,
      balance_eur: original.balance_eur,
      notes: original.notes,
      company_id: original.company_id,
      owner_id: user?.id ?? original.owner_id ?? null,
    })

  if (createError) throw new Error(createError.message)

  revalidatePath('/admin/clients')
}

// ============ Travellers ============

export type Traveller = {
  id: string
  client_id: string
  name: string | null
  title: string | null
  relation: string | null
  traveller_code: string | null
  date_of_birth: string | null
  nationality: string | null
  special_requirements: string | null
  travel_preferences: string | null
  notes: string | null
  sort_order: number
}

export type TravellerUpdate = {
  name?: string
  title?: string | null
  relation?: string | null
  traveller_code?: string | null
  date_of_birth?: string | null
  nationality?: string | null
  special_requirements?: string | null
  travel_preferences?: string | null
  notes?: string | null
}

export async function getTravellers(clientId: string): Promise<Traveller[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('travellers')
    .select('*')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as Traveller[]
}

export async function addTraveller(clientId: string) {
  const supabase = await createSupabaseServer()

  // company_id и порядок берём от клиента
  const { data: client } = await supabase
    .from('clients')
    .select('company_id')
    .eq('id', clientId)
    .single()

  if (!client) throw new Error(tr(await getUiLang(), 'Client not found', 'Клиент не найден'))

  const { data: existing } = await supabase
    .from('travellers')
    .select('sort_order')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  // авто-код TRVLR-001
  const { data: code } = await supabase.rpc('next_traveller_code', {
    p_company_id: client.company_id,
  })

  const { data, error } = await supabase
    .from('travellers')
    .insert({
      client_id: clientId,
      company_id: client.company_id,
      name: '',
      title: 'Mr',
      traveller_code: code ?? null,
      sort_order: nextOrder,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/admin/clients/${clientId}`)
  return data as Traveller
}

// Создаёт traveller-«себя» для individual-клиента, если его ещё нет.
// Вызывается из формы клиента, когда имя заполнено и тип = individual.
export async function ensurePrimaryTraveller(clientId: string): Promise<Traveller | null> {
  const supabase = await createSupabaseServer()

  const { data: client } = await supabase
    .from('clients')
    .select('name, client_type, company_id')
    .eq('id', clientId)
    .single()

  if (!client) return null
  if (client.client_type !== 'individual') return null
  if (!client.name || !client.name.trim()) return null

  // уже есть travellers? — не трогаем
  const { data: existing } = await supabase
    .from('travellers')
    .select('id')
    .eq('client_id', clientId)
    .limit(1)

  if (existing && existing.length > 0) return null

  const { data: code } = await supabase.rpc('next_traveller_code', {
    p_company_id: client.company_id,
  })

  const { data, error } = await supabase
    .from('travellers')
    .insert({
      client_id: clientId,
      company_id: client.company_id,
      name: client.name.trim(),
      title: 'Mr',
      relation: 'Primary Client',
      traveller_code: code ?? null,
      sort_order: 0,
    })
    .select()
    .single()

  if (error) return null

  revalidatePath(`/admin/clients/${clientId}`)
  return data as Traveller
}

export async function updateTraveller(id: string, updates: TravellerUpdate) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('travellers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteTraveller(id: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('travellers')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function reorderTravellers(orderedIds: string[]) {
  const supabase = await createSupabaseServer()
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('travellers').update({ sort_order: index }).eq('id', id)
    )
  )
}

// ============ История клиента ============

export type ClientProposal = {
  id: string
  slug: string
  trip_title_ru: string | null
  trip_title_en: string | null
  start_date: string | null
  end_date: string | null
  status: string | null
  total_price: number | null
  cost_currency: string | null
  updated_at: string
  last_viewed_at: string | null
}

export type ClientVoucher = {
  id: string
  slug: string | null
  issue_date: string | null
  updated_at: string
  guests: unknown
  voucher_hotels?: { name: string | null; city: string | null; check_in: string | null; sort_order: number }[] | null
}

export async function getClientProposals(clientId: string): Promise<ClientProposal[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('proposals')
    .select('id, slug, trip_title_ru, trip_title_en, start_date, end_date, status, total_price, cost_currency, updated_at, last_viewed_at')
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false })
  if (error || !data) return []
  return data as ClientProposal[]
}

export type ClientRequest = {
  id: string
  request_code: string | null
  status: string | null
  destination: string | null
  trip_start: string | null
  trip_end: string | null
  created_at: string
  has_booking: boolean
}

export async function getClientRequests(clientId: string): Promise<ClientRequest[]> {
  const supabase = await createSupabaseServer()

  const { data: requests } = await supabase
    .from('requests')
    .select('id, request_code, status, destination, trip_start, trip_end, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (!requests || requests.length === 0) return []

  // какие запросы имеют брони
  const { data: bookings } = await supabase
    .from('bookings')
    .select('request_id')
    .in('request_id', requests.map((r) => r.id))

  const booked = new Set((bookings ?? []).map((b) => b.request_id))

  return requests.map((r) => ({
    ...r,
    has_booking: booked.has(r.id),
  })) as ClientRequest[]
}

export async function getClientVouchers(clientId: string): Promise<ClientVoucher[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('vouchers')
    .select('id, slug, issue_date, updated_at, guests, voucher_hotels(name, city, check_in, sort_order)')
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false })
  if (error || !data) return []
  return data as ClientVoucher[]
}