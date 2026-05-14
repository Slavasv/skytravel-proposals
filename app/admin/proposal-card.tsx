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
  guest_count: number | null
  start_date: string | null
  end_date: string | null
  status: string | null
}

export default function ProposalCard({ proposal }: { proposal: Proposal }) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)

    if (!confirm(`Delete proposal "${proposal.trip_title_ru || proposal.slug}"?\n\nThis cannot be undone.`)) {
      return
    }

    startTransition(async () => {
      await deleteProposal(proposal.id)
    })
  }

  function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)

    startTransition(async () => {
      await duplicateProposal(proposal.id)
    })
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
          border: '1px solid #ddd',
          borderRadius: '8px',
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <div style={{ fontWeight: 500 }}>{proposal.trip_title_ru || 'Untitled'}</div>
        <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
          {proposal.client_name_ru || '—'} · {proposal.guest_count ?? 1} гостей · {proposal.start_date || '—'} → {proposal.end_date || '—'}
        </div>
        <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
          Slug: {proposal.slug} · Status: {proposal.status}
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
          color: '#888780',
          fontSize: '18px',
          lineHeight: 1,
          borderRadius: '6px',
          fontFamily: 'inherit',
        }}
      >
        ⋯
      </button>

      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '44px',
              right: '14px',
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '4px',
              minWidth: '140px',
              zIndex: 2,
              boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
            }}
          >
            <button
              onClick={handleDuplicate}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                fontSize: '13px',
                cursor: 'pointer',
                borderRadius: '4px',
                fontFamily: 'inherit',
              }}
            >
              Duplicate
            </button>
            <button
              onClick={handleDelete}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: '#E07B7B',
                fontSize: '13px',
                cursor: 'pointer',
                borderRadius: '4px',
                fontFamily: 'inherit',
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  )
}