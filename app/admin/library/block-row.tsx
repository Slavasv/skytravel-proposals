'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { deleteBlock, archiveBlock, unarchiveBlock } from './actions'
import { useIsMobile } from '@/lib/use-is-mobile'

type CityJoin = { name_ru: string; name_en: string; countries: { name_ru: string; name_en: string } | { name_ru: string; name_en: string }[] | null }
type CountryJoin = { name_ru: string; name_en: string }

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
  archived_at: string | null
  cities: CityJoin | CityJoin[] | null
  countries: CountryJoin | CountryJoin[] | null
}

// Достаём один объект из join (Supabase возвращает либо объект, либо массив)
function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

// Подпись локации для типа hotel/city; для activity/transfer возвращает null
function formatLocation(block: Block): string | null {
  if (block.type === 'hotel') {
    const city = pickOne(block.cities)
    if (!city) return null
    const country = pickOne(city.countries)
    return country ? `${city.name_ru}, ${country.name_ru}` : city.name_ru
  }
  if (block.type === 'city') {
    const country = pickOne(block.countries)
    return country?.name_ru ?? null
  }
  return null
}

export default function BlockRow({ block, usageCount }: { block: Block; usageCount: number }) {
  const [isPending, startTransition] = useTransition()
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasEn = Boolean(block.title_en && block.description_en)
  const isUsed = usageCount > 0
  const isArchived = block.archived_at !== null

  function handleArchive(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    setError(null)

    startTransition(async () => {
      try {
        await archiveBlock(block.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Archive failed')
      }
    })
  }

  function handleUnarchive(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    setError(null)

    startTransition(async () => {
      try {
        await unarchiveBlock(block.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unarchive failed')
      }
    })
  }

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setMenuOpen(false)
    setError(null)

    if (isUsed) {
      setError(`Cannot delete: used in ${usageCount} ${usageCount === 1 ? 'place' : 'places'}`)
      return
    }

    if (!confirm(`Delete block "${block.title_ru || block.title_en || 'Untitled'}"?\n\nThis cannot be undone.`)) {
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
          gridTemplateColumns: isMobile ? '56px 1fr' : '72px 1fr auto auto',
          gap: isMobile ? '12px' : '16px',
          alignItems: 'center',
          padding: '12px 16px',
          paddingRight: '50px',
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
        <div style={{
          width: isMobile ? '56px' : '72px',
          height: isMobile ? '56px' : '52px',
          borderRadius: '4px',
          background: block.image_url
            ? `url(${block.image_url}) center/cover no-repeat`
            : 'var(--admin-card)',
          flexShrink: 0,
          filter: isArchived ? 'grayscale(0.8)' : 'none',
          opacity: isArchived ? 0.6 : 1,
        }} />

        <div style={{ minWidth: 0 }}>
          <div style={{
            fontWeight: 500,
            fontSize: '14px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: isArchived ? 'var(--admin-text-muted)' : 'inherit',
          }}>
            {block.title_ru || block.title_en || <span style={{ color: 'var(--admin-text-muted)', fontStyle: 'italic' }}>Untitled</span>}
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--admin-text-muted)',
            marginTop: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {formatLocation(block) || '—'}
            {block.tags && block.tags.length > 0 && (
              <>
                {' · '}
                {block.tags.slice(0, 3).map((t) => (
                  <span key={t} style={{ marginRight: '6px' }}>
                    #{t}
                  </span>
                ))}
                {block.tags.length > 3 && <span>+{block.tags.length - 3}</span>}
              </>
            )}
          </div>
          {isMobile && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginTop: '6px',
              fontSize: '10px',
            }}>
              <span style={{
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--admin-text-muted)',
                padding: '3px 7px',
                border: '1px solid var(--admin-border)',
                borderRadius: '4px',
                fontWeight: 500,
              }}>
                {block.type}
              </span>
              {isArchived && (
                <span style={{ color: 'var(--admin-text-muted)', fontStyle: 'italic', fontSize: '11px' }}>Archived</span>
              )}
              {!hasEn && !isArchived && (
                <span style={{ color: 'var(--admin-accent)', fontSize: '11px' }}>RU only</span>
              )}
              {isUsed && (
                <span style={{ color: 'var(--admin-text-muted)', fontSize: '11px' }}>Used {usageCount}×</span>
              )}
            </div>
          )}
        </div>

        {!isMobile && (
          <div style={{
            fontSize: '10px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--admin-text-muted)',
            padding: '4px 8px',
            border: '1px solid var(--admin-border)',
            borderRadius: '4px',
            fontWeight: 500,
          }}>
            {block.type}
          </div>
        )}

        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--admin-text-muted)' }}>
            {isArchived && (
              <span title="Archived — not shown in library or add menu" style={{ color: 'var(--admin-text-muted)', fontStyle: 'italic' }}>
                Archived
              </span>
            )}
            {!hasEn && !isArchived && (
              <span title="No English version" style={{ color: 'var(--admin-accent)' }}>RU only</span>
            )}
            {isUsed && (
              <span title={`Used in ${usageCount} ${usageCount === 1 ? 'day' : 'days'} across proposals`}>
                Used {usageCount}×
              </span>
            )}
          </div>
        )}
      </Link>

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
          color: 'var(--admin-text-muted)',
          fontSize: '16px',
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
            top: '50%',
            right: '12px',
            marginTop: '8px',
            background: 'var(--admin-input)',
            border: '1px solid var(--admin-border)',
            borderRadius: '8px',
            padding: '4px',
            minWidth: '180px',
            zIndex: 2,
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          }}>
            {isArchived ? (
              <button
                onClick={handleUnarchive}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--admin-text)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                Unarchive
              </button>
            ) : (
              <button
                onClick={handleArchive}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--admin-text)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                Archive
              </button>
            )}

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
                color: isUsed ? 'var(--admin-text-faint)' : 'var(--admin-danger)',
                fontSize: '13px',
                cursor: isUsed ? 'not-allowed' : 'pointer',
                borderRadius: '4px',
                fontFamily: 'inherit',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => {
                if (!isUsed) e.currentTarget.style.background = 'rgba(224, 123, 123, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
              title={isUsed ? `Used in ${usageCount} places — cannot delete` : undefined}
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
          color: 'var(--admin-danger)',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}