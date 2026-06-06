'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import LocationPicker from '@/app/admin/_components/location-picker'

type Filter = { value: string | null; label: string }

type Props = {
  defaultQuery: string
  activeType: string | null
  showArchived: boolean
  activeCountry: string | null
  activeCity: string | null
  typeFilters: Filter[]
  typeCounts: Record<string, number>
  totalCount: number
  archivedTotal: number
}

export default function LibrarySearch({
  defaultQuery,
  activeType,
  showArchived,
  activeCountry,
  activeCity,
  typeFilters,
  typeCounts,
  totalCount,
  archivedTotal,
}: Props) {
  const router = useRouter()
  const [value, setValue] = useState(defaultQuery)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMount = useRef(true)

  function buildUrl(overrides: Partial<{ q: string; type: string | null; archived: boolean; country: string | null; city: string | null }>) {
    const q = overrides.q !== undefined ? overrides.q : value.trim()
    const type = overrides.type !== undefined ? overrides.type : activeType
    const archived = overrides.archived !== undefined ? overrides.archived : showArchived
    const country = overrides.country !== undefined ? overrides.country : activeCountry
    const city = overrides.city !== undefined ? overrides.city : activeCity

    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (type) params.set('type', type)
    if (archived) params.set('archived', '1')
    if (country) params.set('country', country)
    if (city) params.set('city', city)
    const qs = params.toString()
    return `/admin/library${qs ? `?${qs}` : ''}`
  }

  useEffect(() => {
    if (isMount.current) {
      isMount.current = false
      return
    }

    if (timer.current) clearTimeout(timer.current)

    timer.current = setTimeout(() => {
      router.push(buildUrl({ q: value.trim() }))
    }, 400)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleCountryChange(id: string | null) {
    // При смене страны сбрасываем город (каскад)
    router.push(buildUrl({ country: id, city: null }))
  }

  function handleCityChange(id: string | null) {
    router.push(buildUrl({ city: id }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search by title, description, location..."
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
            transition: 'border-color 0.15s',
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
        {value && (
          <button
            type="button"
            onClick={() => setValue('')}
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
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#E5E2DA' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#888780' }}
          >
            ×
          </button>
        )}
      </div>

      {/* Geo filter: страна + город */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <LocationPicker
          mode="country"
          value={activeCountry}
          onChange={handleCountryChange}
          label="Страна"
          disableCreate
        />
        <LocationPicker
          mode="city"
          value={activeCity}
          onChange={handleCityChange}
          label="Город"
          disableCreate
          countryFilter={activeCountry}
        />
      </div>

      {/* Filters row: type pills + archived toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {typeFilters.map((f) => {
            const isActive = activeType === f.value
            const count = f.value === null ? totalCount : typeCounts[f.value] ?? 0
            return (
              <Link
                key={f.label}
                href={buildUrl({ type: f.value })}
                scroll={false}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  borderRadius: '999px',
                  textDecoration: 'none',
                  background: isActive ? '#FAF8F4' : 'transparent',
                  color: isActive ? '#2C2C2A' : '#888780',
                  border: `1px solid ${isActive ? '#FAF8F4' : '#333'}`,
                  fontWeight: isActive ? 500 : 400,
                  transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#E5E2DA'
                    e.currentTarget.style.borderColor = '#555'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#888780'
                    e.currentTarget.style.borderColor = '#333'
                  }
                }}
              >
                {f.label} <span style={{ opacity: 0.6, marginLeft: '4px' }}>{count}</span>
              </Link>
            )
          })}
        </div>

        <div style={{ flex: 1 }} />

        <Link
          href={buildUrl({ archived: !showArchived })}
          scroll={false}
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            borderRadius: '999px',
            textDecoration: 'none',
            background: showArchived ? '#2A2A28' : 'transparent',
            color: showArchived ? '#E5E2DA' : '#888780',
            border: `1px solid ${showArchived ? '#444' : '#333'}`,
            fontWeight: showArchived ? 500 : 400,
            transition: 'color 0.15s, border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!showArchived) {
              e.currentTarget.style.color = '#E5E2DA'
              e.currentTarget.style.borderColor = '#555'
            }
          }}
          onMouseLeave={(e) => {
            if (!showArchived) {
              e.currentTarget.style.color = '#888780'
              e.currentTarget.style.borderColor = '#333'
            }
          }}
        >
          {showArchived ? '← Back to active' : 'Show archived'} <span style={{ opacity: 0.6, marginLeft: '4px' }}>{archivedTotal}</span>
        </Link>
      </div>
    </div>
  )
}