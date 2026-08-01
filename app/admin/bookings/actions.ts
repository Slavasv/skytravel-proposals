'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type BookingUpdate = {
  client_id?: string | null
  start_date?: string | null
  end_date?: string | null
  destination?: string | null
  status?: string
  notes?: string | null
}

export type BookingService = {
  id: string
  booking_id: string
  service_type: string | null
  partner_id: string | null
  description: string | null
  gross: number | null
  net: number | null
  currency: string | null
  confirmation_no: string | null
  check_in: string | null
  check_out: string | null
  alternatives: string | null
  room_type: string | null
  meal_plan: string | null
  nights: string | null
  sort_order: number
}

export type ServiceUpdate = {
  service_type?: string | null
  partner_id?: string | null
  description?: string | null
  gross?: number | null
  net?: number | null
  currency?: string | null
  confirmation_no?: string | null
  check_in?: string | null
  check_out?: string | null
  alternatives?: string | null
  room_type?: string | null
  meal_plan?: string | null
  nights?: string | null
}

// ============ Бронирование ============

export async function createBooking() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  let companyId: string | null = null
  if (user) {
    const { data: me } = await supabase
      .from('profiles').select('company_id').eq('id', user.id).single()
    companyId = me?.company_id ?? null
  }
  if (!companyId) throw new Error('Компания не найдена')

  const { data: code } = await supabase.rpc('next_booking_code', { p_company_id: companyId })

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      booking_code: code ?? null,
      status: 'draft',
      company_id: companyId,
      owner_id: user?.id ?? null,
    })
    .select().single()

  if (error || !data) throw new Error(error?.message || 'Failed to create booking')

  revalidatePath('/admin/bookings')
  redirect(`/admin/bookings/${data.id}`)
}

// Создание из запроса — переносим клиента и направление
export async function createBookingFromRequest(requestId: string) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: request } = await supabase
    .from('requests')
    .select('client_id, company_id')
    .eq('id', requestId).single()

  if (!request) throw new Error('Request not found')

  const { data: code } = await supabase.rpc('next_booking_code', {
    p_company_id: request.company_id,
  })

  // Тянем даты и направление из утверждённого предложения этой заявки
  // (не destination). Если нет confirmed — берём самое свежее.
  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, status, start_date, end_date, country_ru, country_en')
    .eq('request_id', requestId)
    .neq('kind', 'destination')
    .order('updated_at', { ascending: false })
  const approved = (proposals ?? []).find((p) => p.status === 'confirmed') ?? (proposals ?? [])[0]

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      booking_code: code ?? null,
      request_id: requestId,
      client_id: request.client_id,
      proposal_id: approved?.id ?? null,
      start_date: approved?.start_date ?? null,
      end_date: approved?.end_date ?? null,
      destination: approved?.country_ru || approved?.country_en || null,
      status: 'draft',
      company_id: request.company_id,
      owner_id: user?.id ?? null,
    })
    .select().single()

  if (error || !data) throw new Error(error?.message || 'Failed to create booking')

  revalidatePath(`/admin/requests/${requestId}`)
  redirect(`/admin/bookings/${data.id}`)
}

export async function updateBooking(id: string, updates: BookingUpdate) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('bookings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/bookings')
  revalidatePath(`/admin/bookings/${id}`)
}

export async function deleteBooking(id: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('bookings').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/bookings')
}

// ============ Услуги ============

export async function getBookingServices(bookingId: string): Promise<BookingService[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('booking_services')
    .select('*')
    .eq('booking_id', bookingId)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as BookingService[]
}

