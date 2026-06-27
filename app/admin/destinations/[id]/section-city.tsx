'use client'

import { useState, useEffect } from 'react'
import { updateSection, getBlockBrief, type BlockBrief } from './destination-actions'
import type { DestinationSection } from './destination-actions'
import SectionBlockPicker from './section-block-picker'

type Lang = 'ru' | 'en'

export default function SectionCity({
  section,
  lang,
  onLocalChange,
}: {
  section: DestinationSection
  lang: Lang
  onLocalChange: (patch: Partial<DestinationSection>) => void
}) {
  const [cityBlockId, setCityBlockId] = useState<string | null>(section.city_block_id)
  const [brief, setBrief] = useState<BlockBrief | null>(null)
  const [loadingBrief, setLoadingBrief] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  // подтянуть превью выбранного города
  useEffect(() => {
    let cancelled = false
    if (!cityBlockId) { setBrief(null); return }
    setLoadingBrief(true)
    getBlockBrief(cityBlockId)
      .then((b) => { if (!cancelled) setBrief(b) })
      .finally(() => { if (!cancelled) setLoadingBrief(false) })
    return () => { cancelled = true }
  }, [cityBlockId])

  async function handleSelect(blockId: string) {
    setCityBlockId(blockId)
    onLocalChange({ city_block_id: blockId })
    await updateSection(section.id, { city_block_id: blockId })
  }

  async function handleClear() {
    setCityBlockId(null)
    setBrief(null)
    onLocalChange({ city_block_id: null })
    await updateSection(section.id, { city_block_id: null })
  }

  const returnTo = `/admin/destinations/${section.proposal_id}`

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--admin-text-muted)', marginBottom: '6px', fontWeight: 500,
  }

  const title = brief ? (lang === 'ru' ? brief.title_ru : brief.title_en) : ''
  const facts = brief ? (lang === 'ru' ? brief.facts_ru : brief.facts_en) : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '12px' }}>
      <label style={labelStyle}>City block</label>

      {!cityBlockId ? (
        <button type="button" onClick={() => setPickerOpen(true)}
          style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          + Choose a city from library
        </button>
      ) : (
        <div style={{ border: '1px solid var(--admin-border-card)', borderRadius: '8px', padding: '12px', background: 'var(--admin-input)' }}>
          {loadingBrief ? (
            <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>Loading...</div>
          ) : brief ? (
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '6px', flexShrink: 0, background: brief.image_url ? `url(${brief.image_url}) center/cover no-repeat` : 'var(--admin-card)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--admin-text)' }}>
                  {title || <span style={{ color: 'var(--admin-text-muted)', fontStyle: 'italic' }}>Untitled</span>}
                </div>
                {facts ? (
                  <ul style={{ margin: '6px 0 0', paddingLeft: '18px', color: 'var(--admin-text-muted)' }}>
                    {facts.split('\n').filter((l) => l.trim()).slice(0, 3).map((l, i) => (
                      <li key={i} style={{ fontSize: '12px', lineHeight: 1.5 }}>{l}</li>
                    ))}
                    {facts.split('\n').filter((l) => l.trim()).length > 3 && (
                      <li style={{ fontSize: '12px', color: 'var(--admin-text-faint)', listStyle: 'none' }}>…</li>
                    )}
                  </ul>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--admin-text-faint)', marginTop: '4px' }}>
                    No facts yet. Edit this city block in the library to add facts.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--admin-danger)' }}>City block not found (deleted?).</div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button type="button" onClick={() => setPickerOpen(true)}
              style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--admin-text)', background: 'transparent', border: '1px solid var(--admin-border)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Change
            </button>
            {brief && (
              <a href={`/admin/library/${brief.id}?returnTo=${encodeURIComponent(returnTo)}`}
                style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--admin-text)', background: 'transparent', border: '1px solid var(--admin-border)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
                Edit facts →
              </a>
            )}
            <button type="button" onClick={handleClear}
              style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--admin-danger)', background: 'transparent', border: '1px solid var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Remove
            </button>
          </div>
        </div>
      )}

      <SectionBlockPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
        blockType="city"
        lang={lang}
        returnTo={returnTo}
        title={lang === 'ru' ? 'Выберите город' : 'Choose a city'}
      />
    </div>
  )
}