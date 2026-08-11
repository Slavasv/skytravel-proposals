'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  addService, updateService, deleteService, duplicateService,
  type BookingService, type PartnerOption, type BookingTraveller,
  type TransferDetails, type TransferLeg,
} from '../actions'
import { getRouteServices, addServiceFromRoute, getLibraryHotels, setServiceSourceBlock, createLibraryHotel, getLibraryVehicles, createLibraryVehicle, getRoutePoints, type RouteServiceCandidate, type LibraryHotel, type LibraryVehicle } from '../booking-route-actions'
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

const CURRENCIES = ['EUR', 'USD', 'AED', 'CHF', 'GBP', 'UAH']

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

const emptyLeg = (): TransferLeg => ({ date: '', time: '', from: '', to: '' })
const defaultTransfer = (): TransferDetails => ({
  type: 'one_way', vehicle: '', vehicle_block_id: null,
  legs: [emptyLeg()], rental_hours: '', pickup: '', end_other: false, dropoff: '', comments: '',
})

const TRANSFER_TYPES: { value: TransferDetails['type']; label_en: string; label_ru: string }[] = [
  { value: 'one_way', label_en: 'One Way', label_ru: 'В одну сторону' },
  { value: 'round_trip', label_en: 'Round Trip', label_ru: 'Туда-обратно' },
  { value: 'hourly', label_en: 'Hourly', label_ru: 'Почасовой' },
]