export async function addService(bookingId: string): Promise<BookingService | null> {
  const supabase = await createSupabaseServer()

  const { data: existing } = await supabase
    .from('booking_services')
    .select('sort_order')
    .eq('booking_id', bookingId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  const { data, error } = await supabase
    .from('booking_services')
    .insert({
      booking_id: bookingId,
      service_type: 'Accomodation',
      currency: 'EUR',
      sort_order: nextOrder,
    })
    .select().single()

  if (error) return null
  revalidatePath(`/admin/bookings/${bookingId}`)
  return data as BookingService
}

export async function updateService(id: string, updates: ServiceUpdate) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('booking_services')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteService(id: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('booking_services').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function duplicateService(id: string): Promise<BookingService | null> {
  const supabase = await createSupabaseServer()

  const { data: original } = await supabase
    .from('booking_services').select('*').eq('id', id).single()
  if (!original) return null

  const { data: below } = await supabase
    .from('booking_services')
    .select('id, sort_order')
    .eq('booking_id', original.booking_id)
    .gt('sort_order', original.sort_order)

  if (below && below.length > 0) {
    await Promise.all(below.map((s) =>
      supabase.from('booking_services').update({ sort_order: s.sort_order + 1 }).eq('id', s.id)
    ))
  }

  const { data, error } = await supabase
    .from('booking_services')
    .insert({
      booking_id: original.booking_id,
      service_type: original.service_type,
      partner_id: original.partner_id,
      description: original.description,
      gross: original.gross,
      net: original.net,
      currency: original.currency,
      confirmation_no: original.confirmation_no,
      check_in: original.check_in,
      check_out: original.check_out,
      alternatives: original.alternatives,
      room_type: original.room_type,
      meal_plan: original.meal_plan,
      nights: original.nights,
      sort_order: original.sort_order + 1,
    })
    .select().single()

  if (error) return null
  revalidatePath(`/admin/bookings/${original.booking_id}`)
  return data as BookingService
}

// ============ Справочники для формы ============

export type PartnerOption = { id: string; name: string; service_type: string | null }

export async function getPartnerOptions(): Promise<PartnerOption[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('partners')
    .select('id, name, service_type')
    .order('name', { ascending: true })
  if (error || !data) return []
  return data as PartnerOption[]
}

export type BookingClientOption = { id: string; name: string; client_code: string | null }

export async function getClientsForBooking(): Promise<BookingClientOption[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, client_code')
    .order('name', { ascending: true })
  if (error || !data) return []
  return data as BookingClientOption[]
}

// Брони, созданные из запроса (для блока Booking в карточке запроса)
export type RequestBooking = {
  id: string
  booking_code: string | null
  status: string | null
  start_date: string | null
  end_date: string | null
  destination: string | null
  booking_services: { gross: number | null; net: number | null; currency: string | null }[] | null
}

export async function getBookingsForRequest(requestId: string): Promise<RequestBooking[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('bookings')
    .select('id, booking_code, status, start_date, end_date, destination, booking_services(gross, net, currency)')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as RequestBooking[]
}

// ============ Travellers брони ============
// Состав живёт в запросе — один на всю сделку.
// Правки в брони меняют запрос и наоборот.

export type BookingTraveller = {
  id: string
  name: string | null
  title: string | null
  relation: string | null
  date_of_birth: string | null
}

// Все travellers клиента + кто отмечен в запросе
export async function getBookingTravellers(bookingId: string): Promise<{
  all: BookingTraveller[]
  selected: string[]
  requestId: string | null
}> {
  const supabase = await createSupabaseServer()

  const { data: booking } = await supabase
    .from('bookings')
    .select('client_id, request_id')
    .eq('id', bookingId)
    .single()

  if (!booking?.client_id) return { all: [], selected: [], requestId: null }

  const { data: all } = await supabase
    .from('travellers')
    .select('id, name, title, relation, date_of_birth')
    .eq('client_id', booking.client_id)
    .order('sort_order', { ascending: true })

  let selected: string[] = []
  if (booking.request_id) {
    const { data: req } = await supabase
      .from('requests')
      .select('traveller_ids')
      .eq('id', booking.request_id)
      .single()
    selected = Array.isArray(req?.traveller_ids) ? req.traveller_ids : []
  }

  return {
    all: (all ?? []) as BookingTraveller[],
    selected,
    requestId: booking.request_id ?? null,
  }
}

// Сохраняем состав в запрос — он общий для сделки
export async function setBookingTravellers(
  bookingId: string,
  requestId: string,
  travellerIds: string[],
) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('requests')
    .update({ traveller_ids: travellerIds, updated_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/bookings/${bookingId}`)
  revalidatePath(`/admin/requests/${requestId}`)
}

// ============ Ваучер из брони ============

export type BookingVoucher = {
  id: string
  slug: string
  voucher_type: string | null
  issue_date: string | null
  updated_at: string
}

export async function getVouchersForBooking(bookingId: string): Promise<BookingVoucher[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('vouchers')
    .select('id, slug, voucher_type, issue_date, updated_at')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data as BookingVoucher[]
}

// Ваучер на проживание: гости из travellers, отели из услуг Accomodation
export async function createAccommodationVoucher(bookingId: string) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: booking } = await supabase
    .from('bookings')
    .select('client_id, request_id, company_id')
    .eq('id', bookingId)
    .single()

  if (!booking) throw new Error('Booking not found')

  // состав поездки — из запроса
  let travellerIds: string[] = []
  if (booking.request_id) {
    const { data: req } = await supabase
      .from('requests').select('traveller_ids').eq('id', booking.request_id).single()
    travellerIds = Array.isArray(req?.traveller_ids) ? req.traveller_ids : []
  }

  let guests: { title: string; name: string; birth_date: string }[] = []
  if (travellerIds.length > 0) {
    const { data: trav } = await supabase
      .from('travellers')
      .select('id, name, title, date_of_birth, sort_order')
      .in('id', travellerIds)
      .order('sort_order', { ascending: true })
    guests = (trav ?? []).map((t) => ({
      title: t.title || 'Mr',
      name: t.name || '',
      birth_date: t.date_of_birth || '',
    }))
  }

  const slug = `voucher-${Math.random().toString(36).slice(2, 10)}`
  const today = new Date()
  const issueDate = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`

  const { data: voucher, error } = await supabase
    .from('vouchers')
    .insert({
      slug,
      booking_id: bookingId,
      client_id: booking.client_id,
      voucher_type: 'accommodation',
      issue_date: issueDate,
      guests,
      show_transfer: false,
      show_greeting: true,
      company_id: booking.company_id,
      owner_id: user?.id ?? null,
    })
    .select()
    .single()

  if (error || !voucher) throw new Error(error?.message || 'Failed to create voucher')

  // отели — из услуг типа Accomodation
  const { data: services } = await supabase
    .from('booking_services')
    .select('description, confirmation_no, check_in, check_out, sort_order')
    .eq('booking_id', bookingId)
    .eq('service_type', 'Accomodation')
    .order('sort_order', { ascending: true })

  if (services && services.length > 0) {
    const toDMY = (d: string | null) => {
      if (!d) return null
      const parts = d.split('-')
      if (parts.length !== 3) return d
      return `${parts[2]}.${parts[1]}.${parts[0]}`
    }
    const nights = (a: string | null, b: string | null) => {
      if (!a || !b) return null
      const d1 = new Date(a), d2 = new Date(b)
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null
      const n = Math.round((d2.getTime() - d1.getTime()) / 86400000)
      return n > 0 ? String(n) : null
    }

    await supabase.from('voucher_hotels').insert(
      services.map((s, i) => ({
        voucher_id: voucher.id,
        sort_order: i,
        name: s.description || null,
        booking_ref: s.confirmation_no || null,
        check_in: toDMY(s.check_in),
        check_out: toDMY(s.check_out),
        nights: nights(s.check_in, s.check_out),
      }))
    )
  }

  revalidatePath(`/admin/bookings/${bookingId}`)
  redirect(`/admin/vouchers/${voucher.id}`)
}

// Подтянуть в ваучер актуальные данные брони.
// Обновляем только то, чей источник правды — бронь:
// название отеля, confirmation number, даты, ночи.
// Адрес, телефон, тип номера, питание, заметки агент правит в ваучере — не трогаем.
export async function syncVoucherFromBooking(voucherId: string) {
  const supabase = await createSupabaseServer()

  const { data: voucher } = await supabase
    .from('vouchers')
    .select('id, booking_id, voucher_type')
    .eq('id', voucherId)
    .single()

  if (!voucher?.booking_id || voucher.voucher_type !== 'accommodation') return

  // гости — из состава запроса
  const { data: booking } = await supabase
    .from('bookings')
    .select('request_id')
    .eq('id', voucher.booking_id)
    .single()

  if (booking?.request_id) {
    const { data: req } = await supabase
      .from('requests').select('traveller_ids').eq('id', booking.request_id).single()
    const ids = Array.isArray(req?.traveller_ids) ? req.traveller_ids : []
    if (ids.length > 0) {
      const { data: trav } = await supabase
        .from('travellers')
        .select('name, title, date_of_birth, sort_order')
        .in('id', ids)
        .order('sort_order', { ascending: true })
      const guests = (trav ?? []).map((t) => ({
        title: t.title || 'Mr',
        name: t.name || '',
        birth_date: t.date_of_birth || '',
      }))
      await supabase.from('vouchers').update({ guests }).eq('id', voucherId)
    }
  }

  // отели — из услуг Accomodation
  const { data: services } = await supabase
    .from('booking_services')
    .select('description, confirmation_no, check_in, check_out, sort_order')
    .eq('booking_id', voucher.booking_id)
    .eq('service_type', 'Accomodation')
    .order('sort_order', { ascending: true })

  const { data: hotels } = await supabase
    .from('voucher_hotels')
    .select('id, sort_order')
    .eq('voucher_id', voucherId)
    .order('sort_order', { ascending: true })

  const toDMY = (d: string | null) => {
    if (!d) return null
    const parts = d.split('-')
    if (parts.length !== 3) return d
    return `${parts[2]}.${parts[1]}.${parts[0]}`
  }
  const nightsBetween = (a: string | null, b: string | null) => {
    if (!a || !b) return null
    const d1 = new Date(a), d2 = new Date(b)
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null
    const n = Math.round((d2.getTime() - d1.getTime()) / 86400000)
    return n > 0 ? String(n) : null
  }

  const svc = services ?? []
  const existing = hotels ?? []

  // обновляем существующие карточки
  for (let i = 0; i < Math.min(svc.length, existing.length); i++) {
    await supabase
      .from('voucher_hotels')
      .update({
        name: svc[i].description || null,
        booking_ref: svc[i].confirmation_no || null,
        check_in: toDMY(svc[i].check_in),
        check_out: toDMY(svc[i].check_out),
        nights: nightsBetween(svc[i].check_in, svc[i].check_out),
      })
      .eq('id', existing[i].id)
  }

  // если в брони услуг больше — добавляем недостающие карточки
  if (svc.length > existing.length) {
    await supabase.from('voucher_hotels').insert(
      svc.slice(existing.length).map((s, idx) => ({
        voucher_id: voucherId,
        sort_order: existing.length + idx,
        name: s.description || null,
        booking_ref: s.confirmation_no || null,
        check_in: toDMY(s.check_in),
        check_out: toDMY(s.check_out),
        nights: nightsBetween(s.check_in, s.check_out),
      }))
    )
  }
}