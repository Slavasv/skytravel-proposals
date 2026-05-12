'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type Filter = { value: string | null; label: string }

type Props = {
  defaultQuery: string
  activeType: string | null
  typeFilters: Filter[]
  typeCounts: Record<string, number>
  totalCount: number
}

export default function LibrarySearch({ defaultQuery, activeType, typeFilters, typeCounts, totalCount }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(defaultQuery)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMount = useRef(true)

  // Debounced URL update при печатании
  useEffect(() => {
    if (isMount.current) {
      isMount.current = false
      return
    }

    if (timer.current) clearTimeout(timer.current)

    timer.current = setTimeout(() => {
      const params = new URLSearchParams()
      if (value.trim()) params.set('q', value.trim())
      if (activeType) params.set('type', activeType)
      const qs = params.toString()
      router.push(`/admin/library${qs ? `?${qs}` : ''}`)
    }, 400)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [value, activeType, router])

  function buildTypeUrl(type: string | null) {
    const params = new URLSearchParams()
    if (value.trim()) params.set('q', value.trim())
    if (type) params.set('type', type)
    const qs = params.toString()
    return `/admin/library${qs ? `?${qs}` : ''}`
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
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Type pills */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {typeFilters.map((f) => {
          const isActive = activeType === f.value
          const count = f.value === null ? totalCount : typeCounts[f.value] ?? 0
          return (
            <Link
              key={f.label}
              href={buildTypeUrl(f.value)}
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
              }}
            >
              {f.label} <span style={{ opacity: 0.6, marginLeft: '4px' }}>{count}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}