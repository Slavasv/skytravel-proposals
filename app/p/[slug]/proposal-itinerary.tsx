'use client'

import { useState } from 'react'

type Block = {
  id: string
  type: string
  title_ru: string | null
  title_en: string | null
}

type DayBlock = {
  id: string
  sort_order: number
  room_type_ru: string | null
  room_type_en: string | null
  from_ru: string | null
  from_en: string | null
  to_ru: string | null
  to_en: string | null
  content_blocks: Block
}

type Day = {
  id: string
  day_number: number
  date: string | null
  day_blocks: DayBlock[]
}

type Lang = 'ru' | 'en'

const T = {
  ru: {
    overview: 'Обзор', transfers: 'Трансферы', accommodation: 'Проживание',
    colDay: 'День', colActivities: 'Программа дня', colTransfer: 'Трансфер',
    colDates: 'Даты', colHotel: 'Отель', colNights: 'Ночей',
    emptyTransfers: 'Трансферы не указаны.', emptyAccommodation: 'Проживание не указано.',
    day: 'День',
  },
  en: {
    overview: 'Overview', transfers: 'Transfers', accommodation: 'Accommodation',
    colDay: 'Day', colActivities: 'Activities', colTransfer: 'Transfer',
    colDates: 'Dates', colHotel: 'Hotel', colNights: 'Nights',
    emptyTransfers: 'No transfers specified.', emptyAccommodation: 'No accommodation specified.',
    day: 'Day',
  },
}

const WEEKDAY: Record<Lang, Intl.DateTimeFormatOptions['weekday']> = { ru: 'long', en: 'long' }

function fmtDate(dateStr: string | null, lang: Lang): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\.$/, '')
}

function fmtWeekday(dateStr: string | null, lang: Lang): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { weekday: WEEKDAY[lang] })
}

function fmtShort(dateStr: string | null, lang: Lang): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short' }).replace(/\.$/, '')
}

function diffNights(checkIn: string | null, checkOut: string | null): number | null {
  if (!checkIn || !checkOut) return null
  const a = new Date(checkIn), b = new Date(checkOut)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null
  const n = Math.round((b.getTime() - a.getTime()) / 86400000)
  return n > 0 ? n : null
}

function nightsWord(n: number, lang: Lang): string {
  if (lang === 'en') return n === 1 ? 'night' : 'nights'
  const n1 = n % 10, n100 = n % 100
  if (n100 > 10 && n100 < 20) return 'ночей'
  if (n1 === 1) return 'ночь'
  if (n1 >= 2 && n1 <= 4) return 'ночи'
  return 'ночей'
}

type Tab = 'overview' | 'transfers' | 'accommodation'

const cellTd: React.CSSProperties = { padding: '14px 16px', borderTop: '1px solid #ECEAE3', verticalAlign: 'top', fontSize: '15px', color: '#2C2C2A', lineHeight: 1.5 }
const cellTh: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#888780', fontWeight: 600, background: '#F5F3EE' }
const dayCellSub: React.CSSProperties = { fontSize: '13px', color: '#888780' }

