'use client'

import { useState, useEffect, useRef } from 'react'
import { setBookingTravellers, type BookingTraveller } from '../actions'
import { useT } from '@/lib/i18n-client'

const CHILD_TITLES = new Set(['Miss', 'Mstr', 'Chd', 'Inf'])

function ageFrom(dob: string | null, t: (en: string, ru: string) => string): string {
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
  return `${age} ${t('y.o.', 'лет')}`
}

export default function BookingTravellers({
  bookingId, requestId, all, initialSelected,
}: {
  bookingId: string
  requestId: string | null
  all: BookingTraveller[]
  initialSelected: string[]
}) {
  const t = useT()
  const [selected, setSelected] = useState<string[]>(initialSelected)
  const firstRun = useRef(true)

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    if (!requestId || all.length === 0) return
    const alive = selected.filter((id) => all.some((trav) => trav.id === id))
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
        {t('No travellers for this client yet.', 'Пока нет путешественников для этого клиента.')}
      </p>
    )
  }

  const picked = selected
    .map((id) => all.find((x) => x.id === id))
    .filter((trav): trav is BookingTraveller => !!trav)
  const adults = picked.filter((trav) => !CHILD_TITLES.has(trav.title || '')).length
  const children = picked.length - adults

  return (
    <div>
      {picked.length > 0 && (
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 10px' }}>
          {adults > 0 && `${adults} ${adults === 1 ? t('adult', 'взрослый') : t('adults', 'взрослых')}`}
          {adults > 0 && children > 0 && ' · '}
          {children > 0 && `${children} ${children === 1 ? t('child', 'ребёнок') : t('children', 'детей')}`}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {all.map((trav) => {
          const age = ageFrom(trav.date_of_birth, t)
          const checked = selected.includes(trav.id)
          return (
            <label key={trav.id}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--admin-text)', background: checked ? 'var(--admin-card)' : 'transparent' }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(trav.id)} style={{ cursor: 'pointer' }} />
              <span style={{ flex: 1 }}>
                {trav.title && <span style={{ color: 'var(--admin-text-muted)' }}>{trav.title} </span>}
                {trav.name || t('Unnamed', 'Без имени')}
                {age && <span style={{ color: 'var(--admin-text-muted)' }}> · {age}</span>}
              </span>
              {trav.relation && (
                <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>{trav.relation}</span>
              )}
            </label>
          )
        })}
      </div>

      <p style={{ fontSize: '11px', color: 'var(--admin-text-muted)', margin: '8px 0 0' }}>
        {t('Shared with the request — changes here update it too.', 'Общие с запросом — изменения здесь обновляют и его.')}
      </p>
    </div>
  )
}