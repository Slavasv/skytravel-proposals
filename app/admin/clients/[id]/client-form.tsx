'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { updateClient, ensurePrimaryTraveller, type Traveller } from '../actions'
import ClientTravellers from './client-travellers'

type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

type Client = {
  id: string
  name: string | null
  client_code: string | null
  client_type: string | null
  client_status: string | null
  lead_source: string | null
  countries: string[] | null
  phone: string | null
  email: string | null
  balance_usd: number | null
  balance_eur: number | null
  notes: string | null
}

const CLIENT_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'family', label: 'Family' },
  { value: 'company', label: 'Company' },
]

const CLIENT_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'regular', label: 'Regular' },
]

// подсказки источников (можно вписать своё)
const LEAD_SOURCES = [
  'Personal Encounter',
  'Referral',
  'Instagram',
  'Website',
  'Recommendation',
]

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', marginBottom: '6px', fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: '14px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

export default function ClientForm({ client, travellers }: { client: Client; travellers: Traveller[] }) {
  const router = useRouter()
  const [travellerList, setTravellerList] = useState<Traveller[]>(travellers)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: client.name || '',
    client_code: client.client_code || '',
    client_type: client.client_type || 'individual',
    client_status: client.client_status || 'new',
    lead_source: client.lead_source || '',
    countries: (client.countries || []).join(', '),
    phone: client.phone || '',
    email: client.email || '',
    balance_usd: client.balance_usd != null ? String(client.balance_usd) : '0',
    balance_eur: client.balance_eur != null ? String(client.balance_eur) : '0',
    notes: client.notes || '',
  })

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaveState('editing')
  }

  async function saveNow(current: typeof form) {
    setSaveState('saving')
    setErrorMsg(null)
    try {
      await updateClient(client.id, {
        name: current.name,
        client_code: current.client_code || null,
        client_type: current.client_type,
        client_status: current.client_status,
        lead_source: current.lead_source || null,
        // "UAE, Austria" → ['UAE', 'Austria']
        countries: current.countries
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        phone: current.phone || null,
        email: current.email || null,
        balance_usd: current.balance_usd ? parseFloat(current.balance_usd) : 0,
        balance_eur: current.balance_eur ? parseFloat(current.balance_eur) : 0,
        notes: current.notes || null,
      })
      setSavedAt(new Date())
      setSaveState('saved')

      // Для individual-клиента заводим traveller-«себя», если его ещё нет
      if (current.client_type === 'individual' && current.name.trim()) {
        const created = await ensurePrimaryTraveller(client.id)
        if (created) {
          setTravellerList((prev) => (prev.length === 0 ? [created] : prev))
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save failed')
      setSaveState('error')
    }
  }

  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveNow(form), 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  // Сохраняем немедленно (не ждём автосейв) и возвращаемся в список
  async function handleDone() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (saveState === 'editing' || saveState === 'error') {
      await saveNow(form)
    }
    router.push('/admin/clients')
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

      {/* ОСНОВНОЕ */}
      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>Client details</h2>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <label style={labelStyle}>Name</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} style={inputStyle} placeholder="The Pertsev Family" />
          </div>
          <div style={{ width: '140px' }}>
            <label style={labelStyle}>Client code</label>
            <input type="text" value={form.client_code} onChange={(e) => set('client_code', e.target.value)} style={inputStyle} placeholder="CL-001" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={labelStyle}>Type</label>
            <select value={form.client_type} onChange={(e) => set('client_type', e.target.value)} style={inputStyle}>
              {CLIENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={labelStyle}>Status</label>
            <select value={form.client_status} onChange={(e) => set('client_status', e.target.value)} style={inputStyle}>
              {CLIENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={labelStyle}>Lead source</label>
            <input type="text" list="lead-source-options" value={form.lead_source} onChange={(e) => set('lead_source', e.target.value)} style={inputStyle} placeholder="Select or type..." />
            <datalist id="lead-source-options">
              {LEAD_SOURCES.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        </div>
      </section>

      {/* КОНТАКТЫ */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>Contacts</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={labelStyle}>Phone</label>
            <input type="text" value={form.phone} onChange={(e) => set('phone', e.target.value)} style={inputStyle} placeholder="+971 50 123 4567" />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} style={inputStyle} placeholder="client@example.com" />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Countries</label>
          <input type="text" value={form.countries} onChange={(e) => set('countries', e.target.value)} style={inputStyle} placeholder="UAE, Austria" />
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>
            Separate multiple countries with commas.
          </p>
        </div>
      </section>

      {/* ФИНАНСЫ */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>Balance</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
          Manual for now. Will be linked to bookings later.
        </p>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={labelStyle}>Balance USD</label>
            <input type="number" step="0.01" value={form.balance_usd} onChange={(e) => set('balance_usd', e.target.value)} style={inputStyle} placeholder="0" />
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={labelStyle}>Balance EUR</label>
            <input type="number" step="0.01" value={form.balance_eur} onChange={(e) => set('balance_eur', e.target.value)} style={inputStyle} placeholder="0" />
          </div>
        </div>
      </section>

      {/* TRAVELLERS */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>Travellers</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
          People who actually travel. Drag to reorder. These will be pulled into vouchers automatically.
        </p>
        <ClientTravellers clientId={client.id} initialTravellers={travellerList} key={travellerList.length} />
      </section>

      {/* ЗАМЕТКИ */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 12px', color: 'var(--admin-text)' }}>Notes</h2>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder="Any additional notes about this client..." />
      </section>

      {/* DONE */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleDone}
          disabled={saveState === 'saving'}
          style={{
            padding: '10px 24px', fontSize: '13px', fontWeight: 500, letterSpacing: '0.03em',
            background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)',
            border: 'none', borderRadius: '8px',
            cursor: saveState === 'saving' ? 'wait' : 'pointer', fontFamily: 'inherit',
            opacity: saveState === 'saving' ? 0.6 : 1,
          }}
        >
          {saveState === 'saving' ? 'Saving…' : 'Done'}
        </button>
      </section>
    </div>
  )
}