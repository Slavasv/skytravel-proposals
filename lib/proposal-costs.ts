// Общая логика расчётов по маршруту (ночи, дальше — косты).
// Используется публичной страницей; логика идентична админской days-context,
// чтобы клиент и билдер считали одинаково.

import type { PublicDay, Lang } from '@/app/_proposal-public/types'

function pickText(lang: Lang, ru: string | null, en: string | null): string {
  return (lang === 'ru' ? ru : en) || ''
}

function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// Ночи отеля: от даты его дня до даты дня следующего отеля
// (последний отель — до конца поездки). Дата дня = days.date,
// иначе считаем от начала поездки по номеру дня.
export function getNights(
  days: PublicDay[],
  tripStart: string | null,
  tripEnd: string | null,
  blockId: string
): number | null {
  const start = parseDate(tripStart)
  const end = parseDate(tripEnd)

  const ordered = [...days].sort((a, b) => a.day_number - b.day_number)
  const firstDayNumber = ordered[0]?.day_number ?? 1

  const dayDate = (day: PublicDay): Date | null => {
    const own = parseDate(day.date)
    if (own) return own
    if (!start) return null
    const offset = day.day_number - firstDayNumber
    return new Date(start.getTime() + offset * 86400000)
  }

  const hotelDays: { date: Date | null; blockIds: string[] }[] = []
  for (const d of ordered) {
    const ids = (d.day_blocks ?? [])
      .filter((b) => b.content_blocks?.type === 'hotel')
      .map((b) => b.id)
    if (ids.length > 0) hotelDays.push({ date: dayDate(d), blockIds: ids })
  }

  const idx = hotelDays.findIndex((h) => h.blockIds.includes(blockId))
  if (idx === -1) return null

  const curDate = hotelDays[idx].date
  if (!curDate) return null

  const nextDate = idx + 1 < hotelDays.length ? hotelDays[idx + 1].date : end
  if (!nextDate) return null

  const n = Math.round((nextDate.getTime() - curDate.getTime()) / 86400000)
  return n > 0 ? n : null
}

// Разбивка стоимости по категориям маршрута (Проживание / Активности / Трансферы).
// Цены живут в блоках: selected_rooms[].price у отелей, day_blocks.price у активностей/трансферов.
export type CostItem = { label: string; sub: string; price: number | null }
export type CostCategory = { total: number; desc: string; items: CostItem[] }
export type CostBreakdown = {
  accommodation: CostCategory
  activities: CostCategory
  transfers: CostCategory
  total: number
}

// Название номера по его id из jsonb content_blocks.rooms
function roomTitle(rooms: unknown, roomId: string, lang: Lang): string {
  if (!Array.isArray(rooms)) return ''
  const r = (rooms as Record<string, unknown>[]).find((x) => x && typeof x === 'object' && x.id === roomId)
  if (!r) return ''
  return pickText(lang, (r.title_ru as string) ?? null, (r.title_en as string) ?? null)
}

function guestsShort(n: number, lang: Lang): string {
  if (lang !== 'ru') return `${n} ${n === 1 ? 'guest' : 'guests'}`
  const d = n % 10, dd = n % 100
  const w = dd > 10 && dd < 20 ? 'гостей' : d === 1 ? 'гость' : d >= 2 && d <= 4 ? 'гостя' : 'гостей'
  return `${n} ${w}`
}

export function computeCosts(
  days: PublicDay[],
  tripStart: string | null,
  tripEnd: string | null,
  lang: Lang
): CostBreakdown {
  const ordered = [...days].sort((a, b) => a.day_number - b.day_number)

  let accTotal = 0, actTotal = 0, trTotal = 0
  const accItems: CostItem[] = []
  const actItems: CostItem[] = []
  const trItems: CostItem[] = []

  for (const d of ordered) {
    for (const b of d.day_blocks ?? []) {
      const cb = b.content_blocks
      if (!cb) continue
      const title = pickText(lang, cb.title_ru, cb.title_en)

      if (cb.type === 'hotel') {
        const rooms = b.selected_rooms ?? []
        const sum = rooms.reduce((s, r) => s + (r.price || 0), 0)
        accTotal += sum
        const nights = getNights(days, tripStart, tripEnd, b.id)
        const roomNames = [...new Set(rooms.map((r) => roomTitle(cb.rooms, r.room_id, lang)).filter(Boolean))]
        const meals = [...new Set(rooms.map((r) => (r.meal || '').trim()).filter(Boolean))]
        const subParts: string[] = []
        if (nights) subParts.push(`${nights} ${lang === 'ru' ? 'ноч.' : 'n.'}`)
        if (roomNames.length) subParts.push(roomNames.join(', '))
        if (meals.length) subParts.push(meals.join(', '))
        accItems.push({ label: title || (lang === 'ru' ? 'Отель' : 'Hotel'), sub: subParts.join(' · '), price: sum })
      } else if (cb.type === 'activity') {
        actTotal += b.price || 0
        const g = b.guests ? guestsShort(b.guests, lang) : ''
        actItems.push({ label: title || (lang === 'ru' ? 'Активность' : 'Activity'), sub: g, price: b.price ?? null })
      } else if (cb.type === 'transfer') {
        trTotal += b.price || 0
        const from = pickText(lang, b.from_ru, b.from_en)
        const to = pickText(lang, b.to_ru, b.to_en)
        const route = [from, to].filter(Boolean).join(' → ')
        const g = b.guests ? guestsShort(b.guests, lang) : ''
        const sub = [route, g].filter(Boolean).join(' · ')
        trItems.push({ label: title || (lang === 'ru' ? 'Трансфер' : 'Transfer'), sub, price: b.price ?? null })
      }
    }
  }

  return {
    accommodation: { total: accTotal, desc: accItems.map((i) => i.label).join(' + '), items: accItems },
    activities: { total: actTotal, desc: actItems.map((i) => i.label).join(', '), items: actItems },
    transfers: { total: trTotal, desc: trItems.map((i) => i.label).join(', '), items: trItems },
    total: accTotal + actTotal + trTotal,
  }
}