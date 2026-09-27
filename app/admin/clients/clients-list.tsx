'use client'

import { useState, useMemo, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(s: string | null): string {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function ClientRowItem({ c, showOwner, onOpen }: { c: ClientRow; showOwner: boolean; onOpen: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const ownerEmail = Array.isArray(c.profiles) ? c.profiles[0]?.email : c.profiles?.email
  const name = c.name || 'Untitled client'
  const typeLabel = TYPE_LABELS[c.client_type || ''] || c.client_type || ''
  const isRegular = c.client_status === 'regular'
  const countries = (c.countries && c.countries.length > 0) ? c.countries.join(', ') : ''
  const contact = c.phone || c.email || ''

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 160) })
    setMenuOpen(true)
  }
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation(); setMenuOpen(false)
    startTransition(async () => { await duplicateClient(c.id) })
  }
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation(); setMenuOpen(false)
    if (!confirm(`Delete client "${name}"?\n\nThis cannot be undone.`)) return
    startTransition(async () => { await deleteClient(c.id) })
  }

  return (
    <tr className="adm-row" onClick={onOpen} style={{ opacity: isPending ? 0.4 : 1 }}>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="adm-cell-strong">{name}</span>
          {isRegular && (
            <span style={{ fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--admin-success)', border: '1px solid var(--admin-success)', borderRadius: '4px', padding: '1px 5px' }}>
              Regular
            </span>
          )}
        </div>
        {c.client_code && <div className="adm-cell-code">{c.client_code}</div>}
      </td>
      <td style={{ color: typeLabel ? undefined : '#9C988E' }}>{typeLabel || '—'}</td>
      <td style={{ color: countries ? undefined : '#9C988E' }}>{countries || '—'}</td>
      <td style={{ color: contact ? undefined : '#9C988E' }}>{contact || '—'}</td>
      {showOwner && <td className="adm-cell-muted">{ownerEmail || '—'}</td>}
      <td className="adm-cell-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(c.updated_at)}</td>
      <td className="adm-right" onClick={stop}>
        <button ref={btnRef} className="adm-dots" disabled={isPending} aria-label="Actions"
          onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}>⋯</button>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div className="adm-menu" style={{ top: menuPos.top, left: menuPos.left }}>
              <button className="adm-menu-item" onClick={handleDuplicate}>Duplicate</button>
              <button className="adm-menu-item danger" onClick={handleDelete}>Delete</button>
            </div>
          </>
        )}
      </td>
    </tr>
  )
}

export default function ClientsList({ clients, showOwner }: { clients: ClientRow[]; showOwner: boolean }) {
  const router = useRouter()
  const safeClients = Array.isArray(clients) ? clients : []
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return safeClients
    return safeClients.filter((c) => {
      const haystack = [
        c.name, c.client_code, c.phone, c.email, (c.countries || []).join(' '),
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [safeClients, search])

  return (
    <div>
      <div className="adm-toolbar">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code, phone, email…" className="adm-field adm-field-search" />
      </div>

      {filtered.length === 0 ? (
        <div className="adm-empty">
          {safeClients.length === 0 ? 'No clients yet. Click + New client to create one.' : 'Nothing matches your search.'}
        </div>
      ) : (
        <div className="adm-tcard">
          <div className="adm-tscroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Countries</th>
                  <th>Contact</th>
                  {showOwner && <th>Owner</th>}
                  <th>Updated</th>
                  <th> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <ClientRowItem key={c.id} c={c} showOwner={showOwner}
                    onOpen={() => router.push(`/admin/clients/${c.id}`)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
