'use client'

import type { PublicVariant, Lang } from './types'

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', AED: 'AED ', GBP: '£', UAH: '₴' }
function fmtPrice(v: number | null | undefined, cur: string): string {
  if (v == null) return ''
  const sym = CURRENCY_SYMBOL[cur] ?? (cur ? cur + ' ' : '')
  return `${sym}${Math.round(v).toLocaleString('ru-RU').replace(/ /g, ' ')}`
}

const KIND: Record<string, { ru: string; en: string }> = {
  outbound: { ru: 'Туда', en: 'Outbound' },
  return: { ru: 'Обратно', en: 'Return' },
  internal: { ru: 'Внутренний перелёт', en: 'Internal flight' },
}
const CLASS: Record<string, { ru: string; en: string }> = {
  economy: { ru: 'Эконом', en: 'Economy' },
  premium: { ru: 'Премиум-эконом', en: 'Premium economy' },
  business: { ru: 'Бизнес', en: 'Business' },
  first: { ru: 'Первый класс', en: 'First' },
  charter: { ru: 'Чартер', en: 'Charter' },
}

export default function ProposalFlights({ variant, lang }: { variant: PublicVariant; lang: Lang }) {
  const flights = variant.flights || []
  if (flights.length === 0) return null
  const T = (ru: string, en: string) => (lang === 'ru' ? ru : en)

  // подытог по валютам (показываем отдельно, в цену маршрута не входит)
  const totals: Record<string, number> = {}
  for (const f of flights) if (f.price != null) totals[(f.price_currency || 'EUR')] = (totals[(f.price_currency || 'EUR')] ?? 0) + Number(f.price)

  return (
    <div className="tp-container">
      <h2 className="tp-h2">{T('Авиаперелёт', 'Flights')}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '18px' }}>
        {flights.map((f) => (
          <div key={f.id} style={{ border: '1px solid var(--tp-line, #e5ddcf)', borderRadius: '12px', padding: '16px 18px', background: 'var(--tp-card, #fff)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tp-accent, #b07b2b)', fontWeight: 600 }}>
                {KIND[f.kind] ? T(KIND[f.kind].ru, KIND[f.kind].en) : f.kind}{f.flight_date ? ` · ${f.flight_date}` : ''}
              </span>
              {f.price != null && (
                <span style={{ fontSize: '14px', fontWeight: 600 }}>{fmtPrice(f.price, f.price_currency || 'EUR')}</span>
              )}
            </div>

            <div style={{ fontSize: '18px', fontWeight: 600, margin: '8px 0 4px' }}>
              {(f.from_place || '—')} <span style={{ color: 'var(--tp-accent, #b07b2b)' }}>→</span> {(f.to_place || '—')}
            </div>

            <div style={{ fontSize: '14px', color: 'var(--tp-text-soft, #5f5e5a)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {(f.airline || f.flight_no) && <span>{[f.airline, f.flight_no].filter(Boolean).join(' · ')}</span>}
              {(f.depart_time || f.arrive_time) && <span>{[f.depart_time, f.arrive_time].filter(Boolean).join(' → ')}</span>}
              {f.stops && <span>{f.stops}</span>}
              {CLASS[f.travel_class] && <span>{T(CLASS[f.travel_class].ru, CLASS[f.travel_class].en)}</span>}
            </div>

            {f.note && <div style={{ fontSize: '13px', color: 'var(--tp-text-muted, #9a968c)', marginTop: '8px' }}>{f.note}</div>}
          </div>
        ))}
      </div>

      {Object.keys(totals).length > 0 && (
        <p style={{ fontSize: '13px', color: 'var(--tp-text-soft, #5f5e5a)', marginTop: '14px' }}>
          {T('Перелёт оплачивается отдельно', 'Flights are paid separately')}:{' '}
          <b>{Object.entries(totals).map(([cur, a]) => fmtPrice(a, cur)).join(' · ')}</b>
        </p>
      )}
    </div>
  )
}
