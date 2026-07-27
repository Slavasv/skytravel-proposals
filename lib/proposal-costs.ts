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
export type CostCategory = { total: number; desc: string }
export type CostBreakdown = {
  accommodation: CostCategory
  activities: CostCategory
  transfers: CostCategory
  total: number
}

export function computeCosts(
  days: PublicDay[],
  tripStart: string | null,
  tripEnd: string | null,
  lang: Lang
): CostBreakdown {
  const ordered = [...days].sort((a, b) => a.day_number - b.day_number)

  let accTotal = 0, actTotal = 0, trTotal = 0
  const accItems: string[] = []
  const actItems: string[] = []
  const trItems: string[] = []

  for (const d of ordered) {
    for (const b of d.day_blocks ?? []) {
      const cb = b.content_blocks
      if (!cb) continue
      const title = pickText(lang, cb.title_ru, cb.title_en)

      if (cb.type === 'hotel') {
        const sum = (b.selected_rooms ?? []).reduce((s, r) => s + (r.price || 0), 0)
        accTotal += sum
        const nights = getNights(days, tripStart, tripEnd, b.id)
        if (title) accItems.push(nights ? `${title} (${nights} ${lang === 'ru' ? 'н.' : 'n.'})` : title)
      } else if (cb.type === 'activity') {
        actTotal += b.price || 0
        if (title) actItems.push(title)
      } else if (cb.type === 'transfer') {
        trTotal += b.price || 0
        if (title) trItems.push(title)
      }
    }
  }

  return {
    accommodation: { total: accTotal, desc: accItems.join(' + ') },
    activities: { total: actTotal, desc: actItems.join(', ') },
    transfers: { total: trTotal, desc: trItems.join(', ') },
    total: accTotal + actTotal + trTotal,
  }
}