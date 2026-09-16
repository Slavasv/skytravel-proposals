'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useT } from '@/lib/i18n-client'
import DateInput from '@/app/admin/_components/date-input'
import ClientPicker from '@/app/admin/_components/client-picker'
import VoucherActions from './voucher-actions-ui'
import { getClientTravellers, type ClientOption, type TravellerOption } from './voucher-actions'
import {
  normalizeFlightData, blankSegment, blankPassenger,
  type FlightData, type FlightSegment, type FlightPassenger,
} from '@/lib/flight-voucher'

type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

type Voucher = {
  id: string
  slug: string
  issue_date: string | null
  client_id: string | null
  flight_data: unknown
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
const smallLabel: React.CSSProperties = { ...labelStyle, marginBottom: '4px' }

export default function FlightVoucherForm({
  voucher, clients,
}: {
  voucher: Voucher
  clients: ClientOption[]
}) {
  const t = useT()
  const searchParams = useSearchParams()
  const pickedClient = searchParams.get('pickedClient')

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [travellers, setTravellers] = useState<TravellerOption[]>([])
  const [travOpen, setTravOpen] = useState(false)

  const [form, setForm] = useState({
    issue_date: voucher.issue_date || '',
    client_id: voucher.client_id || '',
    flight: normalizeFlightData(voucher.flight_data),
  })

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaveState('editing')
  }
  function setFlight(patch: Partial<FlightData>) {
    set('flight', { ...form.flight, ...patch })
  }

  async function saveNow(current: typeof form) {
    setSaveState('saving')
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/vouchers/${voucher.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue_date: current.issue_date || null,
          client_id: current.client_id || null,
          flight_data: current.flight,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      setSavedAt(new Date())
      setSaveState('saved')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('Save failed', 'Не удалось сохранить'))
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
    if (pickedClient && pickedClient !== form.client_id) set('client_id', pickedClient)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedClient])

  useEffect(() => {
    if (!form.client_id) { setTravellers([]); return }
    let cancelled = false
    getClientTravellers(form.client_id).then((list) => { if (!cancelled) setTravellers(list) })
    return () => { cancelled = true }
  }, [form.client_id])

  // ---- сегменты ----
  function addSegment(dir: 'outbound' | 'return') {
    setFlight({ [dir]: [...form.flight[dir], blankSegment()] } as Partial<FlightData>)
  }
  function changeSegment(dir: 'outbound' | 'return', i: number, patch: Partial<FlightSegment>) {
    setFlight({ [dir]: form.flight[dir].map((s, idx) => (idx === i ? { ...s, ...patch } : s)) } as Partial<FlightData>)
  }
  function removeSegment(dir: 'outbound' | 'return', i: number) {
    setFlight({ [dir]: form.flight[dir].filter((_, idx) => idx !== i) } as Partial<FlightData>)
  }

  // ---- пассажиры ----
  function addPassenger() {
    setFlight({ passengers: [...form.flight.passengers, blankPassenger()] })
  }
  function addPassengerFromTraveller(trav: TravellerOption) {
    setFlight({
      passengers: [...form.flight.passengers, {
        ...blankPassenger(),
        name: [trav.title, trav.name].filter(Boolean).join(' ').trim(),
      }],
    })
    setTravOpen(false)
  }
  function changePassenger(id: string, patch: Partial<FlightPassenger>) {
    setFlight({ passengers: form.flight.passengers.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  }
  function removePassenger(id: string) {
    setFlight({ passengers: form.flight.passengers.filter((p) => p.id !== id) })
  }

  function renderSaveIndicator() {
    if (saveState === 'error') return <span style={{ color: 'var(--admin-danger)' }}>● {t('Error', 'Ошибка')}: {errorMsg}</span>
    if (saveState === 'saving') return <span style={{ color: 'var(--admin-accent)' }}>{t('● Saving...', '● Сохранение...')}</span>
    if (saveState === 'editing') return <span style={{ color: 'var(--admin-text-muted)' }}>{t('● Editing...', '● Редактирование...')}</span>
    if (saveState === 'saved' && savedAt) return <span style={{ color: 'var(--admin-success)' }}>● {t('Saved at', 'Сохранено в')} {savedAt.toLocaleTimeString()}</span>
    return <span style={{ color: 'var(--admin-text-muted)' }}>{t('● All changes saved', '● Все изменения сохранены')}</span>
  }

  function renderSegments(dir: 'outbound' | 'return') {
    const segs = form.flight[dir]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {segs.map((s, i) => (
          <div key={i} style={{ border: '1px solid var(--admin-border-card)', borderRadius: '8px', padding: '10px', background: 'var(--admin-input)' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ width: '110px' }}>
                <label style={smallLabel}>{t('Flight №', 'Рейс №')}</label>
                <input type="text" value={s.flight_no} onChange={(e) => changeSegment(dir, i, { flight_no: e.target.value })} style={inputStyle} placeholder="VY 1678" />
              </div>
              <div style={{ width: '90px' }}>
                <label style={smallLabel}>{t('From', 'Откуда')}</label>
                <input type="text" value={s.from} onChange={(e) => changeSegment(dir, i, { from: e.target.value })} style={inputStyle} placeholder="SCQ" />
              </div>
              <div style={{ width: '90px' }}>
                <label style={smallLabel}>{t('To', 'Куда')}</label>
                <input type="text" value={s.to} onChange={(e) => changeSegment(dir, i, { to: e.target.value })} style={inputStyle} placeholder="BCN" />
              </div>
              <div style={{ width: '80px' }}>
                <label style={smallLabel}>{t('Dep', 'Вылет')}</label>
                <input type="text" value={s.dep} onChange={(e) => changeSegment(dir, i, { dep: e.target.value })} style={inputStyle} placeholder="13:35" />
              </div>
              <div style={{ width: '80px' }}>
                <label style={smallLabel}>{t('Arr', 'Прилёт')}</label>
                <input type="text" value={s.arr} onChange={(e) => changeSegment(dir, i, { arr: e.target.value })} style={inputStyle} placeholder="15:15" />
              </div>
              <div style={{ width: '90px' }}>
                <label style={smallLabel}>{t('Duration', 'В пути')}</label>
                <input type="text" value={s.duration} onChange={(e) => changeSegment(dir, i, { duration: e.target.value })} style={inputStyle} placeholder="1h 40m" />
              </div>
              <button type="button" onClick={() => removeSegment(dir, i)} style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '9px 10px', fontFamily: 'inherit' }}>✕</button>
            </div>
            <div style={{ marginTop: '8px' }}>
              <label style={smallLabel}>{t('Connection / terminal', 'Стыковка / терминал')}</label>
              <input type="text" value={s.note} onChange={(e) => changeSegment(dir, i, { note: e.target.value })} style={inputStyle} placeholder={t('Connection BCN: 3h 55m  ·  Naples T1', 'Стыковка BCN: 3h 55m  ·  Naples T1')} />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => addSegment(dir)} style={{ padding: '8px 14px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start' }}>
          {t('+ Add flight', '+ Добавить рейс')}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '16px', borderBottom: '1px solid var(--admin-border-card)', fontSize: '12px' }}>
        {renderSaveIndicator()}
      </div>

      {/* HEADER */}
      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>{t('Details', 'Детали')}</h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>{t('Client', 'Клиент')}</label>
          <ClientPicker clients={clients} value={form.client_id} onChange={(id) => set('client_id', id)} returnTo={`/admin/vouchers/${voucher.id}`} />
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ width: '140px' }}>
            <label style={labelStyle}>{t('Booking code', 'Код брони')}</label>
            <input type="text" value={form.flight.pnr} onChange={(e) => setFlight({ pnr: e.target.value })} style={inputStyle} placeholder="FE6CQL" />
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={labelStyle}>{t('Airline', 'Авиакомпания')}</label>
            <input type="text" value={form.flight.airline} onChange={(e) => setFlight({ airline: e.target.value })} style={inputStyle} placeholder="Vueling" />
          </div>
          <div style={{ width: '160px' }}>
            <label style={labelStyle}>{t('Issue date', 'Дата выпуска')}</label>
            <DateInput value={form.issue_date} onChange={(v) => set('issue_date', v)} />
          </div>
        </div>
      </section>

      {/* OUTBOUND */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 12px', color: 'var(--admin-text)' }}>✈ {t('Outbound flight', 'Рейс туда')}</h2>
        <div style={{ marginBottom: '12px', maxWidth: '260px' }}>
          <label style={smallLabel}>{t('Date label', 'Подпись даты')}</label>
          <input type="text" value={form.flight.outbound_label} onChange={(e) => setFlight({ outbound_label: e.target.value })} style={inputStyle} placeholder={t('Sun 5 April', 'Sun 5 April')} />
        </div>
        {renderSegments('outbound')}
      </section>

      {/* RETURN */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>✈ {t('Return flight', 'Рейс обратно')}</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 12px' }}>
          {t('Leave empty for a one-way ticket — the block will be hidden on the voucher.',
            'Оставьте пустым для перелёта в одну сторону — блок не покажется в ваучере.')}
        </p>
        <div style={{ marginBottom: '12px', maxWidth: '260px' }}>
          <label style={smallLabel}>{t('Date label', 'Подпись даты')}</label>
          <input type="text" value={form.flight.return_label} onChange={(e) => setFlight({ return_label: e.target.value })} style={inputStyle} placeholder={t('Mon 13 April', 'Mon 13 April')} />
        </div>
        {renderSegments('return')}
      </section>

      {/* PASSENGERS */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>{t('Passengers, baggage & seats', 'Пассажиры, багаж и места')}</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 14px' }}>
          {t('Seats: list per direction, e.g. 7A / 5A for a two-leg flight.',
            'Места: через дробь по направлению, напр. 7A / 5A для перелёта с пересадкой.')}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {form.flight.passengers.map((p) => (
            <div key={p.id} style={{ border: '1px solid var(--admin-border-card)', borderRadius: '8px', padding: '10px', background: 'var(--admin-input)' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={smallLabel}>{t('Passenger', 'Пассажир')}</label>
                  <input type="text" value={p.name} onChange={(e) => changePassenger(p.id, { name: e.target.value })} style={inputStyle} placeholder="Anton Kuzmenko" />
                </div>
                <button type="button" onClick={() => removePassenger(p.id)} style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '9px 10px', fontFamily: 'inherit' }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={smallLabel}>{t('Cabin bag', 'Ручная кладь')}</label>
                  <input type="text" value={p.cabin} onChange={(e) => changePassenger(p.id, { cabin: e.target.value })} style={inputStyle} placeholder="1 underseat bag" />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={smallLabel}>{t('Checked bag', 'Багаж')}</label>
                  <input type="text" value={p.checked} onChange={(e) => changePassenger(p.id, { checked: e.target.value })} style={inputStyle} placeholder="1 × 25 kg (in hold)" />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={smallLabel}>{t('Extras', 'Доп.')}</label>
                  <input type="text" value={p.extras} onChange={(e) => changePassenger(p.id, { extras: e.target.value })} style={inputStyle} placeholder="1 windsurfing equipment" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={smallLabel}>{t('Seats — outbound', 'Места — туда')}</label>
                  <input type="text" value={p.seats_out} onChange={(e) => changePassenger(p.id, { seats_out: e.target.value })} style={inputStyle} placeholder="7A / 5A" />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <label style={smallLabel}>{t('Seats — return', 'Места — обратно')}</label>
                  <input type="text" value={p.seats_ret} onChange={(e) => changePassenger(p.id, { seats_ret: e.target.value })} style={inputStyle} placeholder="5F / 9A" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap', position: 'relative' }}>
          <button type="button" onClick={addPassenger} style={{ padding: '8px 14px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('+ Add passenger', '+ Добавить пассажира')}
          </button>

          {form.client_id && travellers.length > 0 && (
            <>
              <button type="button" onClick={() => setTravOpen((v) => !v)} style={{ padding: '8px 14px', fontSize: '13px', color: 'var(--admin-text)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('⤓ Add from client', '⤓ Добавить из клиента')} ({travellers.length})
              </button>
              {travOpen && (
                <>
                  <div onClick={() => setTravOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '6px', background: 'var(--admin-input)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '6px', minWidth: '280px', maxHeight: '320px', overflowY: 'auto', zIndex: 2, boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>
                    {travellers.map((trav) => {
                      const label = [trav.title, trav.name].filter(Boolean).join(' ').trim()
                      const already = form.flight.passengers.some((p) => p.name.trim().toLowerCase() === label.toLowerCase())
                      return (
                        <button key={trav.id} type="button" onClick={() => addPassengerFromTraveller(trav)} disabled={already}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', background: 'transparent', border: 'none', fontSize: '13px', borderRadius: '4px', cursor: already ? 'default' : 'pointer', fontFamily: 'inherit', color: already ? 'var(--admin-text-faint)' : 'var(--admin-text)' }}
                          onMouseEnter={(e) => { if (!already) e.currentTarget.style.background = 'var(--admin-card)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                          {label || t('Unnamed', 'Без имени')}{already && <span style={{ fontSize: '11px', marginLeft: '6px' }}>· {t('added', 'добавлен')}</span>}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>

      {/* FOOTER NOTE */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <label style={labelStyle}>{t('Footer note (optional)', 'Примечание в футере (необязательно)')}</label>
        <input type="text" value={form.flight.footer_note} onChange={(e) => setFlight({ footer_note: e.target.value })} style={inputStyle} placeholder={t('Please keep this document and present it if required.', 'Please keep this document and present it if required.')} />
      </section>

      {/* SHARE + PDF */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <VoucherActions voucherId={voucher.id} initialSlug={voucher.slug} />
      </section>
    </div>
  )
}
