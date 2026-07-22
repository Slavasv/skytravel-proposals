'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { updateRequest, type RequestClientOption } from '../actions'
import ClientPicker from '@/app/admin/_components/client-picker'
import RequestDestinations from './request-destinations'
import type { RequestDestination } from '../destinations-actions'

type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

type RequestRow = {
  id: string
  request_code: string | null
  client_id: string | null
  destination: string | null
  details: string | null
  status: string | null
  priority: string | null
  closed_at: string | null
  created_at: string
}

const STATUSES: { value: string; label: string }[] = [
  { value: 'new', label: 'New Request' },
  { value: 'clients_review', label: 'Client review' },
  { value: 'preparing', label: 'Preparing proposal' },
  { value: 'proposal_sent', label: 'Proposal sent' },
  { value: 'revising', label: 'Revising proposal' },
  { value: 'booking', label: 'Booking in progress' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITIES = ['Low', 'Medium', 'High']
const CLOSING = ['confirmed', 'cancelled']

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', marginBottom: '6px', fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: '14px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

function daysBetween(from: string, to: string): string {
  const a = new Date(from), b = new Date(to)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return ''
  const diff = Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
  if (diff === 0) return 'closed same day'
  if (diff === 1) return 'closed in 1 day'
  return `closed in ${diff} days`
}

export default function RequestForm({
  request, clients, destinations,
}: {
  request: RequestRow
  clients: RequestClientOption[]
  destinations: RequestDestination[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pickedClient = searchParams.get('pickedClient')

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [closedAt, setClosedAt] = useState<string | null>(request.closed_at)

  const [form, setForm] = useState({
    client_id: request.client_id || '',
    destination: request.destination || '',
    details: request.details || '',
    status: request.status || 'new',
    priority: request.priority || '',
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
      await updateRequest(request.id, {
        client_id: current.client_id || null,
        destination: current.destination || null,
        details: current.details || null,
        status: current.status,
        priority: current.priority || null,
      })
      if (CLOSING.includes(current.status)) {
        setClosedAt((prev) => prev || new Date().toISOString())
      } else {
        setClosedAt(null)
      }
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

  useEffect(() => {
    if (pickedClient && pickedClient !== form.client_id) {
      set('client_id', pickedClient)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedClient])

  function renderSaveIndicator() {
    if (saveState === 'error') return <span style={{ color: 'var(--admin-danger)' }}>● Error: {errorMsg}</span>
    if (saveState === 'saving') return <span style={{ color: 'var(--admin-accent)' }}>● Saving...</span>
    if (saveState === 'editing') return <span style={{ color: 'var(--admin-text-muted)' }}>● Editing...</span>
    if (saveState === 'saved' && savedAt) return <span style={{ color: 'var(--admin-success)' }}>● Saved at {savedAt.toLocaleTimeString()}</span>
    return <span style={{ color: 'var(--admin-text-muted)' }}>● All changes saved</span>
  }

  async function handleDone() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (saveState === 'editing' || saveState === 'error') await saveNow(form)
    router.push('/admin/requests')
  }

  const isConfirmed = form.status === 'confirmed'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--admin-border-card)', fontSize: '12px' }}>
        <span style={{ color: 'var(--admin-text-muted)' }}>
          Created {new Date(request.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          {closedAt && (
            <span style={{ color: 'var(--admin-success)' }}> · {daysBetween(request.created_at, closedAt)}</span>
          )}
        </span>
        {renderSaveIndicator()}
      </div>

      <section>
        <label style={labelStyle}>Client</label>
        <ClientPicker
          clients={clients}
          value={form.client_id}
          onChange={(id) => set('client_id', id)}
          returnTo={`/admin/requests/${request.id}`}
        />
      </section>

      <section style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>Status</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} style={inputStyle}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ width: '140px' }}>
          <label style={labelStyle}>Priority</label>
          <select value={form.priority} onChange={(e) => set('priority', e.target.value)} style={inputStyle}>
            <option value="">—</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </section>

      {/* НАПРАВЛЕНИЯ */}
      <section>
        <label style={labelStyle}>Destinations</label>
        <RequestDestinations requestId={request.id} initial={destinations} />
      </section>

      <section>
        <label style={labelStyle}>Request details</label>
        <textarea value={form.details} onChange={(e) => set('details', e.target.value)} rows={8} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder="Dates, hotels, transfers, special requirements, budget..." />
      </section>

      {isConfirmed && (
        <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
          <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--admin-border-card)', borderRadius: '10px', background: 'var(--admin-card)' }}>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--admin-text)', marginBottom: '4px' }}>
              Booking — coming soon
            </div>
            <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
              Once this request is confirmed, you&apos;ll create a booking here with services, partners and pricing.
            </div>
          </div>
        </section>
      )}

      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={handleDone} disabled={saveState === 'saving'}
          style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 500, letterSpacing: '0.03em', background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '8px', cursor: saveState === 'saving' ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: saveState === 'saving' ? 0.6 : 1 }}>
          {saveState === 'saving' ? 'Saving…' : 'Done'}
        </button>
      </section>
    </div>
  )
}