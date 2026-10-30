'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useT } from '@/lib/i18n-client'
import { getFlights, addFlight, updateFlight, deleteFlight, type FlightSegment, type FlightKind, type FlightClass } from './flight-actions'
import type { Lang } from './edit-page-client'

const CURRENCIES = ['EUR', 'USD', 'AED', 'CHF', 'GBP', 'UAH']
const KINDS: { v: FlightKind; en: string; ru: string }[] = [
  { v: 'outbound', en: 'Outbound', ru: 'Туда' },
  { v: 'return', en: 'Return', ru: 'Обратно' },
  { v: 'internal', en: 'Internal', ru: 'Внутренний' },
]
const CLASSES: { v: FlightClass; en: string; ru: string }[] = [
  { v: 'economy', en: 'Economy', ru: 'Эконом' },
  { v: 'premium', en: 'Premium economy', ru: 'Премиум-эконом' },
  { v: 'business', en: 'Business', ru: 'Бизнес' },
  { v: 'first', en: 'First', ru: 'Первый' },
  { v: 'charter', en: 'Charter', ru: 'Чартер' },
]

const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: '13px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}
const lbl: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', display: 'block', marginBottom: '3px',
}

export default function VariantFlights({ variantId, lang }: { variantId: string; lang: Lang }) {
  const t = useT()
  const [rows, setRows] = useState<FlightSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const load = useCallback(async () => { setLoading(true); setRows(await getFlights(variantId)); setLoading(false) }, [variantId])
  useEffect(() => { load() }, [load])

  async function handleAdd() { setBusy(true); const r = await addFlight(variantId); if (r) setRows((p) => [...p, r]); setBusy(false) }
  async function handleDelete(id: string) { setBusy(true); setRows((p) => p.filter((x) => x.id !== id)); await deleteFlight(id); setBusy(false) }

  function set<K extends keyof FlightSegment>(id: string, key: K, value: FlightSegment[K], debounce = true) {
    setRows((p) => p.map((r) => r.id === id ? { ...r, [key]: value } : r))
    const patch = { [key]: value } as Partial<Omit<FlightSegment, 'id' | 'variant_id'>>
    if (debounce) {
      if (timers.current[id + String(key)]) clearTimeout(timers.current[id + String(key)])
      timers.current[id + String(key)] = setTimeout(() => updateFlight(id, patch), 700)
    } else {
      updateFlight(id, patch)
    }
  }

  const kindLabel = (k: FlightKind) => { const o = KINDS.find((x) => x.v === k); return o ? t(o.en, o.ru) : k }

  // подытог по валютам
  const totals: Record<string, number> = {}
  for (const r of rows) if (r.price != null) totals[r.price_currency] = (totals[r.price_currency] ?? 0) + Number(r.price)

  return (
    <div>
      {loading ? (
        <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>{t('Loading…', 'Загрузка…')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rows.map((r) => (
            <div key={r.id} style={{ border: '1px solid var(--admin-border-card)', borderRadius: '10px', padding: '12px', background: 'var(--admin-card)' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '10px' }}>
                <div style={{ width: '130px' }}>
                  <label style={lbl}>{t('Leg', 'Плечо')}</label>
                  <select value={r.kind} onChange={(e) => set(r.id, 'kind', e.target.value as FlightKind, false)} style={input}>
                    {KINDS.map((k) => <option key={k.v} value={k.v}>{t(k.en, k.ru)}</option>)}
                  </select>
                </div>
                <div style={{ width: '120px' }}>
                  <label style={lbl}>{t('Date', 'Дата')}</label>
                  <input defaultValue={r.flight_date ?? ''} onChange={(e) => set(r.id, 'flight_date', e.target.value)} style={input} placeholder="30 Sep" />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label style={lbl}>{t('From', 'Откуда')}</label>
                  <input defaultValue={r.from_place ?? ''} onChange={(e) => set(r.id, 'from_place', e.target.value)} style={input} placeholder="Kyiv (KBP)" />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label style={lbl}>{t('To', 'Куда')}</label>
                  <input defaultValue={r.to_place ?? ''} onChange={(e) => set(r.id, 'to_place', e.target.value)} style={input} placeholder="Malé (MLE)" />
                </div>
                <button type="button" onClick={() => handleDelete(r.id)} disabled={busy}
                  style={{ ...input, width: 'auto', cursor: 'pointer', color: 'var(--admin-danger)', padding: '8px 10px' }}>✕</button>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 150px' }}>
                  <label style={lbl}>{t('Airline', 'Авиакомпания')}</label>
                  <input defaultValue={r.airline ?? ''} onChange={(e) => set(r.id, 'airline', e.target.value)} style={input} placeholder="Turkish Airlines" />
                </div>
                <div style={{ width: '110px' }}>
                  <label style={lbl}>{t('Flight №', 'Рейс №')}</label>
                  <input defaultValue={r.flight_no ?? ''} onChange={(e) => set(r.id, 'flight_no', e.target.value)} style={input} placeholder="TK 1256" />
                </div>
                <div style={{ width: '100px' }}>
                  <label style={lbl}>{t('Departs', 'Вылет')}</label>
                  <input defaultValue={r.depart_time ?? ''} onChange={(e) => set(r.id, 'depart_time', e.target.value)} style={input} placeholder="08:40" />
                </div>
                <div style={{ width: '100px' }}>
                  <label style={lbl}>{t('Arrives', 'Прилёт')}</label>
                  <input defaultValue={r.arrive_time ?? ''} onChange={(e) => set(r.id, 'arrive_time', e.target.value)} style={input} placeholder="14:10 +1" />
                </div>
                <div style={{ flex: '1 1 150px' }}>
                  <label style={lbl}>{t('Stops', 'Пересадки')}</label>
                  <input defaultValue={r.stops ?? ''} onChange={(e) => set(r.id, 'stops', e.target.value)} style={input} placeholder={t('Direct / 1 stop, Istanbul', 'Прямой / 1 пересадка, Стамбул')} />
                </div>
                <div style={{ width: '150px' }}>
                  <label style={lbl}>{t('Class', 'Класс')}</label>
                  <select value={r.travel_class} onChange={(e) => set(r.id, 'travel_class', e.target.value as FlightClass, false)} style={input}>
                    {CLASSES.map((c) => <option key={c.v} value={c.v}>{t(c.en, c.ru)}</option>)}
                  </select>
                </div>
                <div style={{ width: '110px' }}>
                  <label style={lbl}>{t('Price', 'Цена')}</label>
                  <input type="number" step="0.01" defaultValue={r.price ?? ''} onChange={(e) => set(r.id, 'price', e.target.value === '' ? null : Number(e.target.value))} style={input} />
                </div>
                <div style={{ width: '84px' }}>
                  <label style={lbl}>{t('Cur.', 'Валюта')}</label>
                  <select value={r.price_currency} onChange={(e) => set(r.id, 'price_currency', e.target.value, false)} style={input}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '10px' }}>
                <input defaultValue={r.note ?? ''} onChange={(e) => set(r.id, 'note', e.target.value)} style={input}
                  placeholder={t('Note (e.g. baggage 23 kg)', 'Заметка (напр. багаж 23 кг)')} />
              </div>
              <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--admin-text-faint)' }}>{kindLabel(r.kind)}</div>
            </div>
          ))}

          <button type="button" onClick={handleAdd} disabled={busy}
            style={{ ...input, width: 'auto', cursor: 'pointer', color: 'var(--admin-accent)', border: '1px dashed var(--admin-border-card)' }}>
            + {t('Add flight leg', 'Добавить плечо')}
          </button>

          {Object.keys(totals).length > 0 && (
            <div style={{ fontSize: '12.5px', color: 'var(--admin-text-muted)' }}>
              {t('Flight total (shown separately, not added to the route price)', 'Итого перелёт (показывается отдельно, в цену маршрута не входит)')}:{' '}
              <b style={{ color: 'var(--admin-text)' }}>{Object.entries(totals).map(([cur, a]) => `${Math.round(a).toLocaleString('ru-RU').replace(/ /g, ' ')} ${cur}`).join(' · ')}</b>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
