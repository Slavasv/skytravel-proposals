'use client'

import { useIsMobile } from '@/lib/use-is-mobile'
import type { Lang } from './edit-page-client'

export type CostLine = {
  id: string
  category: 'hotel' | 'transfer' | 'activity'
  label_ru: string
  label_en: string
  nights: number | null
  details_ru: string
  details_en: string
  price: string
}

export type CostSuggestion = {
  category: 'hotel' | 'transfer' | 'activity'
  label_ru: string
  label_en: string
}

type Props = {
  lines: CostLine[]
  lang: Lang
  suggestions?: CostSuggestion[]
  onChange: (lines: CostLine[]) => void
}

const CATEGORIES: { key: CostLine['category']; title: string }[] = [
  { key: 'hotel', title: 'Hotels' },
  { key: 'transfer', title: 'Transfers' },
  { key: 'activity', title: 'Activities' },
]

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#888780',
  marginBottom: '6px',
  fontWeight: 500,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '14px',
  color: '#E5E2DA',
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: '6px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
}

function newId() {
  return `cl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export default function CostLines({ lines, lang, suggestions = [], onChange }: Props) {
  const isMobile = useIsMobile()

  function addLine(category: CostLine['category']) {
    onChange([
      ...lines,
      {
        id: newId(),
        category,
        label_ru: '',
        label_en: '',
        nights: null,
        details_ru: '',
        details_en: '',
        price: '',
      },
    ])
  }

  

  function updateLine(id: string, patch: Partial<CostLine>) {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  function removeLine(id: string) {
    onChange(lines.filter((l) => l.id !== id))
  }

  const labelKey = lang === 'ru' ? 'label_ru' : 'label_en'
  const detailsKey = lang === 'ru' ? 'details_ru' : 'details_en'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {(['hotel', 'transfer', 'activity'] as const).map((catKey) => {
        const catSug = suggestions.filter((s) => s.category === catKey && (s.label_ru || s.label_en))
        if (catSug.length === 0) return null
        return (
          <datalist key={`dl-${catKey}`} id={`sug-${catKey}-${lang}`}>
            {catSug.map((s, i) => {
              const v = (lang === 'ru' ? s.label_ru : s.label_en) || s.label_en || s.label_ru
              return <option key={i} value={v} />
            })}
          </datalist>
        )
      })}
      {CATEGORIES.map((cat) => {
        const catLines = lines.filter((l) => l.category === cat.key)
        const isHotel = cat.key === 'hotel'
        return (
          <div key={cat.key}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#E5E2DA', marginBottom: '10px' }}>
              {cat.title}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {catLines.map((line) => (
                <div
                  key={line.id}
                  style={{
                    border: '1px solid #2A2A28',
                    borderRadius: '8px',
                    padding: '12px',
                    background: '#141414',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile
                      ? '1fr'
                      : isHotel ? '3fr 80px 2fr' : '3fr 2fr',
                    gap: '10px',
                  }}>
                    <div>
                      <label style={labelStyle}>Label</label>
                      <input
                        type="text"
                        list={`sug-${line.category}-${lang}`}
                        value={line[labelKey]}
                        onChange={(e) => updateLine(line.id, { [labelKey]: e.target.value })}
                        style={inputStyle}
                        placeholder="e.g.: Four Seasons Serengeti"
                      />
                    </div>
                    {isHotel && (
                      <div>
                        <label style={labelStyle}>Nights</label>
                        <input
                          type="number"
                          min={0}
                          value={line.nights ?? ''}
                          onChange={(e) =>
                            updateLine(line.id, {
                              nights: e.target.value === '' ? null : parseInt(e.target.value) || null,
                            })
                          }
                          style={inputStyle}
                          placeholder="2"
                        />
                      </div>
                    )}
                    <div>
                      <label style={labelStyle}>Price</label>
                      <input
                        type="text"
                        value={line.price}
                        onChange={(e) => updateLine(line.id, { price: e.target.value })}
                        style={inputStyle}
                        placeholder="13,539.75 per person"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Details</label>
                    <input
                      type="text"
                      value={line[detailsKey]}
                      onChange={(e) => updateLine(line.id, { [detailsKey]: e.target.value })}
                      style={inputStyle}
                      placeholder="Deluxe City View, All Inclusive"
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        color: '#E07B7B',
                        background: 'transparent',
                        border: '1px solid #3a2a2a',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => addLine(cat.key)}
              style={{
                marginTop: catLines.length > 0 ? '10px' : '0',
                padding: '8px 14px',
                fontSize: '13px',
                color: '#C8A862',
                background: 'transparent',
                border: '1px dashed #3a3528',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {`+ Add ${cat.title.toLowerCase()}`}
            </button>
          </div>
        )
      })}
    </div>
  )
}