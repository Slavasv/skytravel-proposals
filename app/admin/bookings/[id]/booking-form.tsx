'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { goBackOrTo } from '@/lib/nav-back'
import { checkBookingCodeExists, createAccommodationVoucher, type BookingService, type PartnerOption, type BookingClientOption, type BookingTraveller, type BookingVoucher } from '../actions'
import BookingServices from './booking-services'
import BookingInvoices from './booking-invoices'
import BookingTravellers from './booking-travellers'
import type { SupplierInvoice } from '../invoice-actions'
import ClientPicker from '@/app/admin/_components/client-picker'
import { useT } from '@/lib/i18n-client'

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

function statusLabel(value: string, t: (en: string, ru: string) => string): string {
  switch (value) {
    case 'confirmed': return t('Confirmed', 'Подтверждено')
    case 'cancelled': return t('Cancelled', 'Отменено')
    default: return t('Draft', 'Черновик')
  }
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
  const t = useT()
  const router = useRouter()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [dupWarn, setDupWarn] = useState(false)

  const [form, setForm] = useState({
    booking_code: booking.booking_code || '',
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
      const res = await fetch(`/api/bookings/${booking.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_code: current.booking_code.trim() || null,
          client_id: current.client_id || null,
          start_date: current.start_date || null,
          end_date: current.end_date || null,
          destination: current.destination || null,
          status: current.status,
          notes: current.notes || null,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      setSavedAt(new Date()); setSaveState('saved')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('Save failed', 'Не удалось сохранить'))
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

  // предупреждение о дубле номера брони
  useEffect(() => {
    const code = form.booking_code.trim()
    if (!code) { setDupWarn(false); return }
    const h = setTimeout(async () => {
      try { setDupWarn(await checkBookingCodeExists(booking.id, code)) } catch { /* игнор */ }
    }, 600)
    return () => clearTimeout(h)
  }, [form.booking_code, booking.id])

  function renderSave() {
    if (saveState === 'error') return <span style={{ color: 'var(--admin-danger)' }}>● {t('Error', 'Ошибка')}: {errorMsg}</span>
    if (saveState === 'saving') return <span style={{ color: 'var(--admin-accent)' }}>● {t('Saving...', 'Сохранение...')}</span>
    if (saveState === 'editing') return <span style={{ color: 'var(--admin-text-muted)' }}>● {t('Editing...', 'Редактирование...')}</span>
    if (saveState === 'saved' && savedAt) return <span style={{ color: 'var(--admin-success)' }}>● {t('Saved at', 'Сохранено в')} {savedAt.toLocaleTimeString()}</span>
    return <span style={{ color: 'var(--admin-text-muted)' }}>● {t('All changes saved', 'Все изменения сохранены')}</span>
  }

  async function handleDone() {
    if (timer.current) clearTimeout(timer.current)
    if (saveState === 'editing' || saveState === 'error') await saveNow(form)
    // пришли из запроса — возвращаемся туда
    goBackOrTo(router, booking.request_id ? `/admin/requests/${booking.request_id}` : '/admin/bookings')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--admin-border-card)', fontSize: '12px' }}>
        <span style={{ color: 'var(--admin-text-muted)' }}>
          {t('Created', 'Создано')} {new Date(booking.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          {booking.request_id && (
            <>
              {' · '}
              <a href={`/admin/requests/${booking.request_id}`} style={{ color: 'var(--admin-accent)', textDecoration: 'none' }}>
                {t('from request', 'из запроса')}
              </a>
            </>
          )}
        </span>
        {renderSave()}
      </div>

      {/* ШАПКА */}
      <section>
        <label style={labelStyle}>{t('Booking No.', 'Номер брони')}</label>
        <input type="text" value={form.booking_code} onChange={(e) => set('booking_code', e.target.value)}
          style={{ ...inputStyle, maxWidth: '260px' }} placeholder={t('e.g. BK-1042', 'напр. BK-1042')} />
        {dupWarn && (
          <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--admin-danger)' }}>
            {t('⚠ A booking with this number already exists', '⚠ Бронь с таким номером уже существует')}
          </div>
        )}
      </section>

      <section>
        <label style={labelStyle}>{t('Client', 'Клиент')}</label>
        <ClientPicker
          clients={clients}
          value={form.client_id}
          onChange={(id) => set('client_id', id)}
          returnTo={`/admin/bookings/${booking.id}`}
        />
      </section>

      <section style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ width: '160px' }}>
          <label style={labelStyle}>{t('Start date', 'Дата начала')}</label>
          <input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} style={inputStyle} />
        </div>
        <div style={{ width: '160px' }}>
          <label style={labelStyle}>{t('End date', 'Дата окончания')}</label>
          <input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label style={labelStyle}>{t('Destination', 'Направление')}</label>
          <input type="text" value={form.destination} onChange={(e) => set('destination', e.target.value)} style={inputStyle} placeholder={t('Frankfurt, Maldives…', 'Франкфурт, Мальдивы…')} />
        </div>
        <div style={{ width: '160px' }}>
          <label style={labelStyle}>{t('Status', 'Статус')}</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} style={inputStyle}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{statusLabel(s.value, t)}</option>)}
          </select>
        </div>
      </section>

      {/* КТО ЕДЕТ */}
      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>{t('Travellers', 'Путешественники')}</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
          {t('Who’s actually going. Someone can drop out or join at the last minute.',
            'Кто действительно едет. Кто-то может отказаться или присоединиться в последний момент.')}
        </p>
        <BookingTravellers
          bookingId={booking.id}
          requestId={travellers.requestId}
          all={travellers.all}
          initialSelected={travellers.selected}
          tripStart={form.start_date}
          tripEnd={form.end_date}
        />
      </section>

      {/* УСЛУГИ */}
      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>{t('Services', 'Услуги')}</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
          {t('Everything booked for this trip. Commission is calculated as Gross − Net.',
            'Всё, что забронировано для этой поездки. Комиссия рассчитывается как Брутто − Нетто.')}
        </p>
        <BookingServices bookingId={booking.id} initial={services} partners={partners} travellers={travellers.all.filter((tr) => travellers.selected.includes(tr.id))} />
      </section>

      {/* ИНВОЙСЫ ПОСТАВЩИКОВ */}
      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>{t('Supplier invoices', 'Счета поставщиков')}</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
          {t('Bills received from hotels and partners for this booking. The accountant records payments against them.',
            'Счета, полученные от отелей и партнёров по этому бронированию. Бухгалтер отмечает по ним платежи.')}
        </p>
        <BookingInvoices bookingId={booking.id} initial={invoices} partners={partners} />
      </section>

      {/* ВАУЧЕРЫ */}
      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>{t('Vouchers', 'Ваучеры')}</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 14px' }}>
          {t('Guests and hotels are pulled from this booking, including confirmation numbers.',
            'Гости и отели берутся из этого бронирования, включая номера подтверждений.')}
        </p>

        {vouchers.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {vouchers.map((v) => (
              <a key={v.id} href={`/admin/vouchers/${v.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-card)', textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border-card)', borderRadius: '4px', padding: '2px 6px', flexShrink: 0 }}>
                  {v.voucher_type === 'flight' ? t('Flight', 'Авиаперелёт') : t('Accommodation', 'Проживание')}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--admin-text)', flex: 1 }}>
                  {v.issue_date || t('No date', 'Без даты')}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>{t('open →', 'открыть →')}</span>
              </a>
            ))}
          </div>
        )}

        <form action={createAccommodationVoucher.bind(null, booking.id)}>
          <button type="submit"
            style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('+ Accommodation voucher', '+ Ваучер на проживание')}
          </button>
        </form>
      </section>

      {/* ЗАМЕТКИ */}
      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
        <label style={labelStyle}>{t('Notes', 'Заметки')}</label>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder={t('Internal notes about this booking…', 'Внутренние заметки по этому бронированию…')} />
      </section>

      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={handleDone} disabled={saveState === 'saving'}
          style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 500, letterSpacing: '0.03em', background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '8px', cursor: saveState === 'saving' ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: saveState === 'saving' ? 0.6 : 1 }}>
          {saveState === 'saving' ? t('Saving…', 'Сохранение…') : (booking.request_id ? t('Done & back to request', 'Готово и назад к запросу') : t('Done', 'Готово'))}
        </button>
      </section>
    </div>
  )
}