'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { deleteBlock, archiveBlock, unarchiveBlock } from './actions'

type CityJoin = { name_ru: string; name_en: string; countries: { name_ru: string; name_en: string } | { name_ru: string; name_en: string }[] | null }
type CountryJoin = { name_ru: string; name_en: string }

export type LibraryBlock = {
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
  updated_at: string
  cities: CityJoin | CityJoin[] | null
  countries: CountryJoin | CountryJoin[] | null
  usageCount: number
}

// Достаём один объект из join (Supabase возвращает либо объект, либо массив)
function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

// Подпись локации для типа hotel/city; для activity/transfer возвращает null
function formatLocation(block: LibraryBlock): string | null {
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(s: string | null): string {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function BlockRowItem({ block, onOpen }: { block: LibraryBlock; onOpen: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [error, setError] = useState<string | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const title = block.title_ru || block.title_en
  const hasEn = Boolean(block.title_en && block.description_en)
  const isUsed = block.usageCount > 0
  const isArchived = block.archived_at !== null
  const location = formatLocation(block)

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 160) })
    setMenuOpen(true)
  }
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  function handleArchive(e: React.MouseEvent) {
    e.stopPropagation(); setMenuOpen(false); setError(null)
    startTransition(async () => {
      try {
        await archiveBlock(block.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Archive failed')
      }
    })
  }

  function handleUnarchive(e: React.MouseEvent) {
    e.stopPropagation(); setMenuOpen(false); setError(null)
    startTransition(async () => {
      try {
        await unarchiveBlock(block.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unarchive failed')
      }
    })
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation(); setMenuOpen(false); setError(null)

    if (isUsed) {
      setError(`Cannot delete: used in ${block.usageCount} ${block.usageCount === 1 ? 'place' : 'places'}`)
      return
    }

    if (!confirm(`Delete block "${title || 'Untitled'}"?\n\nThis cannot be undone.`)) return

    startTransition(async () => {
      try {
        await deleteBlock(block.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed')
      }
    })
  }

  return (
    <tr className="adm-row" onClick={onOpen} style={{ opacity: isPending ? 0.4 : 1 }}>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="adm-cell-strong" style={{ fontStyle: title ? undefined : 'italic', color: title ? undefined : '#9C988E' }}>
            {title || 'Untitled'}
          </span>
          {isArchived && (
            <span style={{ fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '1px 5px' }}>
              Archived
            </span>
          )}
          {!hasEn && !isArchived && (
            <span style={{ fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--admin-accent)', border: '1px solid var(--admin-accent)', borderRadius: '4px', padding: '1px 5px' }}>
              RU only
            </span>
          )}
        </div>
        {block.tags && block.tags.length > 0 && (
          <div className="adm-cell-code">
            {block.tags.slice(0, 3).map((t) => `#${t}`).join(' ')}
            {block.tags.length > 3 && ` +${block.tags.length - 3}`}
          </div>
        )}
        {error && <div style={{ fontSize: '11px', color: 'var(--admin-danger)', marginTop: '4px' }}>{error}</div>}
      </td>
      <td>
        <span className="adm-pill adm-tone-info">{block.type}</span>
      </td>
      <td style={{ color: location ? undefined : '#9C988E' }}>{location || '—'}</td>
      <td className="adm-cell-muted">{isUsed ? `Used ${block.usageCount}×` : '—'}</td>
      <td className="adm-cell-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(block.updated_at)}</td>
      <td className="adm-right" onClick={stop}>
        <button ref={btnRef} className="adm-dots" disabled={isPending} aria-label="Actions"
          onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}>⋯</button>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div className="adm-menu" style={{ top: menuPos.top, left: menuPos.left }}>
              {isArchived ? (
                <button className="adm-menu-item" onClick={handleUnarchive}>Unarchive</button>
              ) : (
                <button className="adm-menu-item" onClick={handleArchive}>Archive</button>
              )}
              <button className="adm-menu-item danger" onClick={handleDelete} disabled={isUsed}
                title={isUsed ? `Used in ${block.usageCount} places — cannot delete` : undefined}>
                {isUsed ? `Delete (used ${block.usageCount}×)` : 'Delete'}
              </button>
            </div>
          </>
        )}
      </td>
    </tr>
  )
}

export default function LibraryTable({ blocks }: { blocks: LibraryBlock[] }) {
  const router = useRouter()

  return (
    <div className="adm-tcard">
      <div className="adm-tscroll">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Location</th>
              <th>Used</th>
              <th>Updated</th>
              <th> </th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <BlockRowItem key={b.id} block={b} onOpen={() => router.push(`/admin/library/${b.id}`)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
