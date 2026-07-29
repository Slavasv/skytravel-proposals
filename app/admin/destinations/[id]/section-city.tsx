'use client'

import { useState, useEffect, useRef } from 'react'
import { updateSection, getBlockBrief, type BlockBrief } from './destination-actions'
import type { DestinationSection } from './destination-actions'
import SectionBlockPicker from './section-block-picker'

type Lang = 'ru' | 'en'

function getStr(data: unknown, key: string): string {
  if (data && typeof data === 'object' && key in data) {
    const v = (data as Record<string, unknown>)[key]
    return typeof v === 'string' ? v : ''
  }
  return ''
}

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

  // Подзаголовок региона/города (курсивная строка под заголовком на публичной странице)
  const [subtitleRu, setSubtitleRu] = useState(getStr(section.data, 'subtitle_ru'))
  const [subtitleEn, setSubtitleEn] = useState(getStr(section.data, 'subtitle_en'))
  const [subSaved, setSubSaved] = useState(false)
  const subTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const subInitial = useRef(true)

  useEffect(() => {
    if (subInitial.current) { subInitial.current = false; return }
    const payload = { subtitle_ru: subtitleRu, subtitle_en: subtitleEn }
    onLocalChange({ data: payload })
    if (subTimer.current) clearTimeout(subTimer.current)
    subTimer.current = setTimeout(async () => {
      await updateSection(section.id, { data: payload })
      setSubSaved(true)
    }, 1000)
    return () => { if (subTimer.current) clearTimeout(subTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtitleRu, subtitleEn])

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
  const inputStyle: React.CSSProperties = {
    padding: '8px 10px', fontSize: '14px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
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

      <div>
        <label style={labelStyle}>Subtitle (optional) · {lang.toUpperCase()}</label>
        {lang === 'ru' ? (
          <input type="text" value={subtitleRu} onChange={(e) => { setSubtitleRu(e.target.value); setSubSaved(false) }}
            style={{ ...inputStyle, width: '100%' }}
            placeholder="Например: Бесконечная саванна, где разворачивается природная драма" />
        ) : (
          <input type="text" value={subtitleEn} onChange={(e) => { setSubtitleEn(e.target.value); setSubSaved(false) }}
            style={{ ...inputStyle, width: '100%' }}
            placeholder="e.g.: Endless savannah where nature's greatest drama unfolds" />
        )}
        <div style={{ fontSize: '11px', color: subSaved ? 'var(--admin-success)' : 'var(--admin-text-muted)', marginTop: '4px' }}>
          {subSaved ? '● Saved' : ''}
        </div>
      </div>

      <SectionBlockPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
        blockType="city"
        lang={lang}
        returnTo={returnTo}
        title={lang === 'ru' ? 'Выберите город' : 'Choose a city'}
        attachKind="city"
        attachSectionId={section.id}
      />
    </div>
  )
}