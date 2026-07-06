'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { deleteVoucher } from '../actions'

type Guest = { name?: string; title?: string }
type Hotel = { name?: string | null; city?: string | null; country?: string | null; check_in?: string | null; check_out?: string | null; sort_order?: number }

export type VoucherRow = {
  id: string
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
  return names[0] || 'Untitled voucher'
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

export default function VouchersList({ vouchers, showOwner }: { vouchers: VoucherRow[]; showOwner: boolean }) {
  const safeVouchers = Array.isArray(vouchers) ? vouchers : []
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return safeVouchers
    return safeVouchers.filter((v) => {
      const names = guestNames(v.guests).join(' ').toLowerCase()
      return names.includes(q)
    })
  }, [safeVouchers, search])

  function handleDelete(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this voucher? This cannot be undone.')) return
    setDeletingId(id)
    startTransition(async () => {
      try {
        await deleteVoucher(id)
      } finally {
        setDeletingId(null)
      }
    })
  }

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
        placeholder="Search by guest name…"
        style={inputStyle}
      />

      {filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
          {safeVouchers.length === 0 ? 'No vouchers yet. Click + New voucher to create one.' : 'Nothing matches your search.'}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((v) => {
            const ownerEmail = Array.isArray(v.profiles) ? v.profiles[0]?.email : v.profiles?.email
            const mainName = firstGuestName(v.guests)
            const hotelLine = firstHotelLine(v.voucher_hotels)
            const guestCount = guestNames(v.guests).length
            return (
              <li key={v.id} style={{ opacity: deletingId === v.id ? 0.4 : 1 }}>
                <Link href={`/admin/vouchers/${v.id}`} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                  padding: '16px 18px', border: '1px solid var(--admin-border-card)', borderRadius: '8px',
                  background: 'var(--admin-card)', textDecoration: 'none', color: 'inherit',
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--admin-text)' }}>
                      {mainName}
                      {guestCount > 1 && <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', fontWeight: 400 }}> +{guestCount - 1}</span>}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--admin-text)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {hotelLine || <span style={{ color: 'var(--admin-text-muted)' }}>No hotel yet</span>}
                    </div>
                    {showOwner && ownerEmail && (
                      <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                        {ownerEmail}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, v.id)}
                    disabled={isPending}
                    aria-label="Delete voucher"
                    style={{ flexShrink: 0, padding: '8px 12px', fontSize: '12px', color: 'var(--admin-danger)', background: 'transparent', border: '1px solid var(--admin-border-card)', borderRadius: '6px', cursor: isPending ? 'wait' : 'pointer', fontFamily: 'inherit' }}
                  >
                    ✕ Delete
                  </button>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}