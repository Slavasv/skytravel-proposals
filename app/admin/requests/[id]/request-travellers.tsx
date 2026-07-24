'use client'

import { useState, useEffect, useRef } from 'react'
import {
  getClientTravellers, setRequestTravellers, createTravellerQuick,
  type TravellerBrief,
} from '../travellers-actions'

const TITLES = ['Mr', 'Mrs', 'Miss', 'Mstr', 'Chd', 'Inf']
const CHILD_TITLES = new Set(['Miss', 'Mstr', 'Chd', 'Inf'])

const inputSt: React.CSSProperties = {
  padding: '8px 10px', fontSize: '13px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '4px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

// возраст на сегодня — чтобы агент видел, ребёнок это или взрослый
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

export default function RequestTravellers({
  requestId, clientId, initialIds,
}: {
  requestId: string
  clientId: string
  initialIds: string[]
}) {
  const [all, setAll] = useState<TravellerBrief[]>([])
  const [selected, setSelected] = useState<string[]>(initialIds)
  const selectedRef = useRef<string[]>(initialIds)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTitle, setNewTitle] = useState('Mr')
  const [newDob, setNewDob] = useState('')
  const [busy, setBusy] = useState(false)

  // подгружаем travellers выбранного клиента
  useEffect(() => {
    let cancelled = false
    if (!clientId) { setAll([]); return }
    setLoading(true)
    getClientTravellers(clientId).then((rows) => {
      if (cancelled) return
      setAll(rows)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [clientId])

  function toggle(id: string) {
    const next = selectedRef.current.includes(id)
      ? selectedRef.current.filter((x) => x !== id)
      : [...selectedRef.current, id]
    selectedRef.current = next
    setSelected(next)
    setRequestTravellers(requestId, next).catch(() => {})
  }

  async function handleCreate() {
    if (!newName.trim() || !clientId) return
    setBusy(true)
    const created = await createTravellerQuick(clientId, newName, newTitle, newDob || null)
    setBusy(false)
    if (!created) return
    setAll((p) => [...p, created])
    const next = [...selected, created.id]
    setSelected(next)
    await setRequestTravellers(requestId, next)
    setNewName('')
    setNewTitle('Mr')
    setNewDob('')
    setAdding(false)
  }

  if (!clientId) {
    return (
      <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: 0 }}>
        Pick a client first — then you can choose who&apos;s travelling.
      </p>
    )
  }

  // считаем только тех, кто реально есть в списке клиента
  const picked = selected
    .map((id) => all.find((x) => x.id === id))
    .filter((t): t is TravellerBrief => !!t)
  const adults = picked.filter((t) => !CHILD_TITLES.has(t.title || '')).length
  const children = picked.length - adults

  return (
    <div>
      {selected.length > 0 && (
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 10px' }}>
          {adults > 0 && `${adults} ${adults === 1 ? 'adult' : 'adults'}`}
          {adults > 0 && children > 0 && ' · '}
          {children > 0 && `${children} ${children === 1 ? 'child' : 'children'}`}
        </p>
      )}

      {loading ? (
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Loading…</p>
      ) : all.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 10px' }}>
          This client has no travellers yet. Add the first one below.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
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
      )}

      {adding ? (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', padding: '10px', border: '1px solid var(--admin-border)', borderRadius: '6px' }}>
          <select value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ ...inputSt, width: '80px' }}>
            {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="text" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            placeholder="Full name" style={{ ...inputSt, flex: 1, minWidth: '140px' }} />
          <input type="date" value={newDob} onChange={(e) => setNewDob(e.target.value)}
            title="Date of birth"
            style={{ ...inputSt, width: '150px' }} />
          <button type="button" onClick={handleCreate} disabled={busy || !newName.trim()}
            style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 500, background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '6px', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy || !newName.trim() ? 0.4 : 1 }}>
            {busy ? 'Adding…' : 'Add'}
          </button>
          <button type="button" onClick={() => { setAdding(false); setNewName(''); setNewDob('') }}
            style={{ padding: '8px 12px', fontSize: '12px', background: 'transparent', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          style={{ padding: '8px 14px', fontSize: '12px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add traveller
        </button>
      )}
    </div>
  )
}