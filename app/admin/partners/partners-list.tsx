'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { deletePartner, duplicatePartner } from './actions'

export type PartnerRow = {
  id: string
  name: string | null
  service_type: string | null
  destination: string | null
  operator_group: string | null
  updated_at: string
}

function PartnerItem({ p }: { p: PartnerRow }) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)

  const name = p.name || 'Untitled partner'
  const subline = [p.service_type, p.destination, p.operator_group].filter(Boolean).join(' · ')

  function toggleMenu(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    setMenuOpen(!menuOpen)
  }
  function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); setMenuOpen(false)
    startTransition(async () => { await duplicatePartner(p.id) })
  }
  function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); setMenuOpen(false)
    if (!confirm(`Delete partner "${name}"?\n\nThis cannot be undone.`)) return
    startTransition(async () => { await deletePartner(p.id) })
  }

  return (
    <li style={{ position: 'relative', opacity: isPending ? 0.4 : 1, transition: 'opacity 0.15s' }}>
      <Link href={`/admin/partners/${p.id}`} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
        padding: '16px 18px', paddingRight: '56px', border: '1px solid var(--admin-border-card)',
        borderRadius: '8px', background: 'var(--admin-card)', textDecoration: 'none', color: 'inherit',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--admin-text)' }}>{name}</div>
          <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subline || 'No details yet'}
          </div>
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
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
              Duplicate
            </button>
            <button onClick={handleDelete}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--admin-danger)', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(224, 123, 123, 0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  )
}

export default function PartnersList({ partners }: { partners: PartnerRow[] }) {
  const safe = Array.isArray(partners) ? partners : []
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const types = useMemo(() => {
    const set = new Set<string>()
    safe.forEach((p) => { if (p.service_type) set.add(p.service_type) })
    return Array.from(set).sort()
  }, [safe])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return safe.filter((p) => {
      if (typeFilter && p.service_type !== typeFilter) return false
      if (!q) return true
      const hay = [p.name, p.destination, p.operator_group].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [safe, search, typeFilter])

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', fontSize: '14px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '8px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search partners…" style={{ ...inputStyle, flex: 1, minWidth: '200px' }} />
        {types.length > 0 && (
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ ...inputStyle, width: '200px' }}>
            <option value="">All types</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
          {safe.length === 0 ? 'No partners yet. Click + New partner to create one.' : 'Nothing matches your filters.'}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((p) => <PartnerItem key={p.id} p={p} />)}
        </ul>
      )}
    </div>
  )
}