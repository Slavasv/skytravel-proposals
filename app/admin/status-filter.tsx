'use client'

import Link from 'next/link'

const FILTERS = [
  { value: null, label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'confirmed', label: 'Confirmed' },
]

export default function StatusFilter({
  current,
  counts,
}: {
  current: string | null
  counts: Record<string, number>
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
      {FILTERS.map((f) => {
        const isActive = current === f.value
        const count = f.value === null ? total : counts[f.value] ?? 0

        return (
          <Link
            key={f.label}
            href={f.value ? `/admin?status=${f.value}` : '/admin'}
            scroll={false}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              borderRadius: '999px',
              textDecoration: 'none',
              background: isActive ? 'var(--admin-text-on-dark)' : 'transparent',
              color: isActive ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)',
              border: `1px solid ${isActive ? 'var(--admin-text-on-dark)' : 'var(--admin-border)'}`,
              fontWeight: isActive ? 500 : 400,
            }}
          >
            {f.label} <span style={{ opacity: 0.6, marginLeft: '4px' }}>{count}</span>
          </Link>
        )
      })}
    </div>
  )
}