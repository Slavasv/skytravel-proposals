// Общие типы и функции для всех шаблонов ваучера (Дизайн 1, 2, 3...).
// Дизайны отличаются только вёрсткой — данные и вычисления общие.

export type Guest = { title?: string; name?: string; is_child?: boolean; birth_date?: string }
export type Transfer = { date?: string; from?: string; to?: string; type?: string }
export type Hotel = {
  id: string; sort_order: number
  city: string | null; country: string | null; booking_ref: string | null
  name: string | null; address: string | null; phone: string | null
  check_in: string | null; check_out: string | null; nights: string | null
  room_type: string | null; meal_plan: string | null; extras: string | null
}

export const CHILD_TITLES = new Set(['Miss', 'Mstr', 'Chd', 'Inf'])
export const TITLE_BEFORE = new Set(['Mr', 'Mrs', 'Miss', 'Mstr'])
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
export const serif = "Georgia, 'Times New Roman', serif"

export function parseDMY(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = s.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (!m) return null
  const d = +m[1], mo = +m[2], y = +m[3]
  const date = new Date(y, mo-1, d)
  if (date.getFullYear()!==y || date.getMonth()!==mo-1 || date.getDate()!==d) return null
  return date
}
export function fullYears(birth: Date, ref: Date): number {
  let age = ref.getFullYear()-birth.getFullYear()
  const m = ref.getMonth()-birth.getMonth()
  if (m<0 || (m===0 && ref.getDate()<birth.getDate())) age--
  return age
}
export function prettyRange(inS: string | null, outS: string | null): string {
  const a = parseDMY(inS), b = parseDMY(outS)
  if (!a || !b) return [inS, outS].filter(Boolean).join(' – ')
  const sameYear = a.getFullYear()===b.getFullYear()
  const sameMonth = sameYear && a.getMonth()===b.getMonth()
  if (sameMonth) return `${a.getDate()} — ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`
  if (sameYear) return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`
  return `${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`
}
export function prettyIssue(s: string | null): string {
  const d = parseDMY(s)
  if (!d) return s || ''
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
}
export function renderMarkdown(text: string): string {
  const esc = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  return esc.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/\n/g,'<br/>')
}
export function occupancy(guests: Guest[]): string {
  const adults = guests.filter(g => !CHILD_TITLES.has(g.title || '')).length
  const children = guests.filter(g => CHILD_TITLES.has(g.title || '') && g.title !== 'Inf').length
  const infants = guests.filter(g => g.title === 'Inf').length
  const p: string[] = []
  if (adults>0) p.push(`${adults} ${adults===1?'Adult':'Adults'}`)
  if (children>0) p.push(`${children} ${children===1?'Child':'Children'}`)
  if (infants>0) p.push(`${infants} ${infants===1?'Infant':'Infants'}`)
  return p.join(', ') || '—'
}