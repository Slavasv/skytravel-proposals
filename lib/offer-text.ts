// Генерация текста оффера для WhatsApp (с готовыми отступами — копируется и вставляется).
// Два режима: 'admin' — с нетто/букинг/отель (внутренний), 'client' — только цена клиенту.

export type QuoteLite = {
  source: string // 'netto' | 'booking' | 'hotel'
  amount: number | null
  currency: string | null
  commission_pct: number | null
  is_chosen: boolean
  sort_order?: number
}
export type RoomLite = {
  room_type?: string | null
  room_link?: string | null
  room_note?: string | null
  sale_price?: number | null
  sale_currency?: string | null
  extra_label?: string | null
  extra_price?: number | null
  quotes?: QuoteLite[]
}
export type OfferLite = {
  hotel_name?: string | null
  date_from?: string | null
  date_to?: string | null
  occupancy?: string | null
  meal?: string | null
  rooms: RoomLite[]
}

const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const SOURCE_LABEL: Record<string, string> = { netto: 'Нетто', booking: 'Букинг', hotel: 'Отель' }

function money(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return ''
  const n = Math.round(amount).toLocaleString('ru-RU').replace(/ /g, ' ')
  const cur = (currency || 'EUR').toUpperCase()
  const word = cur === 'EUR' ? 'евро' : cur
  return `${n} ${word}`
}

export function formatDateRange(from?: string | null, to?: string | null): string {
  const df = from ? new Date(from) : null
  const dt = to ? new Date(to) : null
  const ok = (d: Date | null) => d && !isNaN(d.getTime())
  if (ok(df) && ok(dt)) {
    if (df!.getMonth() === dt!.getMonth() && df!.getFullYear() === dt!.getFullYear()) {
      return `${df!.getDate()} - ${dt!.getDate()} ${MONTHS_RU[dt!.getMonth()]}`
    }
    return `${df!.getDate()} ${MONTHS_RU[df!.getMonth()]} - ${dt!.getDate()} ${MONTHS_RU[dt!.getMonth()]}`
  }
  const one = ok(df) ? df! : ok(dt) ? dt! : null
  return one ? `${one.getDate()} ${MONTHS_RU[one.getMonth()]}` : ''
}

function orderedQuotes(room: RoomLite): QuoteLite[] {
  const rank: Record<string, number> = { netto: 0, booking: 1, hotel: 2 }
  return [...(room.quotes || [])].sort(
    (a, b) => (rank[a.source] ?? 9) - (rank[b.source] ?? 9) || (a.sort_order ?? 0) - (b.sort_order ?? 0)
  )
}

export function buildOfferText(offer: OfferLite, mode: 'admin' | 'client'): string {
  const lines: string[] = []
  const head: string[] = []
  const range = formatDateRange(offer.date_from, offer.date_to)
  if (range) head.push(`Даты: ${range}`)
  if (offer.occupancy?.trim()) head.push(`Размещение: ${offer.occupancy.trim()}`)
  if (offer.meal?.trim()) head.push(`Питание: ${offer.meal.trim()}`)

  const rooms = (offer.rooms || [])
  rooms.forEach((room, i) => {
    const block: string[] = []
    // шапка отеля повторяется? Нет — шапка одна на оффер (один отель). Печатаем один раз сверху.
    if (i === 0) {
      if (head.length) block.push(head.join('\n'))
      if (offer.hotel_name?.trim()) { block.push(''); block.push(offer.hotel_name.trim()) }
      block.push('')
    }
    const label = (room.room_note?.trim() || room.room_type?.trim() || '')
    if (label) block.push(label)
    if (room.room_type?.trim() && room.room_note?.trim() && room.room_type.trim() !== room.room_note.trim()) {
      // если есть и заметка, и тип — тип отдельной строкой ниже заметки
      block.push(room.room_type.trim())
    }
    if (room.room_link?.trim()) block.push(room.room_link.trim())
    block.push('')

    if (mode === 'admin') {
      for (const q of orderedQuotes(room)) {
        const src = SOURCE_LABEL[q.source] || q.source
        const val = money(q.amount, q.currency)
        if (!val) continue
        const comm = q.source === 'netto' && q.commission_pct != null ? ` (комиссия ${q.commission_pct} % у нас)` : ''
        block.push(`${src} - ${val}${comm}`)
      }
    } else {
      const val = money(room.sale_price, room.sale_currency)
      if (val) block.push(val)
    }
    if (room.extra_price != null) {
      const label2 = room.extra_label?.trim() || 'Дополнительный номер'
      block.push(`${label2} - ${money(room.extra_price, room.sale_currency || room.quotes?.[0]?.currency)}`)
    }
    lines.push(block.join('\n'))
  })

  // разделитель между номерами (внутри одного отеля) — пустая строка уже есть; между офферами разделитель на уровне вызова
  return lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}
