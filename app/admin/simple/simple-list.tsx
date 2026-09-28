'use client'

import { useState, useMemo, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateRange, type Lang } from '@/lib/offer-text'
import { deleteSimple } from './actions'

type RoomLite = { room_type: string | null; price: number | null; currency: string | null; sort_order: number | null }
export type SimpleListRow = {
  id: string
  title: string | null
  hotel_name: string | null
  date_from: string | null
  date_to: string | null
  occupancy: string | null
  meal: string | null
  status: string | null
  updated_at: string
  simple_rooms: RoomLite[] | null
  requests: { request_code: string | null } | { request_code: string | null }[] | null
  clients: { name: string | null } | { name: string | null }[] | null
  companies?: { name: string | null } | { name: string | null }[] | null
}

const STATUS: Record<string, { en: string; ru: string; tone: string }> = {
  draft: { en: 'draft', ru: 'черновик', tone: 'adm-tone-low' },
  sent: { en: 'sent', ru: 'отправлен', tone: 'adm-tone-info' },
}
const MEAL_LABEL: Record<string, { en: string; ru: string }> = {
  room_only: { en: 'Room only', ru: 'Без питания' },
  breakfast: { en: 'Breakfast', ru: 'Завтраки' },
  half_board: { en: 'Half board', ru: 'Полупансион' },
  full_board: { en: 'Full board', ru: 'Полный пансион' },
  all_inclusive: { en: 'All inclusive', ru: 'Всё включено' },
}

function money(v: number | null, cur: string | null): string {
  if (v == null) return '—'
  const n = Math.round(v).toLocaleString('ru-RU').replace(/ /g, ' ')
  const c = (cur || 'EUR').toUpperCase()
  const sym = c === 'EUR' ? '€ ' : c === 'USD' ? '$ ' : c + ' '
  return `${sym}${n}`
}
function pickRoom(rooms: RoomLite[] | null): { price: number | null; cur: string | null } {
  const list = [...(rooms || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  return list[0] ? { price: list[0].price, cur: list[0].currency } : { price: null, cur: null }
}

function Row({ r, onOpen, lang, T, showBrand }: { r: SimpleListRow; onOpen: () => void; lang: Lang; T: (en: string, ru: string) => string; showBrand: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const req = Array.isArray(r.requests) ? r.requests[0] : r.requests
  const cli = Array.isArray(r.clients) ? r.clients[0] : r.clients
  const comp = Array.isArray(r.companies) ? r.companies[0] : r.companies
  const sub = [cli?.name, req?.request_code].filter(Boolean).join(' · ')
  const room = pickRoom(r.simple_rooms)
  const st = STATUS[r.status || 'draft'] || STATUS.draft
  const range = formatDateRange(r.date_from, r.date_to, lang)
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 160) })
    setMenuOpen(true)
  }
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation(); setMenuOpen(false)
    if (!confirm(T('Delete this simple proposal?', 'Удалить этот симпл?'))) return
    startTransition(async () => { await deleteSimple(r.id) })
  }

  return (
    <tr className="adm-row" onClick={onOpen} style={{ opacity: isPending ? 0.4 : 1 }}>
      <td>
        <span className="adm-cell-strong">{r.hotel_name || (lang === 'ru' ? 'Без отеля' : 'No hotel')}</span>
        {sub && <div className="adm-cell-code">{sub}</div>}
      </td>
      {showBrand && <td><span className="adm-pill adm-tone-info">{comp?.name || '—'}</span></td>}
      <td style={{ color: range ? undefined : '#9C988E' }}>{range || '—'}</td>
      <td style={{ color: r.occupancy ? undefined : '#9C988E' }}>{r.occupancy || '—'}</td>
      <td style={{ color: r.meal ? undefined : '#9C988E' }}>{r.meal ? (MEAL_LABEL[r.meal] ? T(MEAL_LABEL[r.meal].en, MEAL_LABEL[r.meal].ru) : r.meal) : '—'}</td>
      <td className="adm-cell-strong">{money(room.price, room.cur)}</td>
      <td><span className={`adm-pill ${st.tone}`}>{T(st.en, st.ru)}</span></td>
      <td className="adm-right" onClick={stop}>
        <button ref={btnRef} className="adm-dots" disabled={isPending} aria-label="Actions"
          onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}>⋯</button>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div className="adm-menu" style={{ top: menuPos.top, left: menuPos.left }}>
              <button className="adm-menu-item danger" onClick={handleDelete}>{T('Delete', 'Удалить')}</button>
            </div>
          </>
        )}
      </td>
    </tr>
  )
}

export default function SimpleList({ rows, lang, showBrand = false }: { rows: SimpleListRow[]; lang: Lang; showBrand?: boolean }) {
  const router = useRouter()
  const T = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const [q, setQ] = useState('')
  const safe = Array.isArray(rows) ? rows : []

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return safe
    return safe.filter((r) => {
      const cli = Array.isArray(r.clients) ? r.clients[0] : r.clients
      const hay = [r.hotel_name, r.occupancy, cli?.name, ...(r.simple_rooms || []).map((x) => x.room_type)].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(s)
    })
  }, [safe, q])

  return (
    <div>
      <div className="adm-toolbar">
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={T('Search by hotel, client…', 'Поиск по отелю, клиенту…')} className="adm-field adm-field-search" />
      </div>
      {filtered.length === 0 ? (
        <div className="adm-empty">{safe.length === 0 ? T('No simple proposals yet. Create one from an offer.', 'Симплов пока нет. Создаются из оффера.') : T('Nothing found.', 'Ничего не найдено.')}</div>
      ) : (
        <div className="adm-tcard"><div className="adm-tscroll">
          <table className="adm-table">
            <thead><tr>
              <th>{T('Hotel', 'Отель')}</th>{showBrand && <th>{T('Brand', 'Бренд')}</th>}<th>{T('Dates', 'Даты')}</th><th>{T('Occupancy', 'Размещение')}</th><th>{T('Meals', 'Питание')}</th><th>{T('Client price', 'Цена клиенту')}</th><th>{T('Status', 'Статус')}</th><th> </th>
            </tr></thead>
            <tbody>
              {filtered.map((r) => (
                <Row key={r.id} r={r} lang={lang} T={T} showBrand={showBrand} onOpen={() => router.push(`/admin/simple/${r.id}`)} />
              ))}
            </tbody>
          </table>
        </div></div>
      )}
    </div>
  )
}
