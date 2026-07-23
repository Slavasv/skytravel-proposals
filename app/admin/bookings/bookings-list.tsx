'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { deleteBooking } from './actions'

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
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'var(--admin-text-muted)' },
  confirmed: { label: 'Confirmed', color: 'var(--admin-success)' },
  cancelled: { label: 'Cancelled', color: 'var(--admin-danger)' },
}

function money(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function BookingItem({ b }: { b: BookingRow }) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)

  const client = Array.isArray(b.clients) ? b.clients[0] : b.clients
  const meta = STATUS_META[b.status || 'draft'] || STATUS_META.draft

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

  const dates = [b.start_date, b.end_date].filter(Boolean).join(' → ')
  const subline = [b.destination, dates].filter(Boolean).join(' · ')

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); setMenuOpen(false)
    if (!confirm('Delete this booking?\n\nAll services inside will be deleted too.')) return
    startTransition(async () => { await deleteBooking(b.id) })
  }

  return (
    <li style={{ position: 'relative', opacity: isPending ? 0.4 : 1, transition: 'opacity 0.15s' }}>
      <Link href={`/admin/bookings/${b.id}`} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
        padding: '16px 18px', paddingRight: '56px', border: '1px solid var(--admin-border-card)',
        borderRadius: '8px', background: 'var(--admin-card)', textDecoration: 'none', color: 'inherit',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--admin-text)' }}>
              {client?.name || 'No client'}
            </span>
            {b.booking_code && <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>{b.booking_code}</span>}
            <span style={{ fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: meta.color, border: `1px solid ${meta.color}`, borderRadius: '4px', padding: '1px 6px' }}>
              {meta.label}
            </span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subline || 'No details yet'}
          </div>
        </div>
        {commissionLine && (
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-success)', flexShrink: 0 }}>
            {commissionLine}
          </span>
        )}
      </Link>

      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen) }} disabled={isPending} aria-label="Actions"
        style={{ position: 'absolute', top: '50%', right: '14px', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: '6px 10px', cursor: 'pointer', color: 'var(--admin-text-muted)', fontSize: '18px', lineHeight: 1, borderRadius: '6px', fontFamily: 'inherit' }}>
        ⋯
      </button>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
          <div style={{ position: 'absolute', top: '50%', right: '14px', background: 'var(--admin-input)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '4px', minWidth: '140px', zIndex: 2, boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>
            <button onClick={handleDelete}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--admin-danger)', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit' }}>
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  )
}

export default function BookingsList({ bookings }: { bookings: BookingRow[] }) {
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

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', fontSize: '14px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '8px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by client, code, destination…" style={{ ...inputStyle, flex: 1, minWidth: '200px' }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: '180px' }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
          {safe.length === 0 ? 'No bookings yet.' : 'Nothing matches your filters.'}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((b) => <BookingItem key={b.id} b={b} />)}
        </ul>
      )}
    </div>
  )
}