'use client'

import { useEffect, useRef } from 'react'
import { useDays } from './days-context'
import { updateVariant } from './variant-actions'
import { normalizeRooms } from '@/app/admin/library/[id]/rooms-editor'
import type { Lang } from './edit-page-client'
import { useT } from '@/lib/i18n-client'

export default function CostBreakdown({
  lang, currency, onTotalChange,
}: {
  lang: Lang
  currency: string
  onTotalChange?: (total: number) => void
}) {
  const t = useT()
  const { days, variantId, updateRoomPrice, updateBlockPrice, getNights } = useDays()

  const inputStyle: React.CSSProperties = {
    width: '140px', padding: '10px 12px', fontSize: '14px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', textAlign: 'right',
  }
  const catTitle: React.CSSProperties = {
    fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '10px',
  }
  const cardStyle: React.CSSProperties = {
    border: '1px solid var(--admin-border-card)', borderRadius: '8px',
    padding: '12px', background: 'var(--admin-card)',
  }

  type Line = { key: string; blockId: string; uid?: string; label: string; sub: string; price: number | null }
  const hotels: { blockId: string; hotelName: string; nights: number | null; rooms: Line[] }[] = []
  const activities: Line[] = []
  const transfers: Line[] = []

  const ordered = [...days].sort((a, b) => a.day_number - b.day_number)
  for (const d of ordered) {
    for (const b of (d.day_blocks ?? [])) {
      const cb = b.content_blocks
      if (!cb) continue
      const title = (lang === 'ru' ? cb.title_ru : cb.title_en) || cb.title_en || cb.title_ru || t('Untitled', 'Без названия')

      if (cb.type === 'hotel') {
        const roomDefs = normalizeRooms(cb.rooms)
        const rows: Line[] = (b.selected_rooms ?? []).map((sr) => {
          const def = roomDefs.find((r) => r.id === sr.room_id)
          const roomName = def ? ((lang === 'ru' ? def.title_ru : def.title_en) || def.title_en || def.title_ru || t('Room', 'Номер')) : t('Room', 'Номер')
          const guestsLabel = `${sr.guests} ${sr.guests === 1 ? t('guest', 'гость') : t('guests', 'гостей')}`
          const sub = sr.meal ? `${guestsLabel} · ${sr.meal}` : guestsLabel
          return {
            key: `${b.id}:${sr.uid}`, blockId: b.id, uid: sr.uid,
            label: roomName, sub, price: sr.price,
          }
        })
        if (rows.length > 0) hotels.push({ blockId: b.id, hotelName: title, nights: getNights(b.id), rooms: rows })
      } else if (cb.type === 'activity') {
        const g = b.guests ? `${b.guests} ${b.guests === 1 ? t('guest', 'гость') : t('guests', 'гостей')}` : ''
        activities.push({ key: b.id, blockId: b.id, label: title, sub: g, price: b.price })
      } else if (cb.type === 'transfer') {
        const g = b.guests ? `${b.guests} ${b.guests === 1 ? t('guest', 'гость') : t('guests', 'гостей')}` : ''
        const from = (lang === 'ru' ? b.from_ru : b.from_en) || b.from_ru || b.from_en || ''
        const to = (lang === 'ru' ? b.to_ru : b.to_en) || b.to_ru || b.to_en || ''
        const route = [from, to].filter(Boolean).join(' → ')
        transfers.push({ key: b.id, blockId: b.id, label: title, sub: [route, g].filter(Boolean).join(' · '), price: b.price })
      }
    }
  }

  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })

  const hotelsTotal = hotels.reduce((s, h) => s + h.rooms.reduce((rs, r) => rs + (r.price || 0), 0), 0)
  const activitiesTotal = activities.reduce((s, a) => s + (a.price || 0), 0)
  const transfersTotal = transfers.reduce((s, tx) => s + (tx.price || 0), 0)
  const grandTotal = hotelsTotal + activitiesTotal + transfersTotal

  // отдаём итог наверх для отображения в поле Total price
  useEffect(() => {
    onTotalChange?.(grandTotal)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grandTotal])

  // сохраняем итог в сам вариант (у каждого варианта свой)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    if (!variantId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      updateVariant(variantId, { total_price: grandTotal }).catch(() => {})
    }, 1000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grandTotal, variantId])

  const nothing = hotels.length === 0 && activities.length === 0 && transfers.length === 0
  if (nothing) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: 0 }}>
        {t('Add hotels, activities or transfers to the itinerary — they’ll appear here for pricing.', 'Добавьте отели, активности или трансферы в маршрут — они появятся здесь для расчёта стоимости.')}
      </p>
    )
  }

  function priceInput(value: number | null, onSave: (v: number | null) => void) {
    return (
      <input type="number" min={0} defaultValue={value ?? ''}
        onBlur={(e) => { const raw = e.target.value.trim(); onSave(raw === '' ? null : Number(raw)) }}
        placeholder="0" style={inputStyle} />
    )
  }

  function catTotalRow(label: string, total: number) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: '10px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--admin-border-card)' }}>
        <span style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>{label}</span>
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--admin-text)' }}>{fmt(total)} {currency}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ПРОЖИВАНИЕ */}
      {hotels.length > 0 && (
        <div>
          <div style={catTitle}>{t('Accommodation', 'Проживание')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {hotels.map((h) => (
              <div key={h.blockId} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--admin-text)' }}>{h.hotelName}</span>
                  {h.nights != null && (
                    <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{h.nights} {h.nights === 1 ? t('night', 'ночь') : t('nights', 'ночей')}</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {h.rooms.map((r) => (
                    <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ flex: 1, fontSize: '13px', color: 'var(--admin-text)' }}>
                        {r.label}{r.sub && <span style={{ color: 'var(--admin-text-muted)' }}> · {r.sub}</span>}
                      </span>
                      {priceInput(r.price, (v) => updateRoomPrice(r.blockId, r.uid!, v))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {catTotalRow(t('Accommodation total', 'Проживание — итого'), hotelsTotal)}
        </div>
      )}

      {/* АКТИВНОСТИ */}
      {activities.length > 0 && (
        <div>
          <div style={catTitle}>{t('Activities', 'Активности')}</div>
          <div style={cardStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activities.map((a) => (
                <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ flex: 1, fontSize: '13px', color: 'var(--admin-text)' }}>
                    {a.label}{a.sub && <span style={{ color: 'var(--admin-text-muted)' }}> · {a.sub}</span>}
                  </span>
                  {priceInput(a.price, (v) => updateBlockPrice(a.blockId, v))}
                </div>
              ))}
            </div>
          </div>
          {catTotalRow(t('Activities total', 'Активности — итого'), activitiesTotal)}
        </div>
      )}

      {/* ТРАНСФЕРЫ */}
      {transfers.length > 0 && (
        <div>
          <div style={catTitle}>{t('Transfers', 'Трансферы')}</div>
          <div style={cardStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {transfers.map((tx) => (
                <div key={tx.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ flex: 1, fontSize: '13px', color: 'var(--admin-text)' }}>
                    {tx.label}{tx.sub && <span style={{ color: 'var(--admin-text-muted)' }}> · {tx.sub}</span>}
                  </span>
                  {priceInput(tx.price, (v) => updateBlockPrice(tx.blockId, v))}
                </div>
              ))}
            </div>
          </div>
          {catTotalRow(t('Transfers total', 'Трансферы — итого'), transfersTotal)}
        </div>
      )}
    </div>
  )
}