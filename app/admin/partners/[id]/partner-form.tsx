'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { updatePartner } from '../actions'

type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

type Partner = {
  id: string
  name: string | null
  service_type: string | null
  destination: string | null
  operator_group: string | null
  useful_links: string | null
  comments: string | null
}

// типы услуг (можно вписать своё)
const SERVICE_TYPES = [
  'Accomodation',
  'DMC',
  'OTS',
  'Transfer company',
  'Private Guide',
  'Villa Rent Company',
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

export default function PartnerForm({ partner, returnTo }: { partner: Partner; returnTo?: string }) {
  const router = useRouter()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: partner.name || '',
    service_type: partner.service_type || '',
    destination: partner.destination || '',
    operator_group: partner.operator_group || '',
    useful_links: partner.useful_links || '',
    comments: partner.comments || '',
  })

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)

  // режим ручного ввода типа услуги
  const [customType, setCustomType] = useState(
    !!partner.service_type && !SERVICE_TYPES.includes(partner.service_type)
  )

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaveState('editing')
  }

  async function saveNow(current: typeof form) {
    setSaveState('saving')
    setErrorMsg(null)
    try {
      await updatePartner(partner.id, {
        name: current.name,
        service_type: current.service_type || null,
        destination: current.destination || null,
        operator_group: current.operator_group || null,
        useful_links: current.useful_links || null,
        comments: current.comments || null,
      })
      setSavedAt(new Date())
      setSaveState('saved')
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

  function renderSaveIndicator() {
    if (saveState === 'error') return <span style={{ color: 'var(--admin-danger)' }}>● Error: {errorMsg}</span>
    if (saveState === 'saving') return <span style={{ color: 'var(--admin-accent)' }}>● Saving...</span>
    if (saveState === 'editing') return <span style={{ color: 'var(--admin-text-muted)' }}>● Editing...</span>
    if (saveState === 'saved' && savedAt) return <span style={{ color: 'var(--admin-success)' }}>● Saved at {savedAt.toLocaleTimeString()}</span>
    return <span style={{ color: 'var(--admin-text-muted)' }}>● All changes saved</span>
  }

  async function handleDone() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (saveState === 'editing' || saveState === 'error') {
      await saveNow(form)
    }
    if (returnTo) {
      const sep = returnTo.includes('?') ? '&' : '?'
      router.push(`${returnTo}${sep}pickedPartner=${partner.id}`)
    } else {
      router.push('/admin/partners')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '16px', borderBottom: '1px solid var(--admin-border-card)', fontSize: '12px' }}>
        {renderSaveIndicator()}
      </div>

      {/* ОСНОВНОЕ */}
      <section>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <label style={labelStyle}>Name</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} style={inputStyle} placeholder="Park Hyatt Vienna" />
          </div>
          <div style={{ width: '200px' }}>
            <label style={labelStyle}>Service type</label>
            <select
              value={customType ? '__custom__' : form.service_type}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setCustomType(true)
                  set('service_type', '')
                } else {
                  setCustomType(false)
                  set('service_type', e.target.value)
                }
              }}
              style={inputStyle}
            >
              <option value="">— Select —</option>
              {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="__custom__">Custom…</option>
            </select>
            {customType && (
              <input
                type="text"
                value={form.service_type}
                onChange={(e) => set('service_type', e.target.value)}
                style={{ ...inputStyle, marginTop: '8px' }}
                placeholder="Enter custom type"
                autoFocus
              />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={labelStyle}>Destination</label>
            <input type="text" value={form.destination} onChange={(e) => set('destination', e.target.value)} style={inputStyle} placeholder="Austria" />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={labelStyle}>Hotel group / Operator</label>
            <input type="text" value={form.operator_group} onChange={(e) => set('operator_group', e.target.value)} style={inputStyle} placeholder="Hyatt" />
          </div>
        </div>
      </section>

      {/* ССЫЛКИ */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <label style={labelStyle}>Useful links</label>
        <textarea value={form.useful_links} onChange={(e) => set('useful_links', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder="Booking portal, contacts, rates..." />
      </section>

      {/* КОММЕНТАРИИ */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <label style={labelStyle}>Comments</label>
        <textarea value={form.comments} onChange={(e) => set('comments', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder="Any notes about this partner..." />
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
          {saveState === 'saving' ? 'Saving…' : (returnTo ? 'Done & back' : 'Done')}
        </button>
      </section>
    </div>
  )
}