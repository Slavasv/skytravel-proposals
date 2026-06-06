'use client'

import { useState, useEffect, useTransition } from 'react'
import { addBlockToDay, getLibraryBlocks, type LibraryBlock } from './block-actions'
import type { Lang } from './edit-page-client'
import LocationPicker from '@/app/admin/_components/location-picker'
function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function formatLocation(b: LibraryBlock, lang: Lang): string | null {
  const ru = lang === 'ru'
  if (b.type === 'hotel') {
    const city = pickOne(b.cities)
    if (!city) return null
    const country = pickOne(city.countries)
    const cityName = ru ? city.name_ru : city.name_en
    const countryName = country ? (ru ? country.name_ru : country.name_en) : null
    return countryName ? `${cityName}, ${countryName}` : cityName
  }
  if (b.type === 'city') {
    const country = pickOne(b.countries)
    if (!country) return null
    return ru ? country.name_ru : country.name_en
  }
  return null
}

type Props = {
  isOpen: boolean
  onClose: () => void
  dayId: string
  dayNumber: number
  lang: Lang
}

const TYPE_FILTERS = [
  { value: null, label: 'All' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'activity', label: 'Activity' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'city', label: 'City' },
]

export default function AddBlockModal({ isOpen, onClose, dayId, dayNumber, lang }: Props) {
  const [blocks, setBlocks] = useState<LibraryBlock[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState<string | null>(null)
  const [activeCountry, setActiveCountry] = useState<string | null>(null)
  const [activeCity, setActiveCity] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Загружаем блоки при открытии модалки
  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    getLibraryBlocks()
      .then((data) => {
        setBlocks(data)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [isOpen])

  // Сброс полей при закрытии
  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      setActiveType(null)
      setActiveCountry(null)
      setActiveCity(null)
    }
  }, [isOpen])

  // Закрытие по Esc
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Подсчёт по типам для pills
  const typeCounts: Record<string, number> = {}
  for (const b of blocks) {
    typeCounts[b.type] = (typeCounts[b.type] ?? 0) + 1
  }

  // Фильтрация в памяти
  const filtered = blocks.filter((b) => {
    if (activeType && b.type !== activeType) return false

    // Гео-фильтр: при активном гео activity/transfer скрываются (универсальные).
    if (activeCountry || activeCity) {
      if (b.type === 'activity' || b.type === 'transfer') return false

      if (activeCity) {
        // Выбран город: оставляем hotel'ы этого города.
        // city-блоки тут не подходят (у них только country_id).
        if (b.city_id !== activeCity) return false
      } else if (activeCountry) {
        // Выбрана страна: hotel в городе этой страны ИЛИ city-блок этой страны.
        const city = Array.isArray(b.cities) ? b.cities[0] : b.cities
        const cityCountryId = city?.country_id ?? null
        const matchHotel = b.type === 'hotel' && cityCountryId === activeCountry
        const matchCity = b.type === 'city' && b.country_id === activeCountry
        if (!matchHotel && !matchCity) return false
      }
    }

    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    const fields = [
      b.title_ru,
      b.title_en,
      b.description_ru,
      b.description_en,
      b.location,
      ...(b.tags ?? []),
    ]
    return fields.some((f) => f && f.toLowerCase().includes(q))
  })

  function handleSelect(blockId: string) {
    startTransition(async () => {
      await addBlockToDay(dayId, blockId)
      onClose()
    })
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 100,
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-block-title"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '720px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#141414',
          border: '1px solid #2A2A28',
          borderRadius: '10px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
          zIndex: 101,
          fontFamily: 'system-ui',
          color: '#E5E2DA',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid #2A2A28',
        }}>
          <div>
            <h2 id="add-block-title" style={{
              fontSize: '18px',
              fontWeight: 500,
              margin: '0 0 2px',
              letterSpacing: '-0.01em',
            }}>
              Add block to Day {dayNumber}
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#888780' }}>
              {filtered.length} of {blocks.length} blocks
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888780',
              fontSize: '22px',
              lineHeight: 1,
              cursor: 'pointer',
              padding: '4px 10px',
              borderRadius: '6px',
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>

        {/* Search + filters */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #2A2A28' }}>
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, description, location, tags..."
              autoFocus
              style={{
                width: '100%',
                padding: '10px 14px',
                paddingLeft: '38px',
                fontSize: '14px',
                color: '#E5E2DA',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '8px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            <span style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#888780',
              fontSize: '14px',
              pointerEvents: 'none',
            }}>
              ⌕
            </span>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#888780',
                  fontSize: '14px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  fontFamily: 'inherit',
                }}
              >
                ×
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <LocationPicker
              mode="country"
              value={activeCountry}
              onChange={(id) => { setActiveCountry(id); setActiveCity(null) }}
              label="Страна"
              disableCreate
            />
            <LocationPicker
              mode="city"
              value={activeCity}
              onChange={setActiveCity}
              label="Город"
              disableCreate
              countryFilter={activeCountry}
            />
          </div>

          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {TYPE_FILTERS.map((f) => {
              const isActive = activeType === f.value
              const count = f.value === null ? blocks.length : typeCounts[f.value] ?? 0
              return (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setActiveType(f.value)}
                  style={{
                    padding: '5px 12px',
                    fontSize: '12px',
                    borderRadius: '999px',
                    background: isActive ? '#FAF8F4' : 'transparent',
                    color: isActive ? '#2C2C2A' : '#888780',
                    border: `1px solid ${isActive ? '#FAF8F4' : '#333'}`,
                    fontWeight: isActive ? 500 : 400,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {f.label} <span style={{ opacity: 0.6, marginLeft: '4px' }}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Blocks list */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 24px',
        }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#888780', fontSize: '14px' }}>
              Loading library...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              padding: '32px',
              textAlign: 'center',
              color: '#888780',
              border: '1px dashed #333',
              borderRadius: '8px',
              fontSize: '13px',
            }}>
              {blocks.length === 0
                ? 'Library is empty. Add blocks at /admin/library.'
                : 'No blocks match your search.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filtered.map((b) => {
                const title = lang === 'ru' ? b.title_ru : b.title_en
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSelect(b.id)}
                    disabled={isPending}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '64px 1fr',
                      gap: '14px',
                      padding: '10px',
                      border: '1px solid #2A2A28',
                      borderRadius: '6px',
                      background: 'transparent',
                      color: 'inherit',
                      cursor: isPending ? 'wait' : 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      opacity: isPending ? 0.5 : 1,
                      transition: 'background 0.12s, border-color 0.12s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isPending) {
                        e.currentTarget.style.background = '#1a1a1a'
                        e.currentTarget.style.borderColor = '#444'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.borderColor = '#2A2A28'
                    }}
                  >
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '4px',
                      background: b.image_url
                        ? `url(${b.image_url}) center/cover no-repeat`
                        : '#222',
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '10px',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#888780',
                        marginBottom: '2px',
                        fontWeight: 500,
                      }}>
                        {b.type}
                        {(() => {
                          const geo = formatLocation(b, lang)
                          return geo ? <span style={{ color: '#555', fontWeight: 400 }}> · {geo}</span> : null
                        })()}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {title || <span style={{ color: '#888780', fontStyle: 'italic' }}>Untitled</span>}
                      </div>
                      {b.tags && b.tags.length > 0 && (
                        <div style={{ fontSize: '11px', color: '#888780', marginTop: '4px' }}>
                          {b.tags.slice(0, 4).map((t) => `#${t}`).join(' ')}
                          {b.tags.length > 4 && <span> +{b.tags.length - 4}</span>}
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