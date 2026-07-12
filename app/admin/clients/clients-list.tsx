'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { deleteClient, duplicateClient } from './actions'

export type ClientRow = {
  id: string
  name: string | null
  client_code: string | null
  client_type: string | null
  client_status: string | null
  lead_source: string | null
  countries: string[] | null
  phone: string | null
  email: string | null
  updated_at: string
  owner_id: string | null
  profiles?: { email: string } | { email: string }[] | null
}

const TYPE_LABELS: Record<string, string> = {
  individual: 'Individual',
  family: 'Family',
  company: 'Company',
}

function ClientItem({ c, showOwner }: { c: ClientRow; showOwner: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)

  const ownerEmail = Array.isArray(c.profiles) ? c.profiles[0]?.email : c.profiles?.email
  const name = c.name || 'Untitled client'
  const typeLabel = TYPE_LABELS[c.client_type || ''] || c.client_type || ''
  const isRegular = c.client_status === 'regular'

  const subline = [
    typeLabel,
    (c.countries && c.countries.length > 0) ? c.countries.join(', ') : '',
    c.phone || c.email || '',
  ].filter(Boolean).join(' · ')

  function toggleMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(!menuOpen)
  }

  function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    startTransition(async () => { await duplicateClient(c.id) })
  }

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    if (!confirm(`Delete client "${name}"?\n\nThis cannot be undone.`)) return
    startTransition(async () => { await deleteClient(c.id) })
  }

  return (
    <li style={{ position: 'relative', opacity: isPending ? 0.4 : 1, transition: 'opacity 0.15s' }}>
      <Link href={`/admin/clients/${c.id}`} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
        padding: '16px 18px', paddingRight: '56px', border: '1px solid var(--admin-border-card)',
        borderRadius: '8px', background: 'var(--admin-card)', textDecoration: 'none', color: 'inherit',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--admin-text)' }}>{name}</span>
            {c.client_code && (
              <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', fontWeight: 400 }}>{c.client_code}</span>
            )}
            {isRegular && (
              <span style={{ fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--admin-success)', border: '1px solid var(--admin-success)', borderRadius: '4px', padding: '1px 5px' }}>
                Regular
              </span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subline || 'No details yet'}
          </div>
          {showOwner && ownerEmail && (
            <div style={{ fontSize: '12px', color: 'var(--admin-text-faint)', marginTop: '2px' }}>
              {ownerEmail}
            </div>
          )}
        </div>
      </Link>

      <button
        onClick={toggleMenu}
        disabled={isPending}
        aria-label="Actions"
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
              onClick={handleDuplicate}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'inherit', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Duplicate
            </button>
            <button
              onClick={handleDelete}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--admin-danger)', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(224, 123, 123, 0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  )
}

export default function ClientsList({ clients, showOwner }: { clients: ClientRow[]; showOwner: boolean }) {
  const safeClients = Array.isArray(clients) ? clients : []
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return safeClients
    return safeClients.filter((c) => {
      const haystack = [
        c.name,
        c.client_code,
        c.phone,
        c.email,
        (c.countries || []).join(' '),
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [safeClients, search])

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
        placeholder="Search by name, code, phone, email…"
        style={inputStyle}
      />

      {filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
          {safeClients.length === 0 ? 'No clients yet. Click + New client to create one.' : 'Nothing matches your search.'}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((c) => (
            <ClientItem key={c.id} c={c} showOwner={showOwner} />
          ))}
        </ul>
      )}
    </div>
  )
}