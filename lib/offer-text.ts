// Генерация текста оффера для WhatsApp (с готовыми отступами — копируется и вставляется).
// Два режима: 'admin' — с нетто/букинг/отель (внутренний), 'client' — только цена клиенту.
// lang — язык текста (ru/en), т.к. приложение двуязычное.

export type Lang = 'ru' | 'en'

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
  quotes?: QuoteLite[]
}
export type OfferLite = {
  hotel_name?: string | null
  date_from?: string | null
  date_to?: string | null
  occupancy?: string | null
  meal?: string | null // уже локализованная подпись
  rooms: RoomLite[]
}

const MONTHS: Record<Lang, string[]> = {
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}
const SOURCE_LABEL: Record<Lang, Record<string, string>> = {
  ru: { netto: 'Нетто', booking: 'Букинг', hotel: 'Отель' },
  en: { netto: 'Net', booking: 'Booking', hotel: 'Hotel' },
}
const WORDS = {
  ru: { dates: 'Даты', occupancy: 'Размещение', meal: 'Питание', commission: (p: number) => `(комиссия ${p} % у нас)` },
  en: { dates: 'Dates', occupancy: 'Occupancy', meal: 'Meals', commission: (p: number) => `(our commission ${p}%)` },
}

function money(amount: number | null | undefined, currency: string | null | undefined, lang: Lang): string {
  if (amount == null) return ''
  const n = Math.round(amount).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US').replace(/ /g, ' ')
  const cur = (currency || 'EUR').toUpperCase()
  const word = cur === 'EUR' ? (lang === 'ru' ? 'евро' : 'EUR') : cur
  return `${n} ${word}`
}

export function formatDateRange(from?: string | null, to?: string | null, lang: Lang = 'ru'): string {
  const M = MONTHS[lang]
  const df = from ? new Date(from) : null
  const dt = to ? new Date(to) : null
  const ok = (d: Date | null) => d && !isNaN(d.getTime())
  if (ok(df) && ok(dt)) {
    if (df!.getMonth() === dt!.getMonth() && df!.getFullYear() === dt!.getFullYear()) {
      return `${df!.getDate()} - ${dt!.getDate()} ${M[dt!.getMonth()]}`
    }
    return `${df!.getDate()} ${M[df!.getMonth()]} - ${dt!.getDate()} ${M[dt!.getMonth()]}`
  }
  const one = ok(df) ? df! : ok(dt) ? dt! : null
  return one ? `${one.getDate()} ${M[one.getMonth()]}` : ''
}

function orderedQuotes(room: RoomLite): QuoteLite[] {
  const rank: Record<string, number> = { netto: 0, booking: 1, hotel: 2 }
  return [...(room.quotes || [])].sort(
    (a, b) => (rank[a.source] ?? 9) - (rank[b.source] ?? 9) || (a.sort_order ?? 0) - (b.sort_order ?? 0)
  )
}

export function buildOfferText(offer: OfferLite, mode: 'admin' | 'client', lang: Lang = 'ru'): string {
  const W = WORDS[lang]
  const lines: string[] = []
  const head: string[] = []
  const range = formatDateRange(offer.date_from, offer.date_to, lang)
  if (range) head.push(`${W.dates}: ${range}`)
  if (offer.occupancy?.trim()) head.push(`${W.occupancy}: ${offer.occupancy.trim()}`)
  if (offer.meal?.trim()) head.push(`${W.meal}: ${offer.meal.trim()}`)

  const rooms = offer.rooms || []
  rooms.forEach((room, i) => {
    const block: string[] = []
    if (i === 0) {
      if (head.length) block.push(head.join('\n'))
      if (offer.hotel_name?.trim()) { block.push(''); block.push(offer.hotel_name.trim()) }
      block.push('')
    }
    const label = (room.room_note?.trim() || room.room_type?.trim() || '')
    if (label) block.push(label)
    if (room.room_type?.trim() && room.room_note?.trim() && room.room_type.trim() !== room.room_note.trim()) {
      block.push(room.room_type.trim())
    }
    if (room.room_link?.trim()) block.push(room.room_link.trim())
    block.push('')

    if (mode === 'admin') {
      for (const q of orderedQuotes(room)) {
        const src = SOURCE_LABEL[lang][q.source] || q.source
        const val = money(q.amount, q.currency, lang)
        if (!val) continue
        const comm = q.source === 'netto' && q.commission_pct != null ? ` ${W.commission(q.commission_pct)}` : ''
        block.push(`${src} - ${val}${comm}`)
      }
    } else {
      const val = money(room.sale_price, room.sale_currency, lang)
      if (val) block.push(val)
    }
    lines.push(block.join('\n'))
  })

  return lines.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}
