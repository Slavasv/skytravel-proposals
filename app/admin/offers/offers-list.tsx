'use client'

import { useState, useMemo, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateRange, type Lang } from '@/lib/offer-text'
import { deleteOffer } from './actions'

type RoomLite = { room_type: string | null; sale_price: number | null; sale_currency: string | null; is_recommended: boolean; sort_order: number | null }
export type OfferListRow = {
  id: string
  title: string | null
  hotel_name: string | null
  date_from: string | null
  date_to: string | null
  occupancy: string | null
  meal: string | null
  status: string | null
  updated_at: string
  offer_rooms: RoomLite[] | null
  requests: { request_code: string | null } | { request_code: string | null }[] | null
  clients: { name: string | null } | { name: string | null }[] | null
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

function pickRoom(rooms: RoomLite[] | null): { cat: string; price: number | null; cur: string | null; more: number } {
  const list = [...(rooms || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  if (list.length === 0) return { cat: '', price: null, cur: null, more: 0 }
  const rec = list.find((r) => r.is_recommended) || list[0]
  return { cat: rec.room_type || '', price: rec.sale_price, cur: rec.sale_currency, more: list.length - 1 }
}

function OfferRow({ r, onOpen, lang, T }: { r: OfferListRow; onOpen: () => void; lang: Lang; T: (en: string, ru: string) => string }) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const req = Array.isArray(r.requests) ? r.requests[0] : r.requests
  const cli = Array.isArray(r.clients) ? r.clients[0] : r.clients
  const sub = [cli?.name, req?.request_code].filter(Boolean).join(' · ')
  const room = pickRoom(r.offer_rooms)
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
    if (!confirm(T(`Delete offer${r.hotel_name ? ` “${r.hotel_name}”` : ''}?\n\nThis cannot be undone.`, `Удалить оффер${r.hotel_name ? ` «${r.hotel_name}»` : ''}?\n\nЭто действие необратимо.`))) return
    startTransition(async () => { await deleteOffer(r.id) })
  }

  return (
    <tr className="adm-row" onClick={onOpen} style={{ opacity: isPending ? 0.4 : 1 }}>
      <td>
        <span className="adm-cell-strong">{r.hotel_name || 'Без отеля'}</span>
        {sub && <div className="adm-cell-code">{sub}</div>}
      </td>
      <td style={{ color: range ? undefined : '#9C988E' }}>{range || '—'}</td>
      <td style={{ color: r.occupancy ? undefined : '#9C988E' }}>{r.occupancy || '—'}</td>
      <td style={{ color: r.meal ? undefined : '#9C988E' }}>{r.meal ? (MEAL_LABEL[r.meal] ? T(MEAL_LABEL[r.meal].en, MEAL_LABEL[r.meal].ru) : r.meal) : '—'}</td>
      <td style={{ color: room.cat ? undefined : '#9C988E' }}>
        {room.cat || '—'}{room.more > 0 && <span className="adm-cell-faint"> +{room.more}</span>}
      </td>
      <td className="adm-cell-strong">{money(room.price, room.cur)}</td>
      <td><span className={`adm-pill ${st.tone}`}>{T(st.en, st.ru)}</span></td>
      <td className="adm-right" onClick={stop}>
        <button ref={btnRef} className="adm-dots" disabled={isPending} aria-label="Действия"
          onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}>⋯</button>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div className="adm-menu" style={{ top: menuPos.top, left: menuPos.left }}>
              <button className="adm-menu-item danger" onClick={handleDelete}>Удалить</button>
            </div>
          </>
        )}
      </td>
    </tr>
  )
}

export default function OffersList({ rows, lang }: { rows: OfferListRow[]; lang: Lang }) {
  const router = useRouter()
  const T = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const [q, setQ] = useState('')
  const safe = Array.isArray(rows) ? rows : []

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return safe
    return safe.filter((r) => {
      const cli = Array.isArray(r.clients) ? r.clients[0] : r.clients
      const hay = [r.hotel_name, r.occupancy, r.meal, cli?.name, ...(r.offer_rooms || []).map((x) => x.room_type)]
        .filter(Boolean).join(' ').toLowerCase()
      return hay.includes(s)
    })
  }, [safe, q])

  return (
    <div>
      <div className="adm-toolbar">
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={T('Search by hotel, client, room…', 'Поиск по отелю, клиенту, номеру…')} className="adm-field adm-field-search" />
      </div>
      {filtered.length === 0 ? (
        <div className="adm-empty">{safe.length === 0 ? T('No offers yet. Click “+ New offer”.', 'Офферов пока нет. Нажмите «+ Новый оффер».') : T('Nothing found.', 'Ничего не найдено.')}</div>
      ) : (
        <div className="adm-tcard"><div className="adm-tscroll">
          <table className="adm-table">
            <thead><tr>
              <th>{T('Hotel', 'Отель')}</th><th>{T('Dates', 'Даты')}</th><th>{T('Occupancy', 'Размещение')}</th><th>{T('Meals', 'Питание')}</th><th>{T('Room category', 'Категория номера')}</th><th>{T('Client price', 'Цена клиенту')}</th><th>{T('Status', 'Статус')}</th><th> </th>
            </tr></thead>
            <tbody>
              {filtered.map((r) => (
                <OfferRow key={r.id} r={r} lang={lang} T={T} onOpen={() => router.push(`/admin/offers/${r.id}`)} />
              ))}
            </tbody>
          </table>
        </div></div>
      )}
    </div>
  )
}
