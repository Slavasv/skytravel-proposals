'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { deleteBlock } from './actions'

type Block = {
  id: string
  type: string
  title_ru: string | null
  title_en: string | null
  description_ru: string | null
  description_en: string | null
  image_url: string | null
  location: string | null
  tags: string[] | null
}

export default function BlockRow({ block, usageCount }: { block: Block; usageCount: number }) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasEn = Boolean(block.title_en && block.description_en)
  const isUsed = usageCount > 0

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    setError(null)

    if (isUsed) {
      setError(`Cannot delete: used in ${usageCount} ${usageCount === 1 ? 'place' : 'places'}`)
      return
    }

    if (!confirm(`Delete block "${block.title_ru || 'Untitled'}"?\n\nThis cannot be undone.`)) {
      return
    }

    startTransition(async () => {
      try {
        await deleteBlock(block.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed')
      }
    })
  }

  function toggleMenu(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(!menuOpen)
  }

  return (
    <div style={{ position: 'relative', opacity: isPending ? 0.4 : 1, transition: 'opacity 0.15s' }}>
      <Link
        href={`/admin/library/${block.id}`}
        style={{
          display: 'grid',
          gridTemplateColumns: '72px 1fr auto auto',
          gap: '16px',
          alignItems: 'center',
          padding: '12px 16px',
          paddingRight: '50px',
          border: '1px solid #2A2A28',
          borderRadius: '8px',
          textDecoration: 'none',
          color: 'inherit',
          background: 'transparent',
        }}
      >
        {/* Image */}
        <div style={{
          width: '72px',
          height: '52px',
          borderRadius: '4px',
          background: block.image_url
            ? `url(${block.image_url}) center/cover no-repeat`
            : '#222',
          flexShrink: 0,
        }} />

        {/* Title & location */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {block.title_ru || <span style={{ color: '#888780', fontStyle: 'italic' }}>Untitled</span>}
          </div>
          <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {block.location || '—'}
            {block.tags && block.tags.length > 0 && (
              <>
                {' · '}
                {block.tags.slice(0, 3).map((t, i) => (
                  <span key={t} style={{ marginRight: '6px' }}>
                    #{t}{i < Math.min(block.tags!.length, 3) - 1 ? '' : ''}
                  </span>
                ))}
                {block.tags.length > 3 && <span>+{block.tags.length - 3}</span>}
              </>
            )}
          </div>
        </div>

        {/* Type badge */}
        <div style={{
          fontSize: '10px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#888780',
          padding: '4px 8px',
          border: '1px solid #333',
          borderRadius: '4px',
          fontWeight: 500,
        }}>
          {block.type}
        </div>

        {/* Translation indicator + usage */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#888780' }}>
          {!hasEn && (
            <span title="No English version" style={{ color: '#C8A862' }}>RU only</span>
          )}
          {isUsed && (
            <span title={`Used in ${usageCount} ${usageCount === 1 ? 'day' : 'days'} across proposals`}>
              Used {usageCount}×
            </span>
          )}
        </div>
      </Link>

      {/* Actions menu trigger */}
      <button
        onClick={toggleMenu}
        disabled={isPending}
        aria-label="Actions"
        style={{
          position: 'absolute',
          top: '50%',
          right: '12px',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          padding: '6px 10px',
          cursor: 'pointer',
          color: '#888780',
          fontSize: '16px',
          lineHeight: 1,
          borderRadius: '6px',
          fontFamily: 'inherit',
        }}
      >
        ⋯
      </button>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            right: '12px',
            marginTop: '8px',
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '4px',
            minWidth: '160px',
            zIndex: 2,
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          }}>
            <button
              onClick={handleDelete}
              disabled={isUsed}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: isUsed ? '#555' : '#E07B7B',
                fontSize: '13px',
                cursor: isUsed ? 'not-allowed' : 'pointer',
                borderRadius: '4px',
                fontFamily: 'inherit',
              }}
              title={isUsed ? `Used in ${usageCount} places — remove from proposals first` : undefined}
            >
              {isUsed ? `Delete (used ${usageCount}×)` : 'Delete'}
            </button>
          </div>
        </>
      )}

      {error && (
        <div style={{
          position: 'absolute',
          bottom: '-22px',
          right: '12px',
          fontSize: '11px',
          color: '#E07B7B',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}