'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  updateRequest, createProposalFromRequest, detachProposalFromRequest,
  selectDestination, unselectDestination,
  type RequestClientOption, type LinkedProposal, type DestinationOption,
} from '../actions'
import { createBookingFromRequest, type RequestBooking } from '@/app/admin/bookings/actions'
import RequestTravellers from './request-travellers'
import AttachDestination from './attach-destination'
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
  cancel_reason: string | null
  cancel_note: string | null
  client_notes: string | null
  agent_notes: string | null
  trip_rating: number | null
  trip_feedback: string | null
  traveller_ids: string[] | null
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

const CANCEL_REASONS = [
  'Too expensive',
  'Chose another agency',
  'Changed travel plans',
  'Dates / hotel did not fit',
  'No response from client',
  'Other',
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

function daysBetween(from: string, to: string): string {
  const a = new Date(from), b = new Date(to)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return ''
  const diff = Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
  if (diff === 0) return 'closed same day'
  if (diff === 1) return 'closed in 1 day'
  return `closed in ${diff} days`
}

export default function RequestForm({
  request, clients, destinations, linked = [], availableDestinations = [], bookings = [],
}: {
  request: RequestRow
  clients: RequestClientOption[]
  destinations: RequestDestination[]
  linked?: LinkedProposal[]
  availableDestinations?: DestinationOption[]
  bookings?: RequestBooking[]
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
    cancel_reason: request.cancel_reason || '',
    cancel_note: request.cancel_note || '',
    client_notes: request.client_notes || '',
    agent_notes: request.agent_notes || '',
    trip_rating: request.trip_rating ?? 0,
    trip_feedback: request.trip_feedback || '',
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
        cancel_reason: current.status === 'cancelled' ? (current.cancel_reason || null) : null,
        cancel_note: current.status === 'cancelled' ? (current.cancel_note || null) : null,
        client_notes: current.client_notes || null,
        agent_notes: current.agent_notes || null,
        trip_rating: current.trip_rating > 0 ? current.trip_rating : null,
        trip_feedback: current.trip_feedback || null,
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
  // бронь заводим уже на этапе бронирования, не дожидаясь Confirmed
  const canBook = form.status === 'booking' || form.status === 'confirmed'

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

      
    {/* КТО ЕДЕТ */}
      <section>
        <label style={labelStyle}>Travellers</label>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 10px' }}>
          Who&apos;s going on this trip. You can change this later at any stage.
        </p>
        <RequestTravellers
          requestId={request.id}
          clientId={form.client_id}
          initialIds={request.traveller_ids ?? []}
        />
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

      {/* ПРИЧИНА ОТМЕНЫ — только для cancelled */}
      {form.status === 'cancelled' && (
        <section style={{ padding: '16px', border: '1px solid var(--admin-danger)', borderRadius: '10px' }}>
          <label style={labelStyle}>Why was it cancelled?</label>
          <select value={form.cancel_reason} onChange={(e) => set('cancel_reason', e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }}>
            <option value="">— Select a reason —</option>
            {CANCEL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <textarea value={form.cancel_note} onChange={(e) => set('cancel_note', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder="Details (optional)" />
        </section>
      )}

      {/* NEXT STEP — дестинейшены и предложения */}
      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
        <label style={labelStyle}>Next step</label>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: linked.length > 0 ? '14px' : '0' }}>
          <AttachDestination
            requestId={request.id}
            options={availableDestinations}
            attachedIds={linked.filter((p) => p.kind === 'destination').map((p) => p.id)}
          />
          <form action={createProposalFromRequest.bind(null, request.id)}>
            <button type="submit"
              style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Create proposal
            </button>
          </form>
        </div>

        {linked.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...linked].sort((a, b) => {
              const aDest = a.kind === 'destination' ? 0 : 1
              const bDest = b.kind === 'destination' ? 0 : 1
              return aDest - bDest
            }).map((p, idx, arr) => {
              const prevWasDest = idx > 0 && arr[idx - 1].kind === 'destination'
              const isFirstProposal = p.kind !== 'destination' && prevWasDest
              const isDest = p.kind === 'destination'
              const title = p.trip_title_ru || p.trip_title_en || (isDest ? 'Untitled destination' : 'Untitled proposal')
              const href = isDest ? `/admin/destinations/${p.id}` : `/admin/proposals/${p.id}`
              return (
                <a key={p.id} href={href}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: p.is_selected ? '1px solid var(--admin-success)' : '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-card)', textDecoration: 'none', color: 'inherit', marginTop: isFirstProposal ? '16px' : '0', borderTop: isFirstProposal ? '1px solid var(--admin-border-card)' : undefined, paddingTop: isFirstProposal ? '20px' : '12px' }}>
                  <span style={{ fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border-card)', borderRadius: '4px', padding: '2px 6px', flexShrink: 0 }}>
                    {isDest ? 'Destination' : 'Proposal'}
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--admin-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {title}
                  </span>
                  {p.last_viewed_at && (
                    <span style={{ fontSize: '11px', color: 'var(--admin-success)', flexShrink: 0 }}>● opened</span>
                  )}
                  {isDest ? (
                    p.is_selected ? (
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); unselectDestination(request.id, p.id) }} title="Client changed their mind" style={{ background: 'var(--admin-success)', border: 'none', color: 'var(--admin-dark-panel)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', padding: '3px 9px', flexShrink: 0, fontFamily: 'inherit', fontWeight: 500 }}>✓ Chosen</button>
                    ) : (
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); selectDestination(request.id, p.id) }} title="Client picked this destination" style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-text-muted)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', padding: '3px 9px', flexShrink: 0, fontFamily: 'inherit' }}>Client picked</button>
                    )
                  ) : null}
                  {p.status && !isDest && (
                    <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', flexShrink: 0 }}>{p.status}</span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      if (!confirm('Unlink from this request?')) return
                      detachProposalFromRequest(request.id, p.id)
                    }}
                    title="Unlink"
                    style={{ background: 'transparent', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', fontSize: '15px', lineHeight: 1, padding: '0 2px', flexShrink: 0, fontFamily: 'inherit' }}>
                    ×
                  </button>
                </a>
              )
            })}
          </div>
        )}
      </section>

      {/* ЗАМЕТКИ */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={labelStyle}>Client notes & revisions</label>
          <textarea value={form.client_notes} onChange={(e) => set('client_notes', e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder="What the client asked to change, their reactions, preferences..." />
        </div>
        <div>
          <label style={labelStyle}>Agent notes (internal)</label>
          <textarea value={form.agent_notes} onChange={(e) => set('agent_notes', e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder="Your own notes — not shown to the client" />
        </div>
      </section>

      {/* ФИДБЕК ПОСЛЕ ПОЕЗДКИ — для подтверждённых */}
      {form.status === 'confirmed' && (
        <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
          <label style={labelStyle}>After the trip</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Rating:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => set('trip_rating', form.trip_rating === n ? 0 : n)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '2px', color: n <= form.trip_rating ? 'var(--admin-accent)' : 'var(--admin-text-faint)' }}>
                ★
              </button>
            ))}
            {form.trip_rating > 0 && <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{form.trip_rating}/5</span>}
          </div>
          <textarea value={form.trip_feedback} onChange={(e) => set('trip_feedback', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder="How did the trip go? What did the client say?" />
        </section>
      )}

      {canBook && (
        <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
          <label style={labelStyle}>Booking</label>
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 12px' }}>
            Record what you actually booked — hotels, transfers, partners and pricing.
          </p>
          {bookings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {bookings.map((b) => {
                const totals = (b.booking_services ?? []).reduce((acc, s) => {
                  const cur = s.currency || 'EUR'
                  acc[cur] = (acc[cur] ?? 0) + ((s.gross ?? 0) - (s.net ?? 0))
                  return acc
                }, {} as Record<string, number>)
                const commission = Object.entries(totals)
                  .filter(([, v]) => v !== 0)
                  .map(([cur, v]) => `${v.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${cur}`)
                  .join(' · ')
                const dates = [b.start_date, b.end_date].filter(Boolean).join(' → ')
                const statusColor = b.status === 'confirmed' ? 'var(--admin-success)'
                  : b.status === 'cancelled' ? 'var(--admin-danger)' : 'var(--admin-text-muted)'
                return (
                  <a key={b.id} href={`/admin/bookings/${b.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-card)', textDecoration: 'none', color: 'inherit', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--admin-text)' }}>
                      {b.booking_code || 'Booking'}
                    </span>
                    <span style={{ fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: statusColor, border: `1px solid ${statusColor}`, borderRadius: '4px', padding: '1px 6px' }}>
                      {b.status || 'draft'}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[b.destination, dates].filter(Boolean).join(' · ')}
                    </span>
                    {commission && (
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-success)', flexShrink: 0 }}>
                        {commission}
                      </span>
                    )}
                  </a>
                )
              })}
            </div>
          )}

          <form action={createBookingFromRequest.bind(null, request.id)}>
            <button type="submit"
              style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Create booking
            </button>
          </form>
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