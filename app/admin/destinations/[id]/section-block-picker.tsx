'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getLibraryBlocks, type LibraryBlock } from '@/app/admin/proposals/[id]/block-actions'
import { createBlockMinimal } from '@/app/admin/library/actions'

type Lang = 'ru' | 'en'
type PickType = 'city' | 'hotel' | 'activity'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSelect: (blockId: string) => void
  blockType: PickType
  lang: Lang
  returnTo: string // куда вернуться после создания нового блока (URL направления)
  title?: string
}

const TYPE_LABEL: Record<PickType, string> = {
  city: 'city',
  hotel: 'hotel',
  activity: 'activity',
}

export default function SectionBlockPicker({ isOpen, onClose, onSelect, blockType, lang, returnTo, title }: Props) {
  const router = useRouter()
  const [blocks, setBlocks] = useState<LibraryBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()

  const [creatingOpen, setCreatingOpen] = useState(false)
  const [newTitleRu, setNewTitleRu] = useState('')
  const [newTitleEn, setNewTitleEn] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    getLibraryBlocks()
      .then((data) => setBlocks(data.filter((b) => b.type === blockType)))
      .finally(() => setLoading(false))
  }, [isOpen, blockType])

  useEffect(() => {
    if (!isOpen) {
      setSearch(''); setCreatingOpen(false); setNewTitleRu(''); setNewTitleEn(''); setCreateError('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const filtered = blocks.filter((b) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return [b.title_ru, b.title_en, b.description_ru, b.description_en, ...(b.tags ?? [])]
      .some((f) => f && f.toLowerCase().includes(q))
  })

  function handleSelect(blockId: string) {
    startTransition(() => {
      onSelect(blockId)
      onClose()
    })
  }

  async function handleCreate() {
    setCreateError('')
    if (!newTitleRu.trim() && !newTitleEn.trim()) {
      setCreateError(lang === 'ru' ? 'Введите название хотя бы на одном языке' : 'Enter a title in at least one language')
      return
    }
    setCreating(true)
    try {
      const newId = await createBlockMinimal({
        type: blockType, title_ru: newTitleRu, title_en: newTitleEn, city_id: null, country_id: null,
      })
      const ret = encodeURIComponent(returnTo)
      router.push(`/admin/library/${newId}?returnTo=${ret}`)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Error')
      setCreating(false)
    }
  }

  if (!isOpen) return null

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', fontSize: '14px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '8px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100 }} />
      <div role="dialog" aria-modal="true"
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '90%', maxWidth: '640px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          background: 'var(--admin-card)', border: '1px solid var(--admin-border-card)', borderRadius: '10px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)', zIndex: 101, fontFamily: 'system-ui', color: 'var(--admin-text)',
        }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--admin-border-card)' }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 500, margin: '0 0 2px' }}>
              {title || `Choose a ${TYPE_LABEL[blockType]}`}
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--admin-text-muted)' }}>{filtered.length} of {blocks.length}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: 'var(--admin-text-muted)', fontSize: '22px', lineHeight: 1, cursor: 'pointer', padding: '4px 10px', fontFamily: 'inherit' }}>×</button>
        </div>

        {/* Search + create */}
        <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--admin-border-card)' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
              placeholder={lang === 'ru' ? 'Поиск...' : 'Search...'} style={inputStyle} />
            <button type="button" onClick={() => setCreatingOpen((v) => !v)}
              style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 500, background: 'transparent', color: 'var(--admin-accent)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              + New
            </button>
          </div>

          {creatingOpen && (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input type="text" value={newTitleRu} onChange={(e) => setNewTitleRu(e.target.value)} placeholder={lang === 'ru' ? 'Название (RU)' : 'Title (RU)'} style={inputStyle} />
                <input type="text" value={newTitleEn} onChange={(e) => setNewTitleEn(e.target.value)} placeholder="Title (EN)" style={inputStyle} />
              </div>
              {createError && <div style={{ fontSize: '12px', color: 'var(--admin-danger)' }}>{createError}</div>}
              <button type="button" onClick={handleCreate} disabled={creating}
                style={{ alignSelf: 'flex-start', padding: '8px 16px', fontSize: '13px', fontWeight: 500, background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '6px', cursor: creating ? 'wait' : 'pointer', opacity: creating ? 0.5 : 1, fontFamily: 'inherit' }}>
                {creating ? (lang === 'ru' ? 'Создание...' : 'Creating...') : (lang === 'ru' ? 'Создать и заполнить →' : 'Create and fill in →')}
              </button>
            </div>
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 22px' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', fontSize: '14px' }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-border)', borderRadius: '8px', fontSize: '13px' }}>
              {blocks.length === 0 ? `No ${TYPE_LABEL[blockType]} blocks yet. Create one with + New.` : 'Nothing matches your search.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filtered.map((b) => {
                const t = lang === 'ru' ? b.title_ru : b.title_en
                return (
                  <button key={b.id} type="button" onClick={() => handleSelect(b.id)} disabled={isPending}
                    style={{
                      display: 'grid', gridTemplateColumns: '56px 1fr', gap: '12px', padding: '10px',
                      border: '1px solid var(--admin-border-card)', borderRadius: '6px', background: 'transparent',
                      color: 'inherit', cursor: isPending ? 'wait' : 'pointer', fontFamily: 'inherit', textAlign: 'left',
                      opacity: isPending ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => { if (!isPending) e.currentTarget.style.background = 'var(--admin-input)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '4px', background: b.image_url ? `url(${b.image_url}) center/cover no-repeat` : 'var(--admin-card)' }} />
                    <div style={{ minWidth: 0, alignSelf: 'center' }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t || <span style={{ color: 'var(--admin-text-muted)', fontStyle: 'italic' }}>Untitled</span>}
                      </div>
                      {b.tags && b.tags.length > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                          {b.tags.slice(0, 4).map((t) => `#${t}`).join(' ')}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}