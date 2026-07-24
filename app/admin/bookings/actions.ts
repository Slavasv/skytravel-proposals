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

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      booking_code: code ?? null,
      request_id: requestId,
      client_id: request.client_id,
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