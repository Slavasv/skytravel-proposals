'use client'

import { useState, useRef, useEffect } from 'react'
import {
  addService, updateService, deleteService, duplicateService,
  type BookingService, type PartnerOption,
} from '../actions'
import { getRouteServices, addServiceFromRoute, type RouteServiceCandidate } from '../booking-route-actions'
import PartnerPicker from '@/app/admin/_components/partner-picker'
import { useT } from '@/lib/i18n-client'

const SERVICE_TYPES = [
  'Accomodation',
  'Flight',
  'Transfer',
  'Visa',
  'CIP',
  'Excursion',
  'Event Tickets',
  'Train',
  'Commission from hotel',
  'Other',
]

const CURRENCIES = ['EUR', 'USD', 'AED', 'CHF', 'GBP']

const labelSt: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', fontWeight: 500, display: 'block', marginBottom: '4px',
}
const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: '13px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '4px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function ServiceCard({
  service, partners, onRemove, onDuplicate, onChange,
}: {
  service: BookingService
  partners: PartnerOption[]
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onChange: (id: string, patch: Partial<BookingService>) => void
}) {
  const t = useT()
  const [form, setForm] = useState({
    service_type: service.service_type || 'Accomodation',
    partner_id: service.partner_id || '',
    description: service.description || '',
    gross: service.gross ?? '',
    net: service.net ?? '',
    currency: service.currency || 'EUR',
    confirmation_no: service.confirmation_no || '',
    check_in: service.check_in || '',
    check_out: service.check_out || '',
    alternatives: service.alternatives || '',
    room_type: service.room_type || '',
    meal_plan: service.meal_plan || '',
    nights: service.nights || '',
  })
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const first = useRef(true)

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((p) => ({ ...p, [key]: value }))
    setSaved(false)
  }

  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const grossNum = form.gross === '' ? null : Number(form.gross)
      const netNum = form.net === '' ? null : Number(form.net)
      await updateService(service.id, {
        service_type: form.service_type || null,
        partner_id: form.partner_id || null,
        description: form.description || null,
        gross: grossNum,
        net: netNum,
        currency: form.currency,
        confirmation_no: form.confirmation_no || null,
        check_in: form.check_in || null,
        check_out: form.check_out || null,
        alternatives: form.alternatives || null,
        room_type: form.room_type || null,
        meal_plan: form.meal_plan || null,
        nights: form.nights || null,
      })
      onChange(service.id, { gross: grossNum, net: netNum, currency: form.currency })
      setSaved(true)
    }, 1200)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  const gross = form.gross === '' ? 0 : Number(form.gross)
  const net = form.net === '' ? 0 : Number(form.net)
  const commission = gross - net
  const isHotel = form.service_type === 'Accomodation'


  return (
    <div style={{ border: '1px solid var(--admin-border-card)', borderRadius: '10px', padding: '14px', background: 'var(--admin-card)' }}>
      {/* строка 1: тип, партнёр, описание */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div style={{ width: '170px' }}>
          <label style={labelSt}>{t('Service', 'Услуга')}</label>
          <select value={form.service_type} onChange={(e) => set('service_type', e.target.value)} style={inputSt}>
            {SERVICE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div style={{ width: '200px' }}>
          <label style={labelSt}>{t('Partner', 'Партнёр')}</label>
          <PartnerPicker
            partners={partners}
            value={form.partner_id}
            onChange={(id) => set('partner_id', id)}
            preferType={form.service_type}
            returnTo={`/admin/bookings/${service.booking_id}`}
          />
        </div>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label style={labelSt}>{t('Description', 'Описание')}</label>
          <input type="text" value={form.description} onChange={(e) => set('description', e.target.value)} style={inputSt} placeholder={t('Hotel name, route, details…', 'Название отеля, маршрут, детали…')} />
        </div>
      </div>

      {/* строка 2: деньги */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '10px' }}>
        <div style={{ width: '120px' }}>
          <label style={labelSt}>{t('Gross', 'Брутто')}</label>
          <input type="number" step="0.01" value={form.gross} onChange={(e) => set('gross', e.target.value === '' ? '' : Number(e.target.value))} style={inputSt} placeholder="0" />
        </div>
        <div style={{ width: '120px' }}>
          <label style={labelSt}>{t('Net', 'Нетто')}</label>
          <input type="number" step="0.01" value={form.net} onChange={(e) => set('net', e.target.value === '' ? '' : Number(e.target.value))} style={inputSt} placeholder="0" />
        </div>
        <div style={{ width: '90px' }}>
          <label style={labelSt}>{t('Currency', 'Валюта')}</label>
          <select value={form.currency} onChange={(e) => set('currency', e.target.value)} style={inputSt}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ padding: '8px 12px', border: '1px solid var(--admin-border-card)', borderRadius: '4px', minWidth: '130px' }}>
          <div style={{ ...labelSt, marginBottom: '2px' }}>{t('Commission', 'Комиссия')}</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: commission < 0 ? 'var(--admin-danger)' : commission > 0 ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
            {money(commission)} {form.currency}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label style={labelSt}>{t('Confirmation №', 'Подтверждение №')}</label>
          <input type="text" value={form.confirmation_no} onChange={(e) => set('confirmation_no', e.target.value)} style={inputSt} placeholder="ABC123" />
        </div>
      </div>

      {/* строка 3: даты + номер/питание/ночи для проживания */}
      {isHotel && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <div style={{ width: '150px' }}>
            <label style={labelSt}>{t('Check-in', 'Заезд')}</label>
            <input type="date" value={form.check_in} onChange={(e) => set('check_in', e.target.value)} style={inputSt} />
          </div>
          <div style={{ width: '150px' }}>
            <label style={labelSt}>{t('Check-out', 'Выезд')}</label>
            <input type="date" value={form.check_out} onChange={(e) => set('check_out', e.target.value)} style={inputSt} />
          </div>
          <div style={{ width: '80px' }}>
            <label style={labelSt}>{t('Nights', 'Ночей')}</label>
            <input type="text" value={form.nights} onChange={(e) => set('nights', e.target.value)} style={inputSt} placeholder="—" />
          </div>
          <div style={{ width: '180px' }}>
            <label style={labelSt}>{t('Room type', 'Тип номера')}</label>
            <input type="text" value={form.room_type} onChange={(e) => set('room_type', e.target.value)} style={inputSt} placeholder={t('Superior, King', 'Superior, кинг')} />
          </div>
          <div style={{ width: '150px' }}>
            <label style={labelSt}>{t('Meal plan', 'Питание')}</label>
            <input type="text" value={form.meal_plan} onChange={(e) => set('meal_plan', e.target.value)} style={inputSt} placeholder={t('Half Board', 'Полупансион')} />
          </div>
        </div>
      )}

      {/* альтернативы */}
      <div style={{ marginBottom: '10px' }}>
        <label style={labelSt}>{t('Alternatives checked (optional)', 'Проверенные альтернативы (необязательно)')}</label>
        <input type="text" value={form.alternatives} onChange={(e) => set('alternatives', e.target.value)} style={inputSt} placeholder={t('Go Global 2800, RateHawk 2650 — took RateHawk', 'Go Global 2800, RateHawk 2650 — взяли RateHawk')} />
      </div>

      {/* действия */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: saved ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
          {saved ? t('● Saved', '● Сохранено') : ''}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={() => onDuplicate(service.id)}
            style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-accent)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '5px 9px', fontFamily: 'inherit' }}>
            {t('Duplicate', 'Дублировать')}
          </button>
          <button type="button" onClick={() => onRemove(service.id)}
            style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '5px 9px', fontFamily: 'inherit' }}>
            {t('✕ Remove', '✕ Удалить')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BookingServices({
  bookingId, initial, partners,
}: {
  bookingId: string
  initial: BookingService[]
  partners: PartnerOption[]
}) {
  const t = useT()
  const [services, setServices] = useState<BookingService[]>(initial)
  const [route, setRoute] = useState<RouteServiceCandidate[]>([])
  const [routeOpen, setRouteOpen] = useState(false)
  const [pulling, setPulling] = useState(false)

  // подтягиваем услуги из маршрута предложения (для дропдауна)
  useEffect(() => {
    let cancelled = false
    getRouteServices(bookingId).then((rows) => { if (!cancelled) setRoute(rows) }).catch(() => {})
    return () => { cancelled = true }
  }, [bookingId])

  async function handleAdd() {
    const created = await addService(bookingId)
    if (created) setServices((p) => [...p, created])
  }

  async function handleAddFromRoute(c: RouteServiceCandidate) {
    setRouteOpen(false)
    setPulling(true)
    const created = await addServiceFromRoute(bookingId, c)
    setPulling(false)
    if (created) setServices((p) => [...p, created])
  }

  async function handleRemove(id: string) {
    if (!confirm(t('Remove this service?', 'Удалить эту услугу?'))) return
    setServices((p) => p.filter((s) => s.id !== id))
    await deleteService(id)
  }

  async function handleDuplicate(id: string) {
    const created = await duplicateService(id)
    if (!created) return
    setServices((p) => {
      const idx = p.findIndex((s) => s.id === id)
      if (idx === -1) return [...p, created]
      const next = [...p]
      next.splice(idx + 1, 0, created)
      return next
    })
  }

  // локально обновляем суммы, чтобы итоги пересчитывались сразу
  function handleChange(id: string, patch: Partial<BookingService>) {
    setServices((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  // итоги по валютам
  const totals = services.reduce((acc, s) => {
    const cur = s.currency || 'EUR'
    const gross = s.gross ?? 0
    const net = s.net ?? 0
    if (!acc[cur]) acc[cur] = { gross: 0, net: 0, commission: 0 }
    acc[cur].gross += gross
    acc[cur].net += net
    acc[cur].commission += gross - net
    return acc
  }, {} as Record<string, { gross: number; net: number; commission: number }>)

  const currencies = Object.keys(totals).sort()

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
        {services.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
            {t('No services yet. Add hotels, transfers, visas — everything you booked.',
               'Пока нет услуг. Добавьте отели, трансферы, визы — всё, что забронировали.')}
          </div>
        ) : (
          services.map((s) => (
            <ServiceCard key={s.id} service={s} partners={partners}
              onRemove={handleRemove} onDuplicate={handleDuplicate} onChange={handleChange} />
          ))
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button type="button" onClick={handleAdd}
          style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {t('+ Add service', '+ Добавить услугу')}
        </button>

        {route.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setRouteOpen((v) => !v)} disabled={pulling}
              style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: pulling ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
              {t('+ Add from route ▾', '+ Добавить из маршрута ▾')}
            </button>
            {routeOpen && (
              <>
                <div onClick={() => setRouteOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20, minWidth: '320px', maxWidth: '440px', maxHeight: '320px', overflowY: 'auto', background: 'var(--admin-input)', border: '1px solid var(--admin-border)', borderRadius: '10px', padding: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  {route.map((c) => (
                    <button key={c.key} type="button" onClick={() => handleAddFromRoute(c)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--admin-text)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                      <span style={{ fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--admin-text-muted)' }}>{c.service_type}</span>
                      <span style={{ display: 'block', fontSize: '13px', color: 'var(--admin-text)' }}>
                        {c.description || '—'}
                        {c.gross != null && <span style={{ color: 'var(--admin-text-muted)' }}> · {money(c.gross)} {c.currency}</span>}
                      </span>
                      {(c.room_type || c.meal_plan || c.nights) && (
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--admin-text-faint)' }}>
                          {[c.nights && `${c.nights} ${t('n.', 'ноч.')}`, c.room_type, c.meal_plan].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ИТОГИ */}
      {currencies.length > 0 && (
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--admin-border-card)' }}>
          <div style={{ ...labelSt, marginBottom: '10px' }}>{t('Totals', 'Итого')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {currencies.map((cur) => {
              const row = totals[cur]
              return (
                <div key={cur} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '10px 14px', border: '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-card)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', minWidth: '44px' }}>{cur}</span>
                  <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{t('Gross', 'Брутто')} {money(row.gross)}</span>
                  <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{t('Net', 'Нетто')} {money(row.net)}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, marginLeft: 'auto', color: row.commission < 0 ? 'var(--admin-danger)' : 'var(--admin-success)' }}>
                    {t('Commission', 'Комиссия')} {money(row.commission)}
                  </span>
                </div>
              )
            })}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--admin-text-muted)', margin: '8px 0 0' }}>
            {t('Currencies are kept separate — no conversion.', 'Валюты считаются раздельно — без конвертации.')}
          </p>
        </div>
      )}
    </div>
  )
}