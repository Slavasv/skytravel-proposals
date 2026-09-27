'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { deleteProposal, duplicateProposal } from './actions'

export type ProposalRow = {
  id: string
  slug: string
  client_name_ru: string | null
  client_name_en: string | null
  trip_title_ru: string | null
  trip_title_en: string | null
  guest_count: number | null
  start_date: string | null
  end_date: string | null
  status: string | null
  kind?: string | null
  owner_email?: string | null
  updated_at?: string | null
}

const STATUS_META: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'mid' },
  sent: { label: 'Sent', tone: 'work' },
  confirmed: { label: 'Confirmed', tone: 'done' },
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function ProposalRowItem({ p, showOwner, onOpen }: { p: ProposalRow; showOwner: boolean; onOpen: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const title = p.trip_title_ru || p.trip_title_en || 'Untitled'
  const client = p.client_name_ru || p.client_name_en || ''
  const status = p.status || 'draft'
  const meta = STATUS_META[status] || { label: status, tone: 'info' }
  const startFmt = fmtDate(p.start_date)
  const endFmt = fmtDate(p.end_date)
  const dates = startFmt || endFmt ? `${startFmt || '—'} → ${endFmt || '—'}` : ''

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 160) })
    setMenuOpen(true)
  }
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation(); setMenuOpen(false)
    startTransition(async () => { await duplicateProposal(p.id) })
  }
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation(); setMenuOpen(false)
    if (!confirm(`Delete proposal "${title}"?\n\nThis cannot be undone.`)) return
    startTransition(async () => { await deleteProposal(p.id) })
  }

  return (
    <tr className="adm-row" onClick={onOpen} style={{ opacity: isPending ? 0.4 : 1 }}>
      <td>
        <span className="adm-cell-strong">{title}</span>
        {p.slug && <div className="adm-cell-code">{p.slug}</div>}
      </td>
      <td style={{ color: client ? undefined : '#9C988E' }}>{client || '—'}</td>
      <td>
        <span className={`adm-pill adm-tone-${meta.tone}`}>{meta.label}</span>
      </td>
      <td className="adm-cell-muted" style={{ whiteSpace: 'nowrap', color: dates ? undefined : '#9C988E' }}>{dates || '—'}</td>
      <td style={{ color: p.guest_count ? undefined : '#9C988E' }}>{p.guest_count ?? '—'}</td>
      {showOwner && <td className="adm-cell-muted">{p.owner_email || '—'}</td>}
      <td className="adm-cell-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.updated_at)}</td>
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

export default function ProposalsTable({ proposals, showOwner }: { proposals: ProposalRow[]; showOwner: boolean }) {
  const router = useRouter()
  const safe = Array.isArray(proposals) ? proposals : []

  const detailUrl = (p: ProposalRow) =>
    p.kind === 'destination' ? `/admin/destinations/${p.id}` : `/admin/proposals/${p.id}`

  return (
    <div className="adm-tcard">
      <div className="adm-tscroll">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Proposal</th>
              <th>Client</th>
              <th>Status</th>
              <th>Trip dates</th>
              <th>Guests</th>
              {showOwner && <th>Owner</th>}
              <th>Updated</th>
              <th> </th>
            </tr>
          </thead>
          <tbody>
            {safe.map((p) => (
              <ProposalRowItem key={p.id} p={p} showOwner={showOwner}
                onOpen={() => router.push(detailUrl(p))} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