function ServiceCard({
  service, partners, travellers, library, vehicles, routePoints, onRemove, onDuplicate, onChange,
}: {
  service: BookingService
  partners: PartnerOption[]
  travellers: BookingTraveller[]
  library: LibraryHotel[]
  vehicles: LibraryVehicle[]
  routePoints: string[]
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onChange: (id: string, patch: Partial<BookingService>) => void
}) {
  const t = useT()
  const router = useRouter()
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
    guest_ids: (service.guest_ids || []) as string[],
  })
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const first = useRef(true)

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((p) => ({ ...p, [key]: value }))
    setSaved(false)
  }

  const [creatingHotel, setCreatingHotel] = useState(false)
  const [newHotelName, setNewHotelName] = useState('')

  function applyHotel(blockId: string) {
    const h = library.find((x) => x.block_id === blockId)
    if (!h) return
    set('description', h.title)
    if (h.rooms.length === 1) set('room_type', h.rooms[0].title)
    setServiceSourceBlock(service.id, blockId).catch(() => { })
  }
  async function createHotel() {
    const created = await createLibraryHotel(newHotelName)
    if (!created) return
    set('description', created.title)
    // сразу сохраняем название и привязку, потом перекидываем в библиотеку — там агент заполнит всё
    await updateService(service.id, { description: created.title })
    await setServiceSourceBlock(service.id, created.block_id)
    setCreatingHotel(false); setNewHotelName('')
    router.push(`/admin/library/${created.block_id}?returnTo=${encodeURIComponent(`/admin/bookings/${service.booking_id}`)}`)
  }

  // ---- Трансфер ----
  const [td, setTd] = useState<TransferDetails>(() => service.transfer_details ?? defaultTransfer())
  const [creatingVehicle, setCreatingVehicle] = useState(false)
  const [newVehicleName, setNewVehicleName] = useState('')

  function patchTd(patch: Partial<TransferDetails>) {
    setTd((p) => ({ ...p, ...patch }))
    setSaved(false)
  }
  function patchLeg(i: number, patch: Partial<TransferLeg>) {
    setTd((p) => ({ ...p, legs: p.legs.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }))
    setSaved(false)
  }
  function setTransferType(type: TransferDetails['type']) {
    setTd((p) => {
      if (type === 'round_trip') {
        const first = p.legs[0] ?? emptyLeg()
        // 2-е плечо по умолчанию зеркалит первое: пункт-2 → пункт-1
        const second = p.legs[1] ?? { date: '', time: '', from: first.to, to: first.from }
        return { ...p, type, legs: [first, second] }
      }
      if (type === 'one_way') return { ...p, type, legs: [p.legs[0] ?? emptyLeg()] }
      return { ...p, type }
    })
    setSaved(false)
  }
  function applyVehicle(blockId: string) {
    const v = vehicles.find((x) => x.block_id === blockId)
    if (!v) return
    patchTd({ vehicle: v.title, vehicle_block_id: v.block_id })
  }
  async function createVehicle() {
    const created = await createLibraryVehicle(newVehicleName)
    if (!created) return
    const nextTd = { ...td, vehicle: created.title, vehicle_block_id: created.block_id }
    setTd(nextTd)
    // сохраняем привязку до редиректа, иначе она потеряется; потом уходим в редактор блока
    await updateService(service.id, { service_type: 'Transfer', transfer_details: nextTd })
    setCreatingVehicle(false); setNewVehicleName('')
    router.push(`/admin/library/${created.block_id}?returnTo=${encodeURIComponent(`/admin/bookings/${service.booking_id}`)}`)
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
        guest_ids: form.guest_ids,
        transfer_details: form.service_type === 'Transfer' ? td : null,
      })
      onChange(service.id, { gross: grossNum, net: netNum, currency: form.currency })
      setSaved(true)
    }, 1200)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, td])

  const gross = form.gross === '' ? 0 : Number(form.gross)
  const net = form.net === '' ? 0 : Number(form.net)
  const commission = gross - net
  const isHotel = form.service_type === 'Accomodation'
  const isTransfer = form.service_type === 'Transfer'


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
          {isHotel && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <select value="" onChange={(e) => { const v = e.target.value; if (v === '__new__') setCreatingHotel(true); else if (v) applyHotel(v) }} style={{ ...inputSt, maxWidth: '240px' }}>
                <option value="">{t('Pick hotel from library…', 'Выбрать отель из библиотеки…')}</option>
                {library.map((h) => <option key={h.block_id} value={h.block_id}>{h.title}{h.city ? ` · ${h.city}` : ''}</option>)}
                <option value="__new__">{t('+ Create new hotel', '+ Создать новый отель')}</option>
              </select>
              {creatingHotel && (
                <>
                  <input type="text" value={newHotelName} autoFocus onChange={(e) => setNewHotelName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') createHotel() }}
                    placeholder={t('Hotel name', 'Название отеля')} style={{ ...inputSt, width: '170px' }} />
                  <button type="button" onClick={createHotel}
                    style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t('Create', 'Создать')}
                  </button>
                </>
              )}
            </div>
          )}
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

      {/* ТРАНСФЕР: тип, транспорт, плечи / почасовой, комментарий */}
      {isTransfer && (
        <div style={{ marginBottom: '10px', padding: '12px', border: '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-input)' }}>
          <datalist id={`rp-${service.id}`}>
            {routePoints.map((p) => <option key={p} value={p} />)}
          </datalist>

          {/* тип + транспорт */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '10px' }}>
            <div>
              <label style={labelSt}>{t('Type of transfer', 'Тип трансфера')}</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {TRANSFER_TYPES.map((tt) => {
                  const on = td.type === tt.value
                  return (
                    <button key={tt.value} type="button" onClick={() => setTransferType(tt.value)}
                      style={{
                        fontSize: '12px', padding: '7px 12px', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit',
                        border: `1px solid ${on ? 'var(--admin-accent)' : 'var(--admin-border-card)'}`,
                        background: on ? 'var(--admin-accent)' : 'transparent', color: on ? '#fff' : 'var(--admin-text)',
                      }}>
                      {t(tt.label_en, tt.label_ru)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={labelSt}>{t('Mode of transport', 'Транспорт')}</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <select value="" onChange={(e) => { const v = e.target.value; if (v === '__new__') setCreatingVehicle(true); else if (v) applyVehicle(v) }} style={{ ...inputSt, maxWidth: '220px' }}>
                  <option value="">{td.vehicle || t('Pick vehicle from library…', 'Выбрать транспорт…')}</option>
                  {vehicles.map((v) => <option key={v.block_id} value={v.block_id}>{v.title}</option>)}
                  <option value="__new__">{t('+ Create new vehicle', '+ Создать транспорт')}</option>
                </select>
                {creatingVehicle && (
                  <>
                    <input type="text" value={newVehicleName} autoFocus onChange={(e) => setNewVehicleName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') createVehicle() }}
                      placeholder={t('Mercedes V-Class, Seaplane…', 'Mercedes V-Class, гидроплан…')} style={{ ...inputSt, width: '180px' }} />
                    <button type="button" onClick={createVehicle}
                      style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {t('Create', 'Создать')}
                    </button>
                  </>
                )}
              </div>
              {td.vehicle && !creatingVehicle && (
                <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '4px' }}>{td.vehicle}</div>
              )}
            </div>
          </div>

          {/* плечи для one_way / round_trip */}
          {td.type !== 'hourly' && td.legs.map((leg, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'flex-end' }}>
              {td.type === 'round_trip' && (
                <div style={{ ...labelSt, width: '100%', marginBottom: 0 }}>{i === 0 ? t('Outbound', 'Туда') : t('Return', 'Обратно')}</div>
              )}
              <div style={{ width: '150px' }}>
                <label style={labelSt}>{t('Date', 'Дата')}</label>
                <input type="date" value={leg.date} onChange={(e) => patchLeg(i, { date: e.target.value })} style={inputSt} />
              </div>
              <div style={{ width: '110px' }}>
                <label style={labelSt}>{t('Time', 'Время')}</label>
                <input type="time" value={leg.time} onChange={(e) => patchLeg(i, { time: e.target.value })} style={inputSt} />
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={labelSt}>{t('From', 'Откуда')}</label>
                <input type="text" list={`rp-${service.id}`} value={leg.from} onChange={(e) => patchLeg(i, { from: e.target.value })} style={inputSt} placeholder={t('Airport, hotel…', 'Аэропорт, отель…')} />
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={labelSt}>{t('To', 'Куда')}</label>
                <input type="text" list={`rp-${service.id}`} value={leg.to} onChange={(e) => patchLeg(i, { to: e.target.value })} style={inputSt} placeholder={t('Airport, hotel…', 'Аэропорт, отель…')} />
              </div>
            </div>
          ))}

          {/* почасовой */}
          {td.type === 'hourly' && (
            <>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'flex-end' }}>
                <div style={{ width: '150px' }}>
                  <label style={labelSt}>{t('Rental hours', 'Часов аренды')}</label>
                  <input type="text" value={td.rental_hours} onChange={(e) => patchTd({ rental_hours: e.target.value })} style={inputSt} placeholder="8" />
                </div>
                <div style={{ width: '150px' }}>
                  <label style={labelSt}>{t('Date', 'Дата')}</label>
                  <input type="date" value={td.legs[0]?.date ?? ''} onChange={(e) => patchLeg(0, { date: e.target.value })} style={inputSt} />
                </div>
                <div style={{ width: '110px' }}>
                  <label style={labelSt}>{t('Start time', 'Начало')}</label>
                  <input type="time" value={td.legs[0]?.time ?? ''} onChange={(e) => patchLeg(0, { time: e.target.value })} style={inputSt} />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={labelSt}>{t('Pick-up location', 'Точка подачи')}</label>
                  <input type="text" list={`rp-${service.id}`} value={td.pickup} onChange={(e) => patchTd({ pickup: e.target.value })} style={inputSt} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--admin-text)', marginBottom: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={td.end_other} onChange={(e) => patchTd({ end_other: e.target.checked })} />
                {t('End at another location', 'Закончить в другом месте')}
              </label>
              {td.end_other && (
                <div style={{ marginBottom: '8px' }}>
                  <label style={labelSt}>{t('Drop-off location', 'Точка высадки')}</label>
                  <input type="text" list={`rp-${service.id}`} value={td.dropoff} onChange={(e) => patchTd({ dropoff: e.target.value })} style={inputSt} />
                </div>
              )}
            </>
          )}

          <div>
            <label style={labelSt}>{t('Comments', 'Комментарий')}</label>
            <input type="text" value={td.comments} onChange={(e) => patchTd({ comments: e.target.value })} style={inputSt} placeholder={t('Flight no., meet & greet, luggage…', 'Номер рейса, встреча с табличкой, багаж…')} />
          </div>
        </div>
      )}

      {/* гости в номере — если путешественников несколько и они по разным номерам */}
      {isHotel && travellers.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <label style={labelSt}>{t('Guests in this room', 'Гости в этом номере')}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {travellers.map((g) => {
              const on = form.guest_ids.includes(g.id)
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() =>
                    set('guest_ids', on ? form.guest_ids.filter((x) => x !== g.id) : [...form.guest_ids, g.id])
                  }
                  style={{
                    fontSize: '12px', padding: '5px 10px', borderRadius: '999px', cursor: 'pointer',
                    fontFamily: 'inherit',
                    border: `1px solid ${on ? 'var(--admin-accent)' : 'var(--admin-border-card)'}`,
                    background: on ? 'var(--admin-accent)' : 'transparent',
                    color: on ? '#fff' : 'var(--admin-text)',
                  }}
                >
                  {[g.title, g.name].filter(Boolean).join(' ') || t('Guest', 'Гость')}
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>
            {t('Leave empty if the whole party shares one booking.', 'Оставьте пустым, если все едут по одной брони.')}
          </p>
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
            {isHotel ? t('+ Add room', '+ Добавить номер') : t('Duplicate', 'Дублировать')}
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
  bookingId, initial, partners, travellers = [],
}: {
  bookingId: string
  initial: BookingService[]
  partners: PartnerOption[]
  travellers?: BookingTraveller[]
}) {
  const t = useT()
  const [services, setServices] = useState<BookingService[]>(initial)
  const [route, setRoute] = useState<RouteServiceCandidate[]>([])
  const [routeOpen, setRouteOpen] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [library, setLibrary] = useState<LibraryHotel[]>([])
  const [vehicles, setVehicles] = useState<LibraryVehicle[]>([])
  const [routePoints, setRoutePoints] = useState<string[]>([])

  // подтягиваем услуги из маршрута предложения, отели/транспорт из библиотеки и точки маршрута (для дропдаунов)
  useEffect(() => {
    let cancelled = false
    getRouteServices(bookingId).then((rows) => { if (!cancelled) setRoute(rows) }).catch(() => { })
    getLibraryHotels().then((rows) => { if (!cancelled) setLibrary(rows) }).catch(() => { })
    getLibraryVehicles().then((rows) => { if (!cancelled) setVehicles(rows) }).catch(() => { })
    getRoutePoints(bookingId).then((rows) => { if (!cancelled) setRoutePoints(rows) }).catch(() => { })
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
            <ServiceCard key={s.id} service={s} partners={partners} travellers={travellers} library={library}
              vehicles={vehicles} routePoints={routePoints}
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