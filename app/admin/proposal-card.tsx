'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { deleteProposal, duplicateProposal } from './actions'

type Proposal = {
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
  owner_email?: string | null
  last_viewed_at?: string | null
}

export default function ProposalCard({ proposal, showOwner }: { proposal: Proposal; showOwner?: boolean }) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)

  const title = proposal.trip_title_ru || proposal.trip_title_en || 'Untitled'
  const client = proposal.client_name_ru || proposal.client_name_en || '—'

  function viewedLabel(dateStr: string | null | undefined): string {
    if (!dateStr) return 'Ещё не открывал'
    const then = new Date(dateStr)
    if (isNaN(then.getTime())) return 'Ещё не открывал'
    const diffMs = Date.now() - then.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays <= 0) return 'Открыто сегодня'
    if (diffDays === 1) return 'Открыто вчера'
    if (diffDays < 7) return `Открыто ${diffDays} дн. назад`
    return 'Открыто ' + then.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace(/\.$/, '')
  }

  const isViewed = !!proposal.last_viewed_at

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    if (!confirm(`Delete proposal "${title}"?\n\nThis cannot be undone.`)) return
    startTransition(async () => { await deleteProposal(proposal.id) })
  }

  function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    startTransition(async () => { await duplicateProposal(proposal.id) })
  }

  function toggleMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(!menuOpen)
  }

  return (
    <li style={{ marginBottom: '12px', position: 'relative', opacity: isPending ? 0.4 : 1, transition: 'opacity 0.15s' }}>
      <Link
        href={`/admin/proposals/${proposal.id}`}
        style={{
          display: 'block',
          padding: '16px',
          paddingRight: '60px',
          border: '1px solid var(--admin-border-card)',
          borderRadius: '8px',
          textDecoration: 'none',
          color: 'inherit',
          background: 'transparent',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--admin-border-hover)'
          e.currentTarget.style.background = 'var(--admin-bg)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--admin-border-card)'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <div style={{ fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: '14px', color: 'var(--admin-text-faint)', marginTop: '4px' }}>
          {client} · {proposal.guest_count ?? 1} гостей · {proposal.start_date || '—'} → {proposal.end_date || '—'}
        </div>
        {showOwner && proposal.owner_email && (
          <div style={{ fontSize: '12px', color: 'var(--admin-text-faint)', marginTop: '4px' }}>
            {proposal.owner_email}
          </div>
        )}
        <div style={{ fontSize: '12px', color: 'var(--admin-text-faint)', marginTop: '8px' }}>
          Slug: {proposal.slug} · Status: {proposal.status}
        </div>
        <div style={{ fontSize: '12px', color: isViewed ? 'var(--admin-success)' : 'var(--admin-text-faint)', marginTop: '4px' }}>
          {isViewed ? '● ' : '○ '}{viewedLabel(proposal.last_viewed_at)}
        </div>
      </Link>

      <button
        onClick={toggleMenu}
        disabled={isPending}
        aria-label="Actions"
        style={{
          position: 'absolute',
          top: '14px',
          right: '14px',
          background: 'transparent',
          border: 'none',
          padding: '6px 10px',
          cursor: 'pointer',
          color: 'var(--admin-text-muted)',
          fontSize: '18px',
          lineHeight: 1,
          borderRadius: '6px',
          fontFamily: 'inherit',
          transition: 'color 0.15s, background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--admin-text)'
          e.currentTarget.style.background = 'var(--admin-input)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--admin-text-muted)'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        ⋯
      </button>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
          <div style={{
            position: 'absolute',
            top: '44px',
            right: '14px',
            background: 'var(--admin-input)',
            border: '1px solid var(--admin-border)',
            borderRadius: '8px',
            padding: '4px',
            minWidth: '140px',
            zIndex: 2,
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