'use client'

import { useState, useMemo, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { deleteVoucher, duplicateVoucher } from '../actions'
import { useT } from '@/lib/i18n-client'
import { normalizeFlightData } from '@/lib/flight-voucher'

type Guest = { name?: string; title?: string }
type Hotel = { name?: string | null; city?: string | null; country?: string | null; check_in?: string | null; check_out?: string | null; sort_order?: number }

export type VoucherRow = {
  id: string
  slug: string | null
  voucher_no: string | null
  booking_ref: string | null
  issue_date: string | null
  updated_at: string
  owner_id: string | null
  voucher_type?: string | null
  flight_data?: unknown
  guests: unknown
  voucher_hotels?: Hotel[] | null
  profiles?: { email: string } | { email: string }[] | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(s: string | null): string {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

// краткая строка маршрута для авиаваучера: SCQ → BCN → NAP
function flightRoute(flightData: unknown): string {
  const f = normalizeFlightData(flightData)
  const codes: string[] = []
  for (const s of f.outbound) {
    if (s.from && !codes.includes(s.from)) codes.push(s.from)
    if (s.to) codes.push(s.to)
  }
  return codes.join(' → ')
}

function guestNames(guests: unknown): string[] {
  if (!Array.isArray(guests)) return []
  return guests
    .filter((g): g is Guest => !!g && typeof g === 'object')
    .map((g) => `${g.title ? g.title + ' ' : ''}${g.name ?? ''}`.trim())
    .filter(Boolean)
}

// первый гость (по порядку в массиве)
function firstGuestName(guests: unknown): string {
  const names = guestNames(guests)
  return names[0] || ''
}

// первый отель (по sort_order) + даты
function firstHotelLine(hotels: Hotel[] | null | undefined): string {
  if (!hotels || hotels.length === 0) return ''
  const sorted = [...hotels].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const h = sorted[0]
  const parts: string[] = []
  if (h.name) parts.push(h.name)
  const place = [h.city, h.country].filter(Boolean).join(' | ')
  if (place && !h.name) parts.push(place)
  const dates = [h.check_in, h.check_out].filter(Boolean).join(' – ')
  if (dates) parts.push(dates)
  return parts.join(' · ')
}

function VoucherRowItem({ v, showOwner, onOpen }: { v: VoucherRow; showOwner: boolean; onOpen: () => void }) {
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [pdfBusy, setPdfBusy] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const ownerEmail = Array.isArray(v.profiles) ? v.profiles[0]?.email : v.profiles?.email
  const isFlight = v.voucher_type === 'flight'
  const flight = isFlight ? normalizeFlightData(v.flight_data) : null
  const mainName = isFlight
    ? (flight!.passengers[0]?.name || t('Flight voucher', 'Авиаваучер'))
    : (firstGuestName(v.guests) || t('Untitled voucher', 'Ваучер без названия'))
  const detailLine = isFlight
    ? [flight!.airline, flightRoute(v.flight_data), flight!.pnr].filter(Boolean).join(' · ')
    : firstHotelLine(v.voucher_hotels)
  const guestCount = isFlight ? flight!.passengers.length : guestNames(v.guests).length
  const code = v.voucher_no || v.booking_ref || ''

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 160) })
    setMenuOpen(true)
  }
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  async function handlePdf(e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen(false)
    if (!v.slug) { alert(t('This voucher has no link yet.', 'У этого ваучера пока нет ссылки.')); return }
    if (pdfBusy) return

    setPdfBusy(true)
    try {
      const res = await fetch(`/api/pdf?slug=${encodeURIComponent(v.slug)}`)
      if (!res.ok) throw new Error('PDF request failed')

      // имя файла берём из заголовка ответа (сервер собрал красивое имя)
      let fileName = `${v.slug}.pdf`
      const cd = res.headers.get('Content-Disposition') || ''
      const star = cd.match(/filename\*=UTF-8''([^;]+)/i)
      const plain = cd.match(/filename="([^"]+)"/i)
      if (star?.[1]) fileName = decodeURIComponent(star[1])
      else if (plain?.[1]) fileName = decodeURIComponent(plain[1])

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF download failed:', err)
      alert(t('Could not generate PDF. Please try again.', 'Не удалось сформировать PDF. Пожалуйста, попробуйте ещё раз.'))
    } finally {
      setPdfBusy(false)
    }
  }

  function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen(false)
    startTransition(async () => { await duplicateVoucher(v.id) })
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setMenuOpen(false)
    if (!confirm(t(`Delete voucher for "${mainName}"?\n\nThis cannot be undone.`, `Удалить ваучер для «${mainName}»?\n\nЭто действие необратимо.`))) return
    startTransition(async () => { await deleteVoucher(v.id) })
  }

  return (
    <tr className="adm-row" onClick={onOpen} style={{ opacity: isPending ? 0.4 : 1 }}>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span className="adm-cell-strong">{mainName}</span>
          {guestCount > 1 && (
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>+{guestCount - 1}</span>
          )}
        </div>
        {code && <div className="adm-cell-code">{code}</div>}
      </td>
      <td>
        {isFlight
          ? <span className="adm-pill adm-tone-mid">{t('Flight', 'Авиа')}</span>
          : <span className="adm-pill adm-tone-info">{t('Accommodation', 'Гостиница')}</span>}
      </td>
      <td style={{ color: detailLine ? undefined : '#9C988E' }}>
        {detailLine || (isFlight ? t('Flight details not filled yet', 'Данные перелёта ещё не заполнены') : t('No hotel yet', 'Отель ещё не указан'))}
      </td>
      {showOwner && <td className="adm-cell-muted">{ownerEmail || '—'}</td>}
      <td className="adm-cell-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(v.updated_at)}</td>
      <td className="adm-right" onClick={stop}>
        <button ref={btnRef} className="adm-dots" disabled={isPending} aria-label={t('Actions', 'Действия')}
          onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}>⋯</button>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div className="adm-menu" style={{ top: menuPos.top, left: menuPos.left }}>
              <button className="adm-menu-item" onClick={handlePdf} disabled={pdfBusy}>
                {pdfBusy ? t('Generating…', 'Формирование…') : t('Download PDF', 'Скачать PDF')}
              </button>
              <button className="adm-menu-item" onClick={handleDuplicate}>{t('Duplicate', 'Дублировать')}</button>
              <button className="adm-menu-item danger" onClick={handleDelete}>{t('Delete', 'Удалить')}</button>
            </div>
          </>
        )}
      </td>
    </tr>
  )
}

export default function VouchersList({ vouchers, showOwner }: { vouchers: VoucherRow[]; showOwner: boolean }) {
  const t = useT()
  const router = useRouter()
  const safeVouchers = Array.isArray(vouchers) ? vouchers : []
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'hotel' | 'flight'>('all')

  const flightCount = safeVouchers.filter((v) => v.voucher_type === 'flight').length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return safeVouchers.filter((v) => {
      const isFlight = v.voucher_type === 'flight'
      if (typeFilter === 'flight' && !isFlight) return false
      if (typeFilter === 'hotel' && isFlight) return false
      if (!q) return true
      let hay = guestNames(v.guests).join(' ')
      if (isFlight) {
        const f = normalizeFlightData(v.flight_data)
        hay += ' ' + f.passengers.map((p) => p.name).join(' ') + ' ' + f.pnr + ' ' + f.airline
      }
      return hay.toLowerCase().includes(q)
    })
  }, [safeVouchers, search, typeFilter])

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', fontSize: '12px', fontWeight: 500, borderRadius: '6px',
    cursor: 'pointer', letterSpacing: '0.03em', border: 'none', fontFamily: 'inherit',
    background: active ? 'var(--admin-text-on-dark)' : 'transparent',
    color: active ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)',
  })

  return (
    <div>
      {flightCount > 0 && (
        <div style={{ display: 'inline-flex', gap: '2px', background: 'var(--admin-border-card)', borderRadius: '8px', padding: '3px', marginBottom: '12px' }}>
          <button type="button" onClick={() => setTypeFilter('all')} style={tabStyle(typeFilter === 'all')}>{t('All', 'Все')}</button>
          <button type="button" onClick={() => setTypeFilter('hotel')} style={tabStyle(typeFilter === 'hotel')}>{t('Hotel', 'Гостиничные')}</button>
          <button type="button" onClick={() => setTypeFilter('flight')} style={tabStyle(typeFilter === 'flight')}>✈ {t('Flight', 'Авиа')}</button>
        </div>
      )}

      <div className="adm-toolbar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('Search by guest name…', 'Поиск по имени гостя…')}
          className="adm-field adm-field-search"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="adm-empty">
          {safeVouchers.length === 0 ? t('No vouchers yet. Click + New voucher to create one.', 'Ваучеров пока нет. Нажмите «+ Новый ваучер», чтобы создать.') : t('Nothing matches your search.', 'Ничего не найдено по вашему запросу.')}
        </div>
      ) : (
        <div className="adm-tcard">
          <div className="adm-tscroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>{t('Guest / Booking', 'Гость / Бронь')}</th>
                  <th>{t('Type', 'Тип')}</th>
                  <th>{t('Details', 'Детали')}</th>
                  {showOwner && <th>{t('Owner', 'Владелец')}</th>}
                  <th>{t('Updated', 'Обновлён')}</th>
                  <th> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <VoucherRowItem key={v.id} v={v} showOwner={showOwner}
                    onOpen={() => router.push(`/admin/vouchers/${v.id}`)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
