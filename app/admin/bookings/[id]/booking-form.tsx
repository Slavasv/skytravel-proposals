'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { updateBooking, createAccommodationVoucher, type BookingService, type PartnerOption, type BookingClientOption, type BookingTraveller, type BookingVoucher } from '../actions'
import BookingServices from './booking-services'
import BookingInvoices from './booking-invoices'
import BookingTravellers from './booking-travellers'
import type { SupplierInvoice } from '../invoice-actions'
import ClientPicker from '@/app/admin/_components/client-picker'

type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

type Booking = {
  id: string
  booking_code: string | null
  client_id: string | null
  request_id: string | null
  start_date: string | null
  end_date: string | null
  destination: string | null
  status: string | null
  notes: string | null
  created_at: string
}

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
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

export default function BookingForm({
  booking, services, invoices, partners, clients, travellers, vouchers = [],
}: {
  booking: Booking
  services: BookingService[]
  invoices: SupplierInvoice[]
  partners: PartnerOption[]
  clients: BookingClientOption[]
  travellers: { all: BookingTraveller[]; selected: string[]; requestId: string | null }
  vouchers?: BookingVoucher[]
}) {
  const router = useRouter()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    client_id: booking.client_id || '',
    start_date: booking.start_date || '',
    end_date: booking.end_date || '',
    destination: booking.destination || '',
    status: booking.status || 'draft',
    notes: booking.notes || '',
  })

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const first = useRef(true)

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((p) => ({ ...p, [key]: value }))
    setSaveState('editing')
  }

  async function saveNow(current: typeof form) {
    setSaveState('saving'); setErrorMsg(null)
    try {
      await updateBooking(booking.id, {
        client_id: current.client_id || null,
        start_date: current.start_date || null,
        end_date: current.end_date || null,
        destination: current.destination || null,
        status: current.status,
        notes: current.notes || null,
      })
      setSavedAt(new Date()); setSaveState('saved')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save failed')
      setSaveState('error')
    }
  }

  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => saveNow(form), 1500)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  function renderSave() {
    if (saveState === 'error') return <span style={{ color: 'var(--admin-danger)' }}>● Error: {errorMsg}</span>
    if (saveState === 'saving') return <span style={{ color: 'var(--admin-accent)' }}>● Saving...</span>
    if (saveState === 'editing') return <span style={{ color: 'var(--admin-text-muted)' }}>● Editing...</span>
    if (saveState === 'saved' && savedAt) return <span style={{ color: 'var(--admin-success)' }}>● Saved at {savedAt.toLocaleTimeString()}</span>
    return <span style={{ color: 'var(--admin-text-muted)' }}>● All changes saved</span>
  }

  async function handleDone() {
    if (timer.current) clearTimeout(timer.current)
    if (saveState === 'editing' || saveState === 'error') await saveNow(form)
    // пришли из запроса — возвращаемся туда
    router.push(booking.request_id ? `/admin/requests/${booking.request_id}` : '/admin/bookings')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--admin-border-card)', fontSize: '12px' }}>
        <span style={{ color: 'var(--admin-text-muted)' }}>
          Created {new Date(booking.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          {booking.request_id && (
            <>
              {' · '}
              <a href={`/admin/requests/${booking.request_id}`} style={{ color: 'var(--admin-accent)', textDecoration: 'none' }}>
                from request
              </a>
            </>
          )}
        </span>
        {renderSave()}
      </div>

      {/* ШАПКА */}
      <section>
        <label style={labelStyle}>Client</label>
        <ClientPicker
          clients={clients}
          value={form.client_id}
          onChange={(id) => set('client_id', id)}
          returnTo={`/admin/bookings/${booking.id}`}
        />
      </section>

      <section style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ width: '160px' }}>
          <label style={labelStyle}>Start date</label>
          <input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} style={inputStyle} />
        </div>
        <div style={{ width: '160px' }}>
          <label style={labelStyle}>End date</label>
          <input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label style={labelStyle}>Destination</label>
          <input type="text" value={form.destination} onChange={(e) => set('destination', e.target.value)} style={inputStyle} placeholder="Frankfurt, Maldives…" />
        </div>
        <div style={{ width: '160px' }}>
          <label style={labelStyle}>Status</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} style={inputStyle}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </section>

      {/* КТО ЕДЕТ */}
      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>Travellers</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
          Who&apos;s actually going. Someone can drop out or join at the last minute.
        </p>
        <BookingTravellers
          bookingId={booking.id}
          requestId={travellers.requestId}
          all={travellers.all}
          initialSelected={travellers.selected}
        />
      </section>

      {/* УСЛУГИ */}
      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>Services</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
          Everything booked for this trip. Commission is calculated as Gross − Net.
        </p>
        <BookingServices bookingId={booking.id} initial={services} partners={partners} />
      </section>

      {/* ИНВОЙСЫ ПОСТАВЩИКОВ */}
      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>Supplier invoices</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
          Bills received from hotels and partners for this booking. The accountant records payments against them.
        </p>
        <BookingInvoices bookingId={booking.id} initial={invoices} partners={partners} />
      </section>

      {/* ВАУЧЕРЫ */}
      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>Vouchers</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 14px' }}>
          Guests and hotels are pulled from this booking, including confirmation numbers.
        </p>

        {vouchers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {vouchers.map((v) => (
              <a key={v.id} href={`/admin/vouchers/${v.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-card)', textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border-card)', borderRadius: '4px', padding: '2px 6px', flexShrink: 0 }}>
                  {v.voucher_type === 'flight' ? 'Flight' : 'Accommodation'}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--admin-text)', flex: 1 }}>
                  {v.issue_date || 'No date'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>open →</span>
              </a>
            ))}
          </div>
        )}

        <form action={createAccommodationVoucher.bind(null, booking.id)}>
          <button type="submit"
            style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
            + Accommodation voucher
          </button>
        </form>
      </section>

      {/* ЗАМЕТКИ */}
      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
        <label style={labelStyle}>Notes</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder="Internal notes about this booking…" />
      </section>

      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={handleDone} disabled={saveState === 'saving'}
          style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 500, letterSpacing: '0.03em', background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '8px', cursor: saveState === 'saving' ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: saveState === 'saving' ? 0.6 : 1 }}>
          {saveState === 'saving' ? 'Saving…' : (booking.request_id ? 'Done & back to request' : 'Done')}
        </button>
      </section>
    </div>
  )
}