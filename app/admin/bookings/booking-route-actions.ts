'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { getUiLang } from '@/lib/get-profile'
import { revalidatePath } from 'next/cache'
import type { BookingService, TransferDetails } from './actions'

// Кандидат-услуга, собранная из маршрута предложения (для дропдауна в брони).
export type RouteServiceCandidate = {
  key: string
  service_type: string
  description: string
  gross: number | null
  currency: string
  check_in: string | null
  check_out: string | null
  room_type: string | null
  meal_plan: string | null
  nights: string | null
  transfer_details?: TransferDetails | null
  block_id: string | null
}

function str(v: unknown): string { return typeof v === 'string' ? v : '' }
function pick(lang: string, ru: unknown, en: unknown): string {
  return (lang === 'ru' ? str(ru) : str(en)) || str(ru) || str(en)
}

// Найти предложение, из которого тянем услуги: booking.proposal_id,
// иначе — утверждённое (confirmed) предложение заявки (не destination).
async function resolveProposalId(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  bookingId: string
): Promise<{ proposalId: string | null; requestId: string | null }> {
  const { data: booking } = await supabase
    .from('bookings').select('proposal_id, request_id').eq('id', bookingId).single()
  if (booking?.proposal_id) return { proposalId: booking.proposal_id, requestId: booking.request_id ?? null }
  if (!booking?.request_id) return { proposalId: null, requestId: null }
  const { data: proposals } = await supabase
    .from('proposals')
    .select('id, status, kind')
    .eq('request_id', booking.request_id)
    .neq('kind', 'destination')
    .order('updated_at', { ascending: false })
  const approved = (proposals ?? []).find((p) => p.status === 'confirmed') ?? (proposals ?? [])[0]
  return { proposalId: approved?.id ?? null, requestId: booking.request_id }
}

function roomTitle(rooms: unknown, roomId: string, lang: string): string {
  if (!Array.isArray(rooms)) return ''
  const r = (rooms as Record<string, unknown>[]).find((x) => x && typeof x === 'object' && x.id === roomId)
  return r ? pick(lang, r.title_ru, r.title_en) : ''
}

function addDays(date: string, n: number): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// Собрать услуги-кандидаты из активного варианта предложения.
export async function getRouteServices(bookingId: string): Promise<RouteServiceCandidate[]> {
  const supabase = await createSupabaseServer()
  const lang = await getUiLang()

  const { proposalId } = await resolveProposalId(supabase, bookingId)
  if (!proposalId) return []

  const { data: proposal } = await supabase
    .from('proposals').select('cost_currency, currency, start_date, end_date').eq('id', proposalId).single()
  const currency = proposal?.cost_currency || proposal?.currency || 'EUR'

  // активный вариант: выбранный клиентом, иначе первый
  const { data: variants } = await supabase
    .from('proposal_variants').select('id, is_selected, sort_order')
    .eq('proposal_id', proposalId).order('sort_order', { ascending: true })
  const variant = (variants ?? []).find((v) => v.is_selected) ?? (variants ?? [])[0]
  if (!variant) return []

  const { data: daysRaw } = await supabase
    .from('days')
    .select(`day_number, date, day_blocks ( sort_order, price, guests, selected_rooms, time, from_ru, from_en, to_ru, to_en, content_blocks ( id, type, title_ru, title_en, vehicle_ru, vehicle_en, rooms ) )`)
    .eq('variant_id', variant.id)
    .order('day_number', { ascending: true })

  type DRow = { day_number: number; date: string | null; day_blocks: Record<string, unknown>[] | null }
  const days = (daysRaw ?? []) as unknown as DRow[]

  const dayDate = (dayNumber: number, own: string | null): string | null => {
    if (own) return own
    if (proposal?.start_date) return addDays(proposal.start_date, dayNumber - (days[0]?.day_number ?? 1))
    return null
  }
  // даты отелей по порядку — чтобы посчитать ночи (до следующего отеля / конца поездки)
  const hotelDates: string[] = []
  for (const d of days) {
    const hasHotel = (d.day_blocks ?? []).some((b) => (b.content_blocks as Record<string, unknown>)?.type === 'hotel')
    if (hasHotel) { const dd = dayDate(d.day_number, d.date); if (dd) hotelDates.push(dd) }
  }

  const out: RouteServiceCandidate[] = []
  for (const d of days) {
    const blocks = [...(d.day_blocks ?? [])].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
    for (const b of blocks) {
      const cb = (b.content_blocks as Record<string, unknown>) || {}
      const type = str(cb.type)
      const title = pick(lang, cb.title_ru, cb.title_en)
      const ci = dayDate(d.day_number, d.date)

      if (type === 'hotel') {
        const rooms = Array.isArray(b.selected_rooms) ? (b.selected_rooms as Record<string, unknown>[]) : []
        const gross = rooms.reduce((s, r) => s + (Number(r.price) || 0), 0)
        const roomNames = [...new Set(rooms.map((r) => roomTitle(cb.rooms, str(r.room_id), lang)).filter(Boolean))]
        const meals = [...new Set(rooms.map((r) => str(r.meal).trim()).filter(Boolean))]
        // ночи: до следующего отеля или конца поездки
        let nights = ''
        let co: string | null = null
        if (ci) {
          const idx = hotelDates.indexOf(ci)
          const next = idx >= 0 && idx + 1 < hotelDates.length ? hotelDates[idx + 1] : proposal?.end_date || null
          if (next) {
            const n = Math.round((new Date(next).getTime() - new Date(ci).getTime()) / 86400000)
            if (n > 0) { nights = String(n); co = addDays(ci, n) }
          }
        }
        out.push({
          key: `hotel:${out.length}`, service_type: 'Accomodation',
          description: title, gross: gross || null, currency,
          check_in: ci, check_out: co,
          room_type: roomNames.join(', ') || null,
          meal_plan: meals.join(', ') || null,
          nights: nights || null,
          block_id: str(cb.id) || null,
        })
      } else if (type === 'activity') {
        out.push({
          key: `act:${out.length}`, service_type: 'Excursion',
          description: title, gross: (b.price as number) ?? null, currency,
          check_in: ci, check_out: null, room_type: null, meal_plan: null, nights: null,
          block_id: str(cb.id) || null,
        })
      } else if (type === 'transfer') {
        const from = pick(lang, b.from_ru, b.from_en)
        const to = pick(lang, b.to_ru, b.to_en)
        const route = [from, to].filter(Boolean).join(' → ')
        const vehicle = pick(lang, cb.vehicle_ru, cb.vehicle_en)
        // из предложения тянем как One Way: дата/время/откуда/куда/транспорт.
        // транспорт — текстом (в предложении это vehicle_ru/en), в брони агент при желании
        // выберет из библиотеки. Партнёр/нетто/комиссию агент вписывает вручную.
        const td: TransferDetails = {
          type: 'one_way',
          vehicle,
          vehicle_block_id: null,
          legs: [{ date: ci || '', time: str(b.time), from, to }],
          rental_hours: '', pickup: '', end_other: false, dropoff: '', comments: '',
        }
        out.push({
          key: `tr:${out.length}`, service_type: 'Transfer',
          description: [title, route].filter(Boolean).join(' · '), gross: (b.price as number) ?? null, currency,
          check_in: ci, check_out: null, room_type: null, meal_plan: null, nights: null,
          transfer_details: td,
          block_id: str(cb.id) || null,
        })
      }
    }
  }
  return out
}

