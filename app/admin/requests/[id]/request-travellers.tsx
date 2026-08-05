'use client'

import { useState, useEffect, useRef } from 'react'
import { useT } from '@/lib/i18n-client'
import { birthdayInTripWindow } from '@/lib/birthday'
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

// склонение по-русски
function ruPlural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
  return many
}

// возраст на сегодня — число (без единицы), чтобы агент видел, ребёнок это или взрослый
function ageFrom(dob: string | null): number | null {
  if (!dob) return null
  const m = dob.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  let birth: Date | null = null
  if (m) birth = new Date(+m[3], +m[2] - 1, +m[1])
  else {
    const d = new Date(dob)
    if (!isNaN(d.getTime())) birth = d
  }
  if (!birth) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const md = now.getMonth() - birth.getMonth()
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age--
  if (age < 0 || age > 120) return null
  return age
}

export default function RequestTravellers({
  requestId, clientId, initialIds, tripStart, tripEnd,
}: {
  requestId: string
  clientId: string
  initialIds: string[]
  tripStart?: string | null
  tripEnd?: string | null
}) {
  const t = useT()
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
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // сохраняем состав при любом изменении — всегда актуальное значение
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    setRequestTravellers(requestId, selected).catch(() => {})
  }, [selected, requestId])

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
        {t("Pick a client first — then you can choose who's travelling.",
           'Сначала выберите клиента — потом можно указать, кто едет.')}
      </p>
    )
  }

  // считаем только тех, кто реально есть в списке клиента
  const picked = selected
    .map((id) => all.find((x) => x.id === id))
    .filter((trav): trav is TravellerBrief => !!trav)
  const adults = picked.filter((trav) => !CHILD_TITLES.has(trav.title || '')).length
  const children = picked.length - adults

  return (
    <div>
      {selected.length > 0 && (
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 10px' }}>
          {adults > 0 && `${adults} ${t(adults === 1 ? 'adult' : 'adults', ruPlural(adults, 'взрослый', 'взрослых', 'взрослых'))}`}
          {adults > 0 && children > 0 && ' · '}
          {children > 0 && `${children} ${t(children === 1 ? 'child' : 'children', ruPlural(children, 'ребёнок', 'ребёнка', 'детей'))}`}
        </p>
      )}

      {loading ? (
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{t('Loading…', 'Загрузка…')}</p>
      ) : all.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 10px' }}>
          {t('This client has no travellers yet. Add the first one below.',
             'У этого клиента ещё нет путешественников. Добавьте первого ниже.')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
              {all.map((trav) => {
                const age = ageFrom(trav.date_of_birth)
                const checked = selected.includes(trav.id)
                const bday = birthdayInTripWindow(trav.date_of_birth, tripStart, tripEnd)
                return (
                  <label key={trav.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: `1px solid ${bday ? 'var(--admin-accent)' : 'var(--admin-border-card)'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--admin-text)', background: checked ? 'var(--admin-card)' : 'transparent' }}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(trav.id)} style={{ cursor: 'pointer' }} />
                    <span style={{ flex: 1 }}>
                      {trav.title && <span style={{ color: 'var(--admin-text-muted)' }}>{trav.title} </span>}
                      {trav.name || t('Unnamed', 'Без имени')}
                      {age != null && <span style={{ color: 'var(--admin-text-muted)' }}> · {age} {t('y.o.', 'л.')}</span>}
                      {bday && <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 600, color: 'var(--admin-accent)' }}>🎂 {t('Birthday during trip', 'ДР во время поездки')}</span>}
                    </span>
                    {trav.relation && (
                      <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>{trav.relation}</span>
                    )}
                  </label>
                )
              })}
        </div>
      )}

      {adding ? (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', padding: '10px', border: '1px solid var(--admin-border)', borderRadius: '6px' }}>
          <select value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ ...inputSt, width: '80px' }}>
            {TITLES.map((tt) => <option key={tt} value={tt}>{tt}</option>)}
          </select>
          <input type="text" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            placeholder={t('Full name', 'Полное имя')} style={{ ...inputSt, flex: 1, minWidth: '140px' }} />
          <input type="date" value={newDob} onChange={(e) => setNewDob(e.target.value)}
            title={t('Date of birth', 'Дата рождения')}
            style={{ ...inputSt, width: '150px' }} />
          <button type="button" onClick={handleCreate} disabled={busy || !newName.trim()}
            style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 500, background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '6px', cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy || !newName.trim() ? 0.4 : 1 }}>
            {busy ? t('Adding…', 'Добавляем…') : t('Add', 'Добавить')}
          </button>
          <button type="button" onClick={() => { setAdding(false); setNewName(''); setNewDob('') }}
            style={{ padding: '8px 12px', fontSize: '12px', background: 'transparent', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('Cancel', 'Отмена')}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          style={{ padding: '8px 14px', fontSize: '12px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {t('+ Add traveller', '+ Добавить путешественника')}
        </button>
      )}
    </div>
  )
}
