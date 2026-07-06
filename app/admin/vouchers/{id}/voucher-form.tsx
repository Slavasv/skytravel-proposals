'use client'

import { useState, useEffect, useRef } from 'react'
import { updateVoucher, type Guest } from './voucher-actions'

type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

type Voucher = {
  id: string
  voucher_no: string | null
  issue_date: string | null
  booking_ref: string | null
  guests: unknown
  show_transfer: boolean | null
  transfers: unknown
  notes: string | null
}

const TITLES = ['', 'Mr', 'Mrs', 'Ms', 'Miss']

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

function normalizeTransfers(data: unknown): string[] {
  if (!Array.isArray(data)) return []
  return data.filter((x): x is string => typeof x === 'string')
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

export default function VoucherForm({ voucher }: { voucher: Voucher }) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    voucher_no: voucher.voucher_no || '',
    issue_date: voucher.issue_date || '',
    booking_ref: voucher.booking_ref || '',
    guests: normalizeGuests(voucher.guests),
    show_transfer: voucher.show_transfer ?? false,
    transfers: normalizeTransfers(voucher.transfers),
    notes: voucher.notes || '',
  })

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)
  const inFlight = useRef<Promise<void> | null>(null)

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
          voucher_no: current.voucher_no || null,
          issue_date: current.issue_date || null,
          booking_ref: current.booking_ref || null,
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
    set('guests', [...form.guests, { id: Math.random().toString(36).slice(2), title: '', name: '', is_child: false, birth_date: '' }])
  }
  function changeGuest(id: string, patch: Partial<Guest>) {
    set('guests', form.guests.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }
  function removeGuest(id: string) {
    set('guests', form.guests.filter((g) => g.id !== id))
  }

  // авто-Pax
  const adults = form.guests.filter((g) => !g.is_child).length
  const children = form.guests.filter((g) => g.is_child).length
  const paxString = [adults > 0 ? `${adults} ADL` : '', children > 0 ? `${children} CHD` : ''].filter(Boolean).join(', ') || '—'

  // ---- Transfers ----
  function addTransfer() {
    set('transfers', [...form.transfers, ''])
  }
  function changeTransfer(i: number, value: string) {
    set('transfers', form.transfers.map((t, idx) => (idx === i ? value : t)))
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
      {/* Save indicator */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '16px', borderBottom: '1px solid var(--admin-border-card)', fontSize: '12px' }}>
        {renderSaveIndicator()}
      </div>

      {/* HEADER */}
      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>Voucher details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Voucher No.</label>
            <input type="text" value={form.voucher_no} onChange={(e) => set('voucher_no', e.target.value)} style={inputStyle} placeholder="3245678" />
          </div>
          <div>
            <label style={labelStyle}>Issue date</label>
            <input type="text" value={form.issue_date} onChange={(e) => set('issue_date', e.target.value)} style={inputStyle} placeholder="05.07.2026" />
          </div>
          <div>
            <label style={labelStyle}>Booking Ref.</label>
            <input type="text" value={form.booking_ref} onChange={(e) => set('booking_ref', e.target.value)} style={inputStyle} placeholder="3245678" />
          </div>
        </div>
      </section>

      {/* HOTELS placeholder (Step C) */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>Accommodation</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: 0 }}>
          Hotel blocks will be added here in the next step.
        </p>
      </section>

      {/* GUESTS */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 500, margin: 0, color: 'var(--admin-text)' }}>Guests</h2>
          <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Pax: <b style={{ color: 'var(--admin-text)' }}>{paxString}</b></span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 14px' }}>Shared across the whole voucher. Pax is calculated automatically.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {form.guests.map((g) => (
            <div key={g.id} style={{ border: '1px solid var(--admin-border-card)', borderRadius: '8px', padding: '10px', background: 'var(--admin-input)' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select value={g.title} onChange={(e) => changeGuest(g.id, { title: e.target.value })} style={{ ...inputStyle, width: '90px', flexShrink: 0 }}>
                  {TITLES.map((t) => <option key={t || 'none'} value={t}>{t || '—'}</option>)}
                </select>
                <input type="text" value={g.name} onChange={(e) => changeGuest(g.id, { name: e.target.value })} style={inputStyle} placeholder="Pertsev Yurii" />
                <button type="button" onClick={() => removeGuest(g.id)} style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '8px 10px', fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--admin-text)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={g.is_child} onChange={(e) => changeGuest(g.id, { is_child: e.target.checked, birth_date: e.target.checked ? g.birth_date : '' })} />
                  Child
                </label>
                {g.is_child && (
                  <input type="text" value={g.birth_date} onChange={(e) => changeGuest(g.id, { birth_date: e.target.value })} style={{ ...inputStyle, flex: 1 }} placeholder="Date of birth, e.g. 21/04/2015" />
                )}
              </div>
            </div>
          ))}
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
            <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 10px' }}>One transfer per line, e.g. «Milan → Dubai».</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {form.transfers.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', width: '70px', flexShrink: 0 }}>Transfer {i + 1}</span>
                  <input type="text" value={t} onChange={(e) => changeTransfer(i, e.target.value)} style={inputStyle} placeholder="12/07/2026 | Verona Airport (VRN) | Private car, Verona → Sirmione" />
                  <button type="button" onClick={() => removeTransfer(i)} style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '8px 10px', fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
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
    </div>
  )
}