// Вставить услугу в бронь из кандидата маршрута.
export async function addServiceFromRoute(
  bookingId: string, c: RouteServiceCandidate
): Promise<BookingService | null> {
  const supabase = await createSupabaseServer()

  const { data: existing } = await supabase
    .from('booking_services').select('sort_order')
    .eq('booking_id', bookingId).order('sort_order', { ascending: false }).limit(1)
  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  const { data, error } = await supabase
    .from('booking_services')
    .insert({
      booking_id: bookingId,
      service_type: c.service_type,
      description: c.description || null,
      gross: c.gross,
      currency: c.currency || 'EUR',
      check_in: c.check_in,
      check_out: c.check_out,
      room_type: c.room_type,
      meal_plan: c.meal_plan,
      nights: c.nights,
      transfer_details: c.transfer_details ?? null,
      source_block_id: c.block_id,
      sort_order: nextOrder,
    })
    .select().single()


  if (error) return null
  revalidatePath(`/admin/bookings/${bookingId}`)
  return data as BookingService
}

// ---- Отели из библиотеки (для бизнес-поездок без предложения) ----

export type LibraryHotel = {
  block_id: string
  title: string
  city: string | null
  rooms: { id: string; title: string }[]
}

export async function getLibraryHotels(): Promise<LibraryHotel[]> {
  const supabase = await createSupabaseServer()
  const lang = await getUiLang()

  const { data } = await supabase
    .from('content_blocks')
    .select('id, title_ru, title_en, rooms, city:city_id ( name_en, name_ru )')
    .eq('type', 'hotel')
    .is('archived_at', null)
    .order('title_ru', { ascending: true })

  const rows = (data ?? []) as Record<string, unknown>[]
  const cityName = (o: unknown): string | null => {
    const f = Array.isArray(o) ? o[0] : o
    if (!f || typeof f !== 'object') return null
    const r = f as Record<string, unknown>
    return (lang === 'ru' ? str(r.name_ru) : str(r.name_en)) || str(r.name_ru) || str(r.name_en) || null
  }

  return rows.map((b) => {
    const rooms = Array.isArray(b.rooms) ? (b.rooms as Record<string, unknown>[]) : []
    return {
      block_id: str(b.id),
      title: pick(lang, b.title_ru, b.title_en) || '—',
      city: cityName(b.city),
      rooms: rooms
        .map((r) => ({ id: str(r.id), title: pick(lang, r.title_ru, r.title_en) }))
        .filter((r) => r.title),
    }
  })
}