export default function ProposalItinerary({ days, lang, endDate }: { days: Day[]; lang: Lang; endDate: string | null }) {
  const [tab, setTab] = useState<Tab>('overview')
  const t = T[lang]
  const pick = (ru: string | null, en: string | null) => (lang === 'ru' ? ru : en) || ''

  const sortedDays = days.map((d) => ({
    ...d,
    day_blocks: [...(d.day_blocks ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }))

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: t.overview },
    { key: 'transfers', label: t.transfers },
    { key: 'accommodation', label: t.accommodation },
  ]

  const dayCell = (d: Day) => (
    <td style={{ ...cellTd, width: '150px' }}>
      <div style={{ fontWeight: 500 }}>{t.day} {d.day_number}</div>
      <div style={dayCellSub}>{fmtWeekday(d.date, lang)}</div>
      <div style={dayCellSub}>{fmtDate(d.date, lang)}</div>
    </td>
  )

  // Accommodation: собрать отели по порядку, посчитать ночи (заезд = дата дня, выезд = след. отель или endDate)
  const hotelStops = sortedDays.flatMap((d) =>
    d.day_blocks.filter((b) => b.content_blocks?.type === 'hotel').map((b) => ({ day: d, block: b.content_blocks, db: b }))
  )
  const accommodation = hotelStops.map((stop, i) => {
    const checkIn = stop.day.date
    const checkOut = i < hotelStops.length - 1 ? hotelStops[i + 1].day.date : endDate
    return { ...stop, checkIn, checkOut, nights: diffNights(checkIn, checkOut) }
  })

  return (
    <div style={{ marginBottom: '56px' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #ECEAE3' }}>
        {tabs.map((tb) => {
          const active = tab === tb.key
          return (
            <button key={tb.key} type="button" onClick={() => setTab(tb.key)}
              style={{
                padding: '10px 16px', fontSize: '14px', fontWeight: active ? 600 : 400,
                color: active ? '#2C2C2A' : '#888780', background: 'transparent', border: 'none',
                borderBottom: active ? '2px solid #2C2C2A' : '2px solid transparent', marginBottom: '-1px',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
              {tb.label}
            </button>
          )
        })}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        {tab === 'overview' && (
          <>
            <tbody>
              {sortedDays.map((d) => (
                <tr key={d.id}>
                  {dayCell(d)}
                  <td style={cellTd}>
                    {d.day_blocks.length === 0 ? <span style={{ color: '#B5B3AC' }}>—</span> :
                      d.day_blocks.map((b) => (
                        <div key={b.id} style={{ marginBottom: '4px' }}>{pick(b.content_blocks?.title_ru, b.content_blocks?.title_en) || '—'}</div>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </>
        )}

        {tab === 'transfers' && (() => {
          const rows = sortedDays.map((d) => ({ d, blocks: d.day_blocks.filter((b) => b.content_blocks?.type === 'transfer') })).filter((x) => x.blocks.length > 0)
          if (rows.length === 0) return <tbody><tr><td style={cellTd} colSpan={2}><span style={{ color: '#888780' }}>{t.emptyTransfers}</span></td></tr></tbody>
          return (
            <>
              <tbody>
                {rows.map(({ d, blocks }) => (
                  <tr key={d.id}>
                    {dayCell(d)}
                    <td style={cellTd}>{blocks.map((b) => {
                      const from = pick(b.from_ru, b.from_en)
                      const to = pick(b.to_ru, b.to_en)
                      const route = from || to ? `${from || '—'} → ${to || '—'}` : ''
                      return (
                        <div key={b.id} style={{ marginBottom: '8px' }}>
                          <div>{pick(b.content_blocks?.title_ru, b.content_blocks?.title_en) || '—'}</div>
                          {route && <div style={{ fontSize: '13px', color: '#888780', marginTop: '2px' }}>{route}</div>}
                        </div>
                      )
                    })}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )
        })()}

        {tab === 'accommodation' && (
          accommodation.length === 0 ? <tbody><tr><td style={cellTd} colSpan={3}><span style={{ color: '#888780' }}>{t.emptyAccommodation}</span></td></tr></tbody> : (
            <>
              <tbody>
                {accommodation.map((a, i) => {
                  const roomType = pick(a.db.room_type_ru, a.db.room_type_en)
                  return (
                    <tr key={`${a.block.id}-${i}`}>
                      <td style={{ ...cellTd, width: '150px' }}>
                        {a.checkIn || a.checkOut ? <span style={dayCellSub}>{fmtShort(a.checkIn, lang)}{a.checkOut ? ` – ${fmtShort(a.checkOut, lang)}` : ''}</span> : <span style={{ color: '#B5B3AC' }}>—</span>}
                      </td>
                      <td style={cellTd}>{pick(a.block.title_ru, a.block.title_en) || '—'}</td>
                      <td style={cellTd}>{roomType || <span style={{ color: '#B5B3AC' }}>—</span>}</td>
                      <td style={{ ...cellTd, textAlign: 'right' }}>{a.nights != null ? `${a.nights} ${nightsWord(a.nights, lang)}` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </>
          )
        )}
      </table>
    </div>
  )
}