'use client'

import { useState, useEffect, useRef } from 'react'
import { updateVoucher, type Guest } from './voucher-actions'
import VoucherHotels from './voucher-hotels'
import type { VoucherHotel } from './voucher-actions'
import DateInput from '@/app/admin/_components/date-input'
import VoucherActions from './voucher-actions-ui'

type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

type Voucher = {
  id: string
  slug: string
  greeting_for: string | null
  issue_date: string | null
  guests: unknown
  show_transfer: boolean | null
  transfers: unknown
  notes: string | null
}

// Обращения: взрослые и детские
const ADULT_TITLES = ['Mr', 'Mrs']
const CHILD_TITLES = ['Miss', 'Mstr', 'Chd', 'Inf']
const CHILD_SET = new Set(CHILD_TITLES)

function isChildTitle(title: string): boolean {
  return CHILD_SET.has(title)
}

// парсинг ДД/ММ/ГГГГ (или ДД.ММ.ГГГГ)
function parseDMY(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (!m) return null
  const d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10)
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

// полных лет от birth до ref
function fullYearsBetween(birth: Date, ref: Date): number {
  let age = ref.getFullYear() - birth.getFullYear()
  const m = ref.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--
  return age
}

function normalizeGuests(data: unknown): Guest[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      id: typeof x.id === 'string' ? x.id : Math.random().toString(36).slice(2),
      title: typeof x.title === 'string' ? x.title : '',
      name: typeof x.name === 'string' ? x.name : '',
      is_child: !!x.is_child,
      birth_date: typeof x.birth_date === 'string' ? x.birth_date : '',
    }))
}

export type Transfer = { date: string; from: string; to: string; type: string }

function normalizeTransfers(data: unknown): Transfer[] {
  if (!Array.isArray(data)) return []
  return data
    .map((x) => {
      if (typeof x === 'string') return { date: '', from: x, to: '', type: '' } // миграция старых строк
      if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>
        return {
          date: typeof o.date === 'string' ? o.date : '',
          from: typeof o.from === 'string' ? o.from : '',
          to: typeof o.to === 'string' ? o.to : '',
          type: typeof o.type === 'string' ? o.type : '',
        }
      }
      return { date: '', from: '', to: '', type: '' }
    })
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', marginBottom: '6px', fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: '14px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