export async function addServiceFromLibrary(
  bookingId: string, input: { block_id: string; title: string; room_type: string | null }
): Promise<BookingService | null> {
  const supabase = await createSupabaseServer()

  const { data: existing } = await supabase
    .from('booking_services').select('sort_order')
    .eq('booking_id', bookingId).order('sort_order', { ascending: false }).limit(1)
  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  const { data, error } = await supabase
    .from('booking_services')
    .insert({
      booking_id: bookingId,
      service_type: 'Accomodation',
      description: input.title || null,
      currency: 'EUR',
      room_type: input.room_type,
      source_block_id: input.block_id,   // ваучер по нему подтянет адрес/телефон/город
      sort_order: nextOrder,
    })
    .select().single()

  if (error) return null
  revalidatePath(`/admin/bookings/${bookingId}`)
  return data as BookingService
}

// Проставить услуге источник-блок (для подтяжки адреса/телефона в ваучер).
export async function setServiceSourceBlock(serviceId: string, blockId: string | null): Promise<void> {
  const supabase = await createSupabaseServer()
  await supabase.from('booking_services').update({ source_block_id: blockId }).eq('id', serviceId)
}

// Быстро создать отель в библиотеке (из карточки услуги).
export async function createLibraryHotel(name: string): Promise<{ block_id: string; title: string } | null> {
  const supabase = await createSupabaseServer()
  const nm = name.trim()
  if (!nm) return null
  const { data, error } = await supabase
    .from('content_blocks')
    .insert({ type: 'hotel', title_ru: nm, title_en: nm, tags: [] })
    .select('id').single()
  if (error || !data) return null
  return { block_id: data.id as string, title: nm }
}

// ---- Транспорт из библиотеки (MODE OF TRANSPORT — как отели) ----

export type LibraryVehicle = { block_id: string; title: string }

export async function getLibraryVehicles(): Promise<LibraryVehicle[]> {
  const supabase = await createSupabaseServer()
  const lang = await getUiLang()
  const { data } = await supabase
    .from('content_blocks')
    .select('id, title_ru, title_en, vehicle_ru, vehicle_en')
    .eq('type', 'transfer')
    .is('archived_at', null)
    .order('title_ru', { ascending: true })
  const rows = (data ?? []) as Record<string, unknown>[]
  return rows.map((b) => ({
    block_id: str(b.id),
    title: pick(lang, b.vehicle_ru, b.vehicle_en) || pick(lang, b.title_ru, b.title_en) || '—',
  }))
}

export async function createLibraryVehicle(name: string): Promise<LibraryVehicle | null> {
  const supabase = await createSupabaseServer()
  const nm = name.trim()
  if (!nm) return null
  const { data, error } = await supabase
    .from('content_blocks')
    .insert({ type: 'transfer', title_ru: nm, title_en: nm, vehicle_ru: nm, vehicle_en: nm, tags: [] })
    .select('id').single()
  if (error || !data) return null
  return { block_id: data.id as string, title: nm }
}

// ---- Точки маршрута (для выпадашки FROM/TO в трансфере) ----
// Собираем: все from/to из трансферных блоков предложения + названия отелей.

export async function getRoutePoints(bookingId: string): Promise<string[]> {
  const supabase = await createSupabaseServer()
  const lang = await getUiLang()

  const { proposalId } = await resolveProposalId(supabase, bookingId)
  if (!proposalId) return []

  const { data: variants } = await supabase
    .from('proposal_variants').select('id, is_selected, sort_order')
    .eq('proposal_id', proposalId).order('sort_order', { ascending: true })
  const variant = (variants ?? []).find((v) => v.is_selected) ?? (variants ?? [])[0]
  if (!variant) return []

  const { data: daysRaw } = await supabase
    .from('days')
    .select(`day_blocks ( from_ru, from_en, to_ru, to_en, content_blocks ( type, title_ru, title_en ) )`)
    .eq('variant_id', variant.id)

  type DRow = { day_blocks: Record<string, unknown>[] | null }
  const days = (daysRaw ?? []) as unknown as DRow[]

  const points: string[] = []
  for (const d of days) {
    for (const b of d.day_blocks ?? []) {
      const cb = (b.content_blocks as Record<string, unknown>) || {}
      const type = str(cb.type)
      if (type === 'transfer') {
        const from = pick(lang, b.from_ru, b.from_en)
        const to = pick(lang, b.to_ru, b.to_en)
        if (from) points.push(from)
        if (to) points.push(to)
      } else if (type === 'hotel') {
        const title = pick(lang, cb.title_ru, cb.title_en)
        if (title) points.push(title)
      }
    }
  }
  // дедуп без учёта регистра, сохраняя первый вариант написания
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of points) {
    const k = p.trim().toLowerCase()
    if (k && !seen.has(k)) { seen.add(k); out.push(p.trim()) }
  }
  return out.sort((a, b) => a.localeCompare(b))
}