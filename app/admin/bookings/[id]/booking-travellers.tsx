'use client'

import { useState, useEffect, useRef } from 'react'
import { setBookingTravellers, type BookingTraveller } from '../actions'

const CHILD_TITLES = new Set(['Miss', 'Mstr', 'Chd', 'Inf'])

function ageFrom(dob: string | null): string {
  if (!dob) return ''
  const m = dob.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  let birth: Date | null = null
  if (m) birth = new Date(+m[3], +m[2] - 1, +m[1])
  else {
    const d = new Date(dob)
    if (!isNaN(d.getTime())) birth = d
  }
  if (!birth) return ''
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const md = now.getMonth() - birth.getMonth()
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age--
  if (age < 0 || age > 120) return ''
  return `${age} y.o.`
}

export default function BookingTravellers({
  bookingId, requestId, all, initialSelected,
}: {
  bookingId: string
  requestId: string | null
  all: BookingTraveller[]
  initialSelected: string[]
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected)
  const firstRun = useRef(true)

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    if (!requestId || all.length === 0) return
    const alive = selected.filter((id) => all.some((t) => t.id === id))
    setBookingTravellers(bookingId, requestId, alive).catch(() => {})
  }, [selected, bookingId, requestId, all])

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  if (all.length === 0) {
    return (
      <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: 0 }}>
        No travellers for this client yet.
      </p>
    )
  }

  const picked = selected
    .map((id) => all.find((x) => x.id === id))
    .filter((t): t is BookingTraveller => !!t)
  const adults = picked.filter((t) => !CHILD_TITLES.has(t.title || '')).length
  const children = picked.length - adults

  return (
    <div>
      {picked.length > 0 && (
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 10px' }}>
          {adults > 0 && `${adults} ${adults === 1 ? 'adult' : 'adults'}`}
          {adults > 0 && children > 0 && ' · '}
          {children > 0 && `${children} ${children === 1 ? 'child' : 'children'}`}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {all.map((t) => {
          const age = ageFrom(t.date_of_birth)
          const checked = selected.includes(t.id)
          return (
            <label key={t.id}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--admin-text)', background: checked ? 'var(--admin-card)' : 'transparent' }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(t.id)} style={{ cursor: 'pointer' }} />
              <span style={{ flex: 1 }}>
                {t.title && <span style={{ color: 'var(--admin-text-muted)' }}>{t.title} </span>}
                {t.name || 'Unnamed'}
                {age && <span style={{ color: 'var(--admin-text-muted)' }}> · {age}</span>}
              </span>
              {t.relation && (
                <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>{t.relation}</span>
              )}
            </label>
          )
        })}
      </div>

      <p style={{ fontSize: '11px', color: 'var(--admin-text-muted)', margin: '8px 0 0' }}>
        Shared with the request — changes here update it too.
      </p>
    </div>
  )
}