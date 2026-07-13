'use client'

import Link from 'next/link'
import type { ClientProposal, ClientVoucher } from '../actions'

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--admin-text-muted)',
  sent: 'var(--admin-accent)',
  confirmed: 'var(--admin-success)',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  confirmed: 'Confirmed',
}

function viewedLabel(dateStr: string | null): string {
  if (!dateStr) return 'Not opened yet'
  const then = new Date(dateStr)
  if (isNaN(then.getTime())) return 'Not opened yet'
  const diffDays = Math.floor((Date.now() - then.getTime()) / 86400000)
  if (diffDays <= 0) return 'Opened today'
  if (diffDays === 1) return 'Opened yesterday'
  if (diffDays < 7) return `Opened ${diffDays} days ago`
  return 'Opened ' + then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function guestNames(guests: unknown): string {
  if (!Array.isArray(guests)) return ''
  const names = guests
    .filter((g): g is { name?: string } => !!g && typeof g === 'object')
    .map((g) => (g.name || '').trim())
    .filter(Boolean)
  if (names.length === 0) return ''
  return names[0] + (names.length > 1 ? ` +${names.length - 1}` : '')
}

const cardStyle: React.CSSProperties = {
  display: 'block',
  padding: '14px 16px',
  border: '1px solid var(--admin-border-card)',
  borderRadius: '8px',
  background: 'var(--admin-card)',
  textDecoration: 'none',
  color: 'inherit',
  marginBottom: '8px',
}

export default function ClientHistory({
  proposals, vouchers,
}: {
  proposals: ClientProposal[]
  vouchers: ClientVoucher[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* PROPOSALS */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: 'var(--admin-text)' }}>
            Proposals <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}>· {proposals.length}</span>
          </h3>
        </div>

        {proposals.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', fontSize: '13px' }}>
            No proposals linked yet. Link one from the proposal editor.
          </div>
        ) : (
          proposals.map((p) => {
            const title = p.trip_title_ru || p.trip_title_en || 'Untitled proposal'
            const dates = [p.start_date, p.end_date].filter(Boolean).join(' → ')
            const price = p.total_price != null ? `${p.total_price} ${p.cost_currency || ''}`.trim() : ''
            const isViewed = !!p.last_viewed_at
            return (
              <Link key={p.id} href={`/admin/proposals/${p.id}`} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--admin-text)' }}>{title}</span>
                  {p.status && (
                    <span style={{ fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: STATUS_COLORS[p.status] || 'var(--admin-text-muted)', border: `1px solid ${STATUS_COLORS[p.status] || 'var(--admin-border-card)'}`, borderRadius: '4px', padding: '1px 5px' }}>
                      {STATUS_LABELS[p.status] || p.status}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '4px' }}>
                  {[dates, price].filter(Boolean).join(' · ') || 'No dates yet'}
                </div>
                <div style={{ fontSize: '12px', color: isViewed ? 'var(--admin-success)' : 'var(--admin-text-faint)', marginTop: '3px' }}>
                  {isViewed ? '● ' : '○ '}{viewedLabel(p.last_viewed_at)}
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* VOUCHERS */}
      <div>
        <h3 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 12px', color: 'var(--admin-text)' }}>
          Vouchers <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}>· {vouchers.length}</span>
        </h3>

        {vouchers.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', fontSize: '13px' }}>
            No vouchers linked yet. Link one from the voucher editor.
          </div>
        ) : (
          vouchers.map((v) => {
            const hotels = [...(v.voucher_hotels ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            const first = hotels[0]
            const hotelLine = first
              ? [first.name, first.city].filter(Boolean).join(' · ')
              : ''
            const names = guestNames(v.guests)
            return (
              <Link key={v.id} href={`/admin/vouchers/${v.id}`} style={cardStyle}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--admin-text)' }}>
                  {names || 'No guests yet'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '4px' }}>
                  {[hotelLine, first?.check_in].filter(Boolean).join(' · ') || 'No hotel yet'}
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}