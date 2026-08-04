'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { deleteVoucher, duplicateVoucher } from '../actions'
import { useT } from '@/lib/i18n-client'

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
  guests: unknown
  voucher_hotels?: Hotel[] | null
  profiles?: { email: string } | { email: string }[] | null
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

function VoucherItem({ v, showOwner }: { v: VoucherRow; showOwner: boolean }) {
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

  const ownerEmail = Array.isArray(v.profiles) ? v.profiles[0]?.email : v.profiles?.email
  const mainName = firstGuestName(v.guests) || t('Untitled voucher', 'Ваучер без названия')
  const hotelLine = firstHotelLine(v.voucher_hotels)
  const guestCount = guestNames(v.guests).length

  function toggleMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(!menuOpen)
  }

  async function handlePdf(e: React.MouseEvent) {
    e.preventDefault()
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
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    startTransition(async () => { await duplicateVoucher(v.id) })
  }

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    if (!confirm(t(`Delete voucher for "${mainName}"?\n\nThis cannot be undone.`, `Удалить ваучер для «${mainName}»?\n\nЭто действие необратимо.`))) return
    startTransition(async () => { await deleteVoucher(v.id) })
  }

  return (
    <li style={{ position: 'relative', opacity: isPending ? 0.4 : 1, transition: 'opacity 0.15s' }}>
      <Link href={`/admin/vouchers/${v.id}`} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
        padding: '16px 18px', paddingRight: '56px', border: '1px solid var(--admin-border-card)', borderRadius: '8px',
        background: 'var(--admin-card)', textDecoration: 'none', color: 'inherit',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--admin-text)' }}>
            {mainName}
            {guestCount > 1 && <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', fontWeight: 400 }}> +{guestCount - 1}</span>}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--admin-text)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {hotelLine || <span style={{ color: 'var(--admin-text-muted)' }}>{t('No hotel yet', 'Отель ещё не указан')}</span>}
          </div>
          {showOwner && ownerEmail && (
            <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
              {ownerEmail}
            </div>
          )}
        </div>
      </Link>

      <button
        onClick={toggleMenu}
        disabled={isPending}
        aria-label={t('Actions', 'Действия')}
        style={{
          position: 'absolute', top: '50%', right: '14px', transform: 'translateY(-50%)',
          background: 'transparent', border: 'none', padding: '6px 10px', cursor: 'pointer',
          color: 'var(--admin-text-muted)', fontSize: '18px', lineHeight: 1, borderRadius: '6px', fontFamily: 'inherit',
        }}
      >
        ⋯
      </button>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
          <div style={{
            position: 'absolute', top: '50%', right: '14px',
            background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
            borderRadius: '8px', padding: '4px', minWidth: '140px', zIndex: 2,
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          }}>
            <button
              onClick={handlePdf}
              disabled={pdfBusy}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'inherit', fontSize: '13px', cursor: pdfBusy ? 'wait' : 'pointer', borderRadius: '4px', fontFamily: 'inherit', opacity: pdfBusy ? 0.6 : 1 }}
              onMouseEnter={(e) => { if (!pdfBusy) e.currentTarget.style.background = 'var(--admin-card)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {pdfBusy ? t('Generating…', 'Формирование…') : t('Download PDF', 'Скачать PDF')}
            </button>
            <button
              onClick={handleDuplicate}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'inherit', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {t('Duplicate', 'Дублировать')}
            </button>
            <button
              onClick={handleDelete}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--admin-danger)', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(224, 123, 123, 0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {t('Delete', 'Удалить')}
            </button>
          </div>
        </>
      )}
    </li>
  )
}

export default function VouchersList({ vouchers, showOwner }: { vouchers: VoucherRow[]; showOwner: boolean }) {
  const t = useT()
  const safeVouchers = Array.isArray(vouchers) ? vouchers : []
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return safeVouchers
    return safeVouchers.filter((v) => {
      const names = guestNames(v.guests).join(' ').toLowerCase()
      return names.includes(q)
    })
  }, [safeVouchers, search])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', fontSize: '14px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '8px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
    marginBottom: '16px',
  }

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('Search by guest name…', 'Поиск по имени гостя…')}
        style={inputStyle}
      />

      {filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
          {safeVouchers.length === 0 ? t('No vouchers yet. Click + New voucher to create one.', 'Ваучеров пока нет. Нажмите «+ Новый ваучер», чтобы создать.') : t('Nothing matches your search.', 'Ничего не найдено по вашему запросу.')}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((v) => (
            <VoucherItem key={v.id} v={v} showOwner={showOwner} />
          ))}
        </ul>
      )}
    </div>
  )
}