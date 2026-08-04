'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { tr } from '@/lib/i18n'
import { getUiLang } from '@/lib/get-profile'

export type Guest = {
  id: string
  title: string      // Mr / Mrs / Ms / Miss / ''
  name: string
  is_child: boolean
  birth_date: string // текст, только если is_child
}

export type VoucherUpdate = {
  issue_date?: string | null
  greeting_for?: string | null
  guests?: unknown
  show_transfer?: boolean
  show_greeting?: boolean
  transfers?: unknown
  notes?: string | null
  client_id?: string | null
}

// ============ CRM: клиенты и их travellers ============

export type ClientOption = {
  id: string
  name: string
  client_code: string | null
}

export type TravellerOption = {
  id: string
  name: string | null
  title: string | null
  date_of_birth: string | null
}

// Список клиентов компании (для дропдауна в ваучере)
export async function getClientOptions(): Promise<ClientOption[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, client_code')
    .order('name', { ascending: true })
  if (error || !data) return []
  return data as ClientOption[]
}

// Travellers конкретного клиента
export async function getClientTravellers(clientId: string): Promise<TravellerOption[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('travellers')
    .select('id, name, title, date_of_birth')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as TravellerOption[]
}

// Сохранить гостя из ваучера в travellers клиента.
// Возвращает { ok, duplicate } — duplicate=true, если такой уже есть.
export async function saveGuestToClient(
  clientId: string,
  guest: { title: string; name: string; birth_date: string }
): Promise<{ ok: boolean; duplicate: boolean; error?: string }> {
  const supabase = await createSupabaseServer()
  const lang = await getUiLang()

  const cleanName = guest.name.trim()
  if (!cleanName) return { ok: false, duplicate: false, error: tr(lang, 'Name is empty', 'Имя не указано') }

  // проверка дубля (по имени, без учёта регистра)
  const { data: existing } = await supabase
    .from('travellers')
    .select('id')
    .eq('client_id', clientId)
    .ilike('name', cleanName)
    .maybeSingle()

  if (existing) return { ok: false, duplicate: true }

  // company_id и порядок — от клиента
  const { data: client } = await supabase
    .from('clients')
    .select('company_id')
    .eq('id', clientId)
    .single()

  if (!client) return { ok: false, duplicate: false, error: tr(lang, 'Client not found', 'Клиент не найден') }

  const { data: last } = await supabase
    .from('travellers')
    .select('sort_order')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = last && last.length > 0 ? last[0].sort_order + 1 : 0

  const { data: code } = await supabase.rpc('next_traveller_code', {
    p_company_id: client.company_id,
  })

  const { error } = await supabase.from('travellers').insert({
    client_id: clientId,
    company_id: client.company_id,
    name: cleanName,
    title: guest.title || null,
    date_of_birth: guest.birth_date || null,
    traveller_code: code ?? null,
    sort_order: nextOrder,
  })

  if (error) return { ok: false, duplicate: false, error: error.message }

  revalidatePath(`/admin/clients/${clientId}`)
  return { ok: true, duplicate: false }
}

export async function updateVoucher(id: string, updates: VoucherUpdate) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('vouchers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/vouchers/${id}`)
}

// ============ Слаг ваучера ============

// чистит слаг: нижний регистр, пробелы→дефисы, только буквы/цифры/дефис
function cleanSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// возвращает { ok, error } — проверяет уникальность
export async function updateVoucherSlug(id: string, rawSlug: string): Promise<{ ok: boolean; slug?: string; error?: string }> {
  const lang = await getUiLang()
  const slug = cleanSlug(rawSlug)
  if (!slug) return { ok: false, error: tr(lang, 'Slug cannot be empty', 'Ссылка не может быть пустой') }

  const supabase = await createSupabaseServer()

  // занят ли слаг другим ваучером?
  const { data: existing } = await supabase
    .from('vouchers')
    .select('id')
    .eq('slug', slug)
    .neq('id', id)
    .maybeSingle()

  if (existing) return { ok: false, error: tr(lang, 'This link is already taken', 'Эта ссылка уже занята') }

  const { error } = await supabase
    .from('vouchers')
    .update({ slug, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/admin/vouchers/${id}`)
  return { ok: true, slug }
}

// ============ Блоки отелей ваучера ============

export type VoucherHotel = {
  id: string
  voucher_id: string
  sort_order: number
  city: string | null
  country: string | null
  booking_ref: string | null
  name: string | null
  address: string | null
  phone: string | null
  check_in: string | null
  check_out: string | null
  nights: string | null
  room_type: string | null
  meal_plan: string | null
  extras: string | null
}

export type HotelUpdate = {
  city?: string | null
  country?: string | null
  booking_ref?: string | null
  name?: string | null
  address?: string | null
  phone?: string | null
  check_in?: string | null
  check_out?: string | null
  nights?: string | null
  room_type?: string | null
  meal_plan?: string | null
  extras?: string | null
}

export async function getHotels(voucherId: string): Promise<VoucherHotel[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('voucher_hotels')
    .select('*')
    .eq('voucher_id', voucherId)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as VoucherHotel[]
}

export async function addHotel(voucherId: string) {
  const supabase = await createSupabaseServer()
  const { data: existing } = await supabase
    .from('voucher_hotels')
    .select('sort_order')
    .eq('voucher_id', voucherId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  const { data, error } = await supabase
    .from('voucher_hotels')
    .insert({ voucher_id: voucherId, sort_order: nextOrder })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/vouchers/${voucherId}`)
  return data as VoucherHotel
}

export async function updateHotel(hotelId: string, updates: HotelUpdate) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('voucher_hotels')
    .update(updates)
    .eq('id', hotelId)
  if (error) throw new Error(error.message)
}

export async function deleteHotel(hotelId: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('voucher_hotels')
    .delete()
    .eq('id', hotelId)
  if (error) throw new Error(error.message)
}

// Дублирует блок отеля (для "+ Add room" — тот же отель, другая комната).
// Копируем всё как есть; менеджер сам поменяет что нужно.
export async function duplicateHotel(hotelId: string) {
  const supabase = await createSupabaseServer()

  const { data: original, error: fetchError } = await supabase
    .from('voucher_hotels')
    .select('*')
    .eq('id', hotelId)
    .single()

  if (fetchError || !original) throw new Error('Hotel not found')

  // Вставляем сразу после оригинала: сдвигаем всех, кто ниже
  const { data: below } = await supabase
    .from('voucher_hotels')
    .select('id, sort_order')
    .eq('voucher_id', original.voucher_id)
    .gt('sort_order', original.sort_order)

  if (below && below.length > 0) {
    await Promise.all(
      below.map((h) =>
        supabase
          .from('voucher_hotels')
          .update({ sort_order: h.sort_order + 1 })
          .eq('id', h.id)
      )
    )
  }

  const { data, error } = await supabase
    .from('voucher_hotels')
    .insert({
      voucher_id: original.voucher_id,
      sort_order: original.sort_order + 1,
      city: original.city,
      country: original.country,
      booking_ref: original.booking_ref,
      name: original.name,
      address: original.address,
      phone: original.phone,
      check_in: original.check_in,
      check_out: original.check_out,
      nights: original.nights,
      room_type: original.room_type,
      meal_plan: original.meal_plan,
      extras: original.extras,
      guests: original.guests,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath(`/admin/vouchers/${original.voucher_id}`)
  return data as VoucherHotel
}

export async function reorderHotels(orderedIds: string[]) {
  const supabase = await createSupabaseServer()
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('voucher_hotels').update({ sort_order: index }).eq('id', id)
    )
  )
}