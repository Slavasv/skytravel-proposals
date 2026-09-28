'use client'

import { useState, useMemo, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { deleteBooking } from './actions'
import { useT } from '@/lib/i18n-client'

export type BookingRow = {
  id: string
  booking_code: string | null
  start_date: string | null
  end_date: string | null
  destination: string | null
  status: string | null
  created_at: string
  clients?: { name: string; client_code: string | null } | { name: string; client_code: string | null }[] | null
  booking_services?: { gross: number | null; net: number | null; currency: string | null }[] | null
  companies?: { name: string | null } | { name: string | null }[] | null
}

function brandName(b: { companies?: { name: string | null } | { name: string | null }[] | null }): string {
  const co = Array.isArray(b.companies) ? b.companies[0] : b.companies
  return co?.name || '—'
}

type Tone = 'work' | 'mid' | 'done' | 'cancel' | 'info' | 'high' | 'low'
const STATUS_META: Record<string, { tone: Tone }> = {
  draft:     { tone: 'low' },
  confirmed: { tone: 'done' },
  cancelled: { tone: 'cancel' },
}
const STATUS_ORDER = ['draft', 'confirmed', 'cancelled']

function statusLabel(status: string | null | undefined, t: (en: string, ru: string) => string): string {
  switch (status) {
    case 'confirmed': return t('Confirmed', 'Подтверждено')
    case 'cancelled': return t('Cancelled', 'Отменено')
    default: return t('Draft', 'Черновик')
  }
}

function money(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseISO(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function BookingRowItem({ b, tripText, createdText, showBrand, onOpen }: {
  b: BookingRow
  tripText: string
  createdText: string
  showBrand: boolean
  onOpen: () => void
}) {
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const client = Array.isArray(b.clients) ? b.clients[0] : b.clients
  const tone = STATUS_META[b.status || 'draft']?.tone ?? 'low'

  // комиссия по валютам
  const totals = (b.booking_services ?? []).reduce((acc, s) => {
    const cur = s.currency || 'EUR'
    acc[cur] = (acc[cur] ?? 0) + ((s.gross ?? 0) - (s.net ?? 0))
    return acc
  }, {} as Record<string, number>)
  const commissionLine = Object.entries(totals)
    .filter(([, v]) => v !== 0)
    .map(([cur, v]) => `${money(v)} ${cur}`)
    .join(' · ')

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 160) })
    setMenuOpen(true)
  }
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation(); setMenuOpen(false)
    if (!confirm(t('Delete this booking?\n\nAll services inside will be deleted too.', 'Удалить это бронирование?\n\nВсе услуги внутри также будут удалены.'))) return
    startTransition(async () => { await deleteBooking(b.id) })
  }

  return (
    <tr className="adm-row" onClick={onOpen} style={{ opacity: isPending ? 0.4 : 1 }}>
      <td>
        <span className="adm-cell-strong">{client?.name || t('No client', 'Без клиента')}</span>
        {b.booking_code && <div className="adm-cell-code">{b.booking_code}</div>}
      </td>
      {showBrand && <td><span className="adm-pill adm-tone-info">{brandName(b)}</span></td>}
      <td style={{ color: b.destination ? undefined : '#9C988E' }}>{b.destination || '—'}</td>
      <td className="adm-cell-muted" style={{ whiteSpace: 'nowrap', color: tripText ? undefined : '#9C988E' }}>{tripText || '—'}</td>
      <td>
        <span className={`adm-pill adm-tone-${tone}`}>{statusLabel(b.status, t)}</span>
      </td>
      <td style={{ whiteSpace: 'nowrap', color: commissionLine ? 'var(--admin-success)' : '#9C988E', fontWeight: commissionLine ? 600 : undefined }}>{commissionLine || '—'}</td>
      <td className="adm-cell-muted" style={{ whiteSpace: 'nowrap' }}>{createdText}</td>
      <td className="adm-right" onClick={stop}>
        <button ref={btnRef} className="adm-dots" disabled={isPending} aria-label={t('Actions', 'Действия')}
          onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}>⋯</button>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div className="adm-menu" style={{ top: menuPos.top, left: menuPos.left }}>
              <button className="adm-menu-item danger" onClick={handleDelete}>{t('Delete', 'Удалить')}</button>
            </div>
          </>
        )}
      </td>
    </tr>
  )
}

export default function BookingsList({ bookings, showBrand = false }: { bookings: BookingRow[]; showBrand?: boolean }) {
  const t = useT()
  const router = useRouter()
  const isRu = t('en', 'ru') === 'ru'
  const MONTHS = isRu ? MONTHS_RU : MONTHS_EN

  const safe = Array.isArray(bookings) ? bookings : []
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return safe.filter((b) => {
      if (statusFilter && b.status !== statusFilter) return false
      if (!q) return true
      const client = Array.isArray(b.clients) ? b.clients[0] : b.clients
      const hay = [client?.name, b.booking_code, b.destination].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [safe, search, statusFilter])

  function fmtDay(d: Date) { return `${d.getDate()} ${MONTHS[d.getMonth()]}` }
  function tripRange(b: BookingRow): string {
    const s = parseISO(b.start_date), e = parseISO(b.end_date)
    if (!s && !e) return ''
    if (s && e) {
      if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) return `${s.getDate()}–${e.getDate()} ${MONTHS[e.getMonth()]}`
      return `${fmtDay(s)}–${fmtDay(e)}`
    }
    return fmtDay((s || e)!)
  }
  function createdText(b: BookingRow): string {
    const d = parseISO(b.created_at)
    return d ? fmtDay(d) : ''
  }

  return (
    <div>
      <div className="adm-toolbar">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('Search by client, code, destination…', 'Поиск по клиенту, коду, направлению…')}
          className="adm-field adm-field-search" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="adm-field" style={{ minWidth: '180px' }}>
          <option value="">{t('All statuses', 'Все статусы')}</option>
          {STATUS_ORDER.map((v) => <option key={v} value={v}>{statusLabel(v, t)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="adm-empty">
          {safe.length === 0 ? t('No bookings yet.', 'Пока нет бронирований.') : t('Nothing matches your filters.', 'Ничего не найдено по вашим фильтрам.')}
        </div>
      ) : (
        <div className="adm-tcard">
          <div className="adm-tscroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>{t('Client', 'Клиент')}</th>
                  {showBrand && <th>{t('Brand', 'Бренд')}</th>}
                  <th>{t('Destination', 'Направление')}</th>
                  <th>{t('Trip dates', 'Даты поездки')}</th>
                  <th>{t('Status', 'Статус')}</th>
                  <th>{t('Commission', 'Комиссия')}</th>
                  <th>{t('Created', 'Создано')}</th>
                  <th> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <BookingRowItem
                    key={b.id} b={b}
                    tripText={tripRange(b)}
                    createdText={createdText(b)}
                    showBrand={showBrand}
                    onOpen={() => router.push(`/admin/bookings/${b.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