export default function VoucherForm({
  voucher, hotels, lastCheckout,
}: {
  voucher: Voucher
  hotels: VoucherHotel[]
  lastCheckout: string | null
}) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    issue_date: voucher.issue_date || '',
    greeting_for: voucher.greeting_for || '',
    guests: normalizeGuests(voucher.guests),
    show_transfer: voucher.show_transfer ?? false,
    transfers: normalizeTransfers(voucher.transfers),
    notes: voucher.notes || '',
  })

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)
  const inFlight = useRef<Promise<void> | null>(null)

  // даты выезда из отелей в реальном времени (для расчёта возраста без перезагрузки)
  const initialCheckouts = hotels.map((h) => h.check_out || '').filter(Boolean)
  const [liveCheckouts, setLiveCheckouts] = useState<string[]>(
    lastCheckout ? [lastCheckout] : initialCheckouts
  )

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaveState('editing')
  }

  async function saveNow(current: typeof form) {
    setSaveState('saving')
    setErrorMsg(null)
    const promise = (async () => {
      try {
        await updateVoucher(voucher.id, {
          issue_date: current.issue_date || null,
          greeting_for: current.greeting_for || null,
          guests: current.guests,
          show_transfer: current.show_transfer,
          transfers: current.transfers,
          notes: current.notes || null,
        })
        setSavedAt(new Date())
        setSaveState('saved')
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Save failed')
        setSaveState('error')
      }
    })()
    inFlight.current = promise
    await promise
    if (inFlight.current === promise) inFlight.current = null
  }

  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveNow(form), 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  // ---- Guests ----
  function addGuest() {
    set('guests', [...form.guests, { id: Math.random().toString(36).slice(2), title: 'Mr', name: '', is_child: false, birth_date: '' }])
  }
  function changeGuest(id: string, patch: Partial<Guest>) {
    set('guests', form.guests.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }
  function changeTitle(id: string, title: string) {
    const child = isChildTitle(title)
    set('guests', form.guests.map((g) => (g.id === id
      ? { ...g, title, is_child: child, birth_date: child ? g.birth_date : '' }
      : g)))
  }
  function removeGuest(id: string) {
    set('guests', form.guests.filter((g) => g.id !== id))
  }

  // авто-Pax (ADL = взрослые, CHD = дети; Inf считаем отдельно как INF)
  const adults = form.guests.filter((g) => !isChildTitle(g.title)).length
  const infants = form.guests.filter((g) => g.title === 'Inf').length
  const children = form.guests.filter((g) => isChildTitle(g.title) && g.title !== 'Inf').length
  const paxParts = [
    adults > 0 ? `${adults} ADL` : '',
    children > 0 ? `${children} CHD` : '',
    infants > 0 ? `${infants} INF` : '',
  ].filter(Boolean)
  const paxString = paxParts.join(', ') || '—'

  // возраст ребёнка на последний check-out (из живых дат выезда отелей)
  let refDate: Date | null = null
  for (const c of liveCheckouts) {
    const d = parseDMY(c)
    if (d && (!refDate || d > refDate)) refDate = d
  }
  if (!refDate && lastCheckout) refDate = parseDMY(lastCheckout)
  function childAge(birth_date: string): string {
    if (!refDate) return ''
    const b = parseDMY(birth_date)
    if (!b) return ''
    const age = fullYearsBetween(b, refDate)
    if (age < 0) return ''
    return `${age} y.o.`
  }

  // ---- Transfers ----
  function addTransfer() { set('transfers', [...form.transfers, { date: '', from: '', to: '', type: '' }]) }
  function changeTransfer(i: number, patch: Partial<Transfer>) {
    set('transfers', form.transfers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  }
  function removeTransfer(i: number) {
    set('transfers', form.transfers.filter((_, idx) => idx !== i))
  }

  function renderSaveIndicator() {
    if (saveState === 'error') return <span style={{ color: 'var(--admin-danger)' }}>● Error: {errorMsg}</span>
    if (saveState === 'saving') return <span style={{ color: 'var(--admin-accent)' }}>● Saving...</span>
    if (saveState === 'editing') return <span style={{ color: 'var(--admin-text-muted)' }}>● Editing...</span>
    if (saveState === 'saved' && savedAt) return <span style={{ color: 'var(--admin-success)' }}>● Saved at {savedAt.toLocaleTimeString()}</span>
    return <span style={{ color: 'var(--admin-text-muted)' }}>● All changes saved</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '16px', borderBottom: '1px solid var(--admin-border-card)', fontSize: '12px' }}>
        {renderSaveIndicator()}
      </div>

      {/* HEADER */}
      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>Voucher details</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={labelStyle}>For (greeting names)</label>
            <input type="text" value={form.greeting_for} onChange={(e) => set('greeting_for', e.target.value)} style={inputStyle} placeholder="Iryna and Vitalii" />
          </div>
          <div style={{ width: '180px' }}>
            <label style={labelStyle}>Issue date</label>
            <DateInput value={form.issue_date} onChange={(v) => set('issue_date', v)} />
          </div>
        </div>
      </section>

      {/* HOTELS */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>Accommodation</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
          One or more hotels. Drag to reorder. Nights are calculated automatically from check-in / check-out.
        </p>
        <VoucherHotels voucherId={voucher.id} initialHotels={hotels} onCheckoutsChange={setLiveCheckouts} />
      </section>

      {/* GUESTS */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 500, margin: 0, color: 'var(--admin-text)' }}>Guests</h2>
          <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Pax: <b style={{ color: 'var(--admin-text)' }}>{paxString}</b></span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 14px' }}>
          Shared across the whole voucher. Adults: Mr/Mrs. Children: Miss/Mstr/Chd/Inf (date of birth required).
          {!refDate && <span> Add hotel check-out dates to calculate child ages.</span>}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {form.guests.map((g) => {
            const child = isChildTitle(g.title)
            const age = child ? childAge(g.birth_date) : ''
            return (
              <div key={g.id} style={{ border: '1px solid var(--admin-border-card)', borderRadius: '8px', padding: '10px', background: 'var(--admin-input)' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select value={g.title} onChange={(e) => changeTitle(g.id, e.target.value)} style={{ ...inputStyle, width: '110px', flexShrink: 0 }}>
                    <optgroup label="Adult">
                      {ADULT_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </optgroup>
                    <optgroup label="Child">
                      {CHILD_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </optgroup>
                  </select>
                  <input type="text" value={g.name} onChange={(e) => changeGuest(g.id, { name: e.target.value })} style={inputStyle} placeholder="Pertsev Yurii" />
                  <button type="button" onClick={() => removeGuest(g.id)} style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '8px 10px', fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
                </div>
                {child && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <DateInput value={g.birth_date} onChange={(v) => changeGuest(g.id, { birth_date: v })} placeholder="Date of birth dd/mm/yyyy" />
                    </div>
                    {age && (
                      <span style={{ fontSize: '13px', color: 'var(--admin-accent)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {age} <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}>at last check-out</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <button type="button" onClick={addGuest} style={{ marginTop: '10px', padding: '8px 14px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add guest
        </button>
      </section>

      {/* TRANSFER */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 500, color: 'var(--admin-text)', marginBottom: '10px' }}>
          <input type="checkbox" checked={form.show_transfer} onChange={(e) => set('show_transfer', e.target.checked)} />
          Show TRANSFER block
        </label>
        {form.show_transfer && (
          <div>
            <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 10px' }}>Date, from and to. E.g. 12/07/2026, Milan → Dubai.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {form.transfers.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', border: '1px solid var(--admin-border-card)', borderRadius: '8px', padding: '10px', background: 'var(--admin-input)' }}>
                  <div style={{ width: '130px', flexShrink: 0 }}>
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>Date</label>
                    <DateInput value={t.date} onChange={(v) => changeTransfer(i, { date: v })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>From</label>
                    <input type="text" value={t.from} onChange={(e) => changeTransfer(i, { from: e.target.value })} style={inputStyle} placeholder="Milan" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>To</label>
                    <input type="text" value={t.to} onChange={(e) => changeTransfer(i, { to: e.target.value })} style={inputStyle} placeholder="Dubai" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>Type</label>
                    <input type="text" value={t.type} onChange={(e) => changeTransfer(i, { type: e.target.value })} style={inputStyle} placeholder="Private car" />
                  </div>
                  <button type="button" onClick={() => removeTransfer(i)} style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '9px 10px', fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addTransfer} style={{ marginTop: '10px', padding: '8px 14px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Add transfer
            </button>
          </div>
        )}
      </section>

      {/* NOTES */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 12px', color: 'var(--admin-text)' }}>Notes (optional)</h2>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder="Any additional notes for this voucher..." />
      </section>

      {/* SHARE + DONE */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <VoucherActions voucherId={voucher.id} initialSlug={voucher.slug} />
      </section>
    </div>
  )
}