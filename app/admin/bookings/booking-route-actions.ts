'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { getUiLang } from '@/lib/get-profile'
import { revalidatePath } from 'next/cache'
import type { BookingService } from './actions'

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
    .select(`day_number, date, day_blocks ( sort_order, price, guests, selected_rooms, from_ru, from_en, to_ru, to_en, content_blocks ( id, type, title_ru, title_en, rooms ) )`)
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
        out.push({
          key: `tr:${out.length}`, service_type: 'Transfer',
          description: [title, route].filter(Boolean).join(' · '), gross: (b.price as number) ?? null, currency,
          check_in: ci, check_out: null, room_type: null, meal_plan: null, nights: null,
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
      source_block_id: c.block_id,
      sort_order: nextOrder,
    })
    .select().single()

  if (error) return null
  revalidatePath(`/admin/bookings/${bookingId}`)
  return data as BookingService
}