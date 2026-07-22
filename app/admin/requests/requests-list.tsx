'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { deleteRequest, duplicateRequest } from './actions'

export type RequestRow = {
  id: string
  request_code: string | null
  destination: string | null
  details: string | null
  status: string | null
  priority: string | null
  created_at: string
  closed_at: string | null
  owner_id: string | null
  clients?: { name: string; client_code: string | null } | { name: string; client_code: string | null }[] | null
  profiles?: { email: string } | { email: string }[] | null
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  new:            { label: 'New Request',         color: 'var(--admin-accent)' },
  clients_review: { label: 'Client review',       color: 'var(--admin-accent)' },
  preparing:      { label: 'Preparing proposal',  color: 'var(--admin-accent)' },
  proposal_sent:  { label: 'Proposal sent',       color: '#C99A3F' },
  revising:       { label: 'Revising proposal',   color: '#C99A3F' },
  booking:        { label: 'Booking in progress', color: '#C99A3F' },
  confirmed:      { label: 'Confirmed',           color: 'var(--admin-success)' },
  cancelled:      { label: 'Cancelled',           color: 'var(--admin-text-muted)' },
}

function daysBetween(from: string, to: string): string {
  const a = new Date(from), b = new Date(to)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return ''
  const diff = Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
  if (diff === 0) return 'same day'
  if (diff === 1) return '1 day'
  return `${diff} days`
}

function RequestItem({ r, showOwner, destination }: { r: RequestRow; showOwner: boolean; destination?: string }) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)

  const client = Array.isArray(r.clients) ? r.clients[0] : r.clients
  const ownerEmail = Array.isArray(r.profiles) ? r.profiles[0]?.email : r.profiles?.email
  const meta = STATUS_META[r.status || 'new'] || STATUS_META.new
  const clientName = client?.name || 'No client'

  const subParts = [destination].filter(Boolean)
  if (r.closed_at) subParts.push(`closed in ${daysBetween(r.created_at, r.closed_at)}`)
  const subline = subParts.join(' · ')

  function toggleMenu(e: React.MouseEvent) { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen) }
  function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); setMenuOpen(false)
    startTransition(async () => { await duplicateRequest(r.id) })
  }
  function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); setMenuOpen(false)
    if (!confirm('Delete this request?\n\nThis cannot be undone.')) return
    startTransition(async () => { await deleteRequest(r.id) })
  }

  return (
    <li style={{ position: 'relative', opacity: isPending ? 0.4 : 1, transition: 'opacity 0.15s' }}>
      <Link href={`/admin/requests/${r.id}`} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
        padding: '16px 18px', paddingRight: '56px', border: '1px solid var(--admin-border-card)',
        borderRadius: '8px', background: 'var(--admin-card)', textDecoration: 'none', color: 'inherit',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--admin-text)' }}>{clientName}</span>
            {r.request_code && <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>{r.request_code}</span>}
            <span style={{ fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: meta.color, border: `1px solid ${meta.color}`, borderRadius: '4px', padding: '1px 6px' }}>
              {meta.label}
            </span>
            {r.priority && (
              <span style={{ fontSize: '10px', color: 'var(--admin-text-muted)' }}>{r.priority}</span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subline || 'No details yet'}
          </div>
          {showOwner && ownerEmail && (
            <div style={{ fontSize: '12px', color: 'var(--admin-text-faint)', marginTop: '2px' }}>{ownerEmail}</div>
          )}
        </div>
      </Link>

      <button onClick={toggleMenu} disabled={isPending} aria-label="Actions"
        style={{ position: 'absolute', top: '50%', right: '14px', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: '6px 10px', cursor: 'pointer', color: 'var(--admin-text-muted)', fontSize: '18px', lineHeight: 1, borderRadius: '6px', fontFamily: 'inherit' }}>
        ⋯
      </button>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
          <div style={{ position: 'absolute', top: '50%', right: '14px', background: 'var(--admin-input)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '4px', minWidth: '140px', zIndex: 2, boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>
            <button onClick={handleDuplicate}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'inherit', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>Duplicate</button>
            <button onClick={handleDelete}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--admin-danger)', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(224, 123, 123, 0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>Delete</button>
          </div>
        </>
      )}
    </li>
  )
}

export default function RequestsList({
  requests, showOwner, destSummary = {},
}: {
  requests: RequestRow[]
  showOwner: boolean
  destSummary?: Record<string, string>
}) {
  const safe = Array.isArray(requests) ? requests : []
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return safe.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false
      if (!q) return true
      const client = Array.isArray(r.clients) ? r.clients[0] : r.clients
      const hay = [client?.name, r.request_code, r.destination, r.details].filter(Boolean).join(' ').toLowerCase()
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
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by client, destination, details…" style={{ ...inputStyle, flex: 1, minWidth: '200px' }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: '220px' }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_META).map(([value, m]) => (
            <option key={value} value={value}>{m.label}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
          {safe.length === 0 ? 'No requests yet. Click + New request to create one.' : 'Nothing matches your filters.'}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((r) => <RequestItem key={r.id} r={r} showOwner={showOwner} destination={destSummary[r.id]} />)}
        </ul>
      )}
    </div>
  )
}