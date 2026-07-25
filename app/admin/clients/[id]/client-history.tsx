'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ClientRequest } from '../actions'

const STATUS_META: Record<string, { label: string; color: string }> = {
  new: { label: 'New Request', color: 'var(--admin-accent)' },
  clients_review: { label: 'Client review', color: 'var(--admin-accent)' },
  preparing: { label: 'Preparing proposal', color: 'var(--admin-accent)' },
  proposal_sent: { label: 'Proposal sent', color: '#C99A3F' },
  revising: { label: 'Revising proposal', color: '#C99A3F' },
  booking: { label: 'Booking in progress', color: '#C99A3F' },
  confirmed: { label: 'Confirmed', color: 'var(--admin-success)' },
  cancelled: { label: 'Cancelled', color: 'var(--admin-text-muted)' },
}

function fmtDate(s: string | null): string {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ClientHistory({ requests }: { requests: ClientRequest[] }) {
  const [filter, setFilter] = useState<'all' | 'booked'>('all')

  const bookedCount = requests.filter((r) => r.has_booking).length
  const shown = filter === 'booked' ? requests.filter((r) => r.has_booking) : requests

  return (
    <div>
      {/* сводка + фильтр */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--admin-text)' }}>
          Requests <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}>· {requests.length} total · {bookedCount} booked</span>
        </h3>
        <div style={{ display: 'flex', gap: '2px', background: 'var(--admin-border-card)', borderRadius: '8px', padding: '3px' }}>
          <button type="button" onClick={() => setFilter('all')}
            style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 500, borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: filter === 'all' ? 'var(--admin-text-on-dark)' : 'transparent', color: filter === 'all' ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)' }}>
            All
          </button>
          <button type="button" onClick={() => setFilter('booked')}
            style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 500, borderRadius: '6px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: filter === 'booked' ? 'var(--admin-text-on-dark)' : 'transparent', color: filter === 'booked' ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)' }}>
            Booked
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', fontSize: '13px' }}>
          {requests.length === 0 ? 'No requests yet.' : 'No booked requests yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {shown.map((r) => {
            const meta = STATUS_META[r.status || 'new'] || STATUS_META.new
            const tripDates = [r.trip_start, r.trip_end].map(fmtDate).filter(Boolean).join(' → ')
            const sub = [r.destination, tripDates].filter(Boolean).join(' · ')
            return (
              <Link key={r.id} href={`/admin/requests/${r.id}`}
                style={{ display: 'block', padding: '14px 16px', border: r.has_booking ? '1px solid var(--admin-success)' : '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-card)', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {r.request_code && <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--admin-text)' }}>{r.request_code}</span>}
                  <span style={{ fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: meta.color, border: `1px solid ${meta.color}`, borderRadius: '4px', padding: '1px 6px' }}>
                    {meta.label}
                  </span>
                  {r.has_booking && (
                    <span style={{ fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--admin-dark-panel)', background: 'var(--admin-success)', borderRadius: '4px', padding: '1px 6px', fontWeight: 500 }}>
                      ✓ Booked
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '4px' }}>
                  {sub || 'No details yet'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--admin-text-faint)', marginTop: '3px' }}>
                  Created {fmtDate(r.created_at)}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}