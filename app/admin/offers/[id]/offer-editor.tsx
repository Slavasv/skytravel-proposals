'use client'

import { useState, useMemo } from 'react'
import { buildOfferText, type Lang } from '@/lib/offer-text'
import { useT, useLang } from '@/lib/i18n-client'
import ClientPicker, { type PickerClient } from '@/app/admin/_components/client-picker'

type Quote = {
  id: string; source: string; partner_id: string | null; amount: number | null
  currency: string | null; commission_pct: number | null; is_chosen: boolean; sort_order: number | null
}
type Room = {
  id: string; room_type: string | null; room_link: string | null; room_note: string | null
  sale_price: number | null; sale_currency: string | null; is_recommended: boolean; sort_order: number | null
  offer_room_quotes?: Quote[]; quotes?: Quote[]
}
type Offer = {
  id: string; title: string | null; hotel_name: string | null; date_from: string | null; date_to: string | null
  occupancy: string | null; meal: string | null; status: string | null; client_id: string | null; offer_rooms?: Room[]
}
type Partner = { id: string; name: string }
type HotelRoom = { ru: string; en: string }
type Hotel = { name: string; link: string; rooms: HotelRoom[] }

const CURRENCIES = ['EUR', 'USD', 'AED', 'GBP']
// Устаканенные типы питания (канонический ключ + подписи)
const MEALS: { key: string; en: string; ru: string }[] = [
  { key: 'room_only', en: 'Room only', ru: 'Без питания' },
  { key: 'breakfast', en: 'Breakfast', ru: 'Завтраки' },
  { key: 'half_board', en: 'Half board', ru: 'Полупансион' },
  { key: 'full_board', en: 'Full board', ru: 'Полный пансион' },
  { key: 'all_inclusive', en: 'All inclusive', ru: 'Всё включено' },
]

const field: React.CSSProperties = {
  padding: '8px 10px', fontSize: '13px', color: 'var(--admin-text)', background: 'var(--admin-input)',
  border: '1px solid var(--admin-border)', borderRadius: '7px', fontFamily: 'inherit', outline: 'none', width: '100%',
}
const lbl: React.CSSProperties = { display: 'block', fontSize: '10.5px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--admin-text-faint)', marginBottom: '5px' }

function num(v: string): number | null { return v.trim() === '' ? null : Number(v) }

export default function OfferEditor({ offer, partners, clients, hotels }: { offer: Offer; partners: Partner[]; clients: PickerClient[]; hotels: Hotel[] }) {
  const t = useT()
  const lang = useLang() as Lang
  const offerId = offer.id

  const SOURCES = [
    { v: 'netto', label: t('Net', 'Нетто') },
    { v: 'booking', label: t('Booking', 'Букинг') },
    { v: 'hotel', label: t('Hotel', 'Отель') },
  ]

  const [hdr, setHdr] = useState({
    title: offer.title || '', hotel_name: offer.hotel_name || '',
    date_from: offer.date_from || '', date_to: offer.date_to || '',
    occupancy: offer.occupancy || '', meal: offer.meal || '', status: offer.status || 'draft',
  })
  const [clientId, setClientId] = useState(offer.client_id || '')
  const initRooms: Room[] = useMemo(() => {
    return [...(offer.offer_rooms || [])]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((r) => ({ ...r, quotes: [...(r.offer_room_quotes || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) }))
  }, [offer.offer_rooms])
  const [rooms, setRooms] = useState<Room[]>(initRooms)
  const [copied, setCopied] = useState(false)

  // номера из библиотеки для выбранного отеля (подсказки категорий)
  const hotelRooms = useMemo(() => {
    const h = hotels.find((x) => x.name.trim().toLowerCase() === hdr.hotel_name.trim().toLowerCase())
    return (h?.rooms || []).map((r) => (lang === 'ru' ? (r.ru || r.en) : (r.en || r.ru))).filter(Boolean)
  }, [hotels, hdr.hotel_name, lang])

  const mealLabel = (key: string) => MEALS.find((m) => m.key === key)?.[lang] || key

  async function api(body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/offers/${offerId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      return res.ok ? await res.json() : null
    } catch { return null }
  }

  function setH<K extends keyof typeof hdr>(k: K, v: string) { setHdr((p) => ({ ...p, [k]: v })) }
  function saveH(k: keyof typeof hdr, v: string) { api({ op: 'offer_update', patch: { [k]: v || null } }) }
  function onPickClient(id: string) {
    setClientId(id)
    api({ op: 'offer_update', patch: { client_id: id || null } })
    if (!hdr.title.trim()) {
      const c = clients.find((x) => x.id === id)
      if (c?.name) { setH('title', c.name); saveH('title', c.name) }
    }
  }

  async function addRoom() {
    const res = await api({ op: 'room_add' })
    if (res?.room) setRooms((p) => [...p, { ...res.room, quotes: [] }])
  }
  function patchRoomLocal(roomId: string, patch: Partial<Room>) {
    setRooms((p) => p.map((r) => (r.id === roomId ? { ...r, ...patch } : r)))
  }
  function saveRoom(roomId: string, patch: Record<string, unknown>) { api({ op: 'room_update', roomId, patch }) }
  async function delRoom(roomId: string) {
    if (!confirm(t('Delete this room?', 'Удалить номер?'))) return
    setRooms((p) => p.filter((r) => r.id !== roomId))
    await api({ op: 'room_delete', roomId })
  }

  async function addQuote(roomId: string, source: string) {
    const res = await api({ op: 'quote_add', roomId, patch: { source } })
    if (res?.quote) patchRoomLocal(roomId, { quotes: [...(rooms.find((r) => r.id === roomId)?.quotes || []), res.quote] })
  }
  function patchQuoteLocal(roomId: string, quoteId: string, patch: Partial<Quote>) {
    setRooms((p) => p.map((r) => r.id !== roomId ? r : { ...r, quotes: (r.quotes || []).map((q) => q.id === quoteId ? { ...q, ...patch } : q) }))
  }
  function saveQuote(quoteId: string, patch: Record<string, unknown>) { api({ op: 'quote_update', quoteId, patch }) }
  async function delQuote(roomId: string, quoteId: string) {
    patchRoomLocal(roomId, { quotes: (rooms.find((r) => r.id === roomId)?.quotes || []).filter((q) => q.id !== quoteId) })
    await api({ op: 'quote_delete', quoteId })
  }
  function setChosen(roomId: string, quoteId: string) {
    setRooms((p) => p.map((r) => r.id !== roomId ? r : { ...r, quotes: (r.quotes || []).map((q) => ({ ...q, is_chosen: q.id === quoteId })) }))
    api({ op: 'set_chosen', roomId, quoteId })
  }

  const waText = useMemo(() => buildOfferText({
    hotel_name: hdr.hotel_name, date_from: hdr.date_from, date_to: hdr.date_to, occupancy: hdr.occupancy, meal: mealLabel(hdr.meal),
    rooms: rooms.map((r) => ({
      room_type: r.room_type, room_link: r.room_link, room_note: r.room_note, sale_price: r.sale_price, sale_currency: r.sale_currency,
      quotes: (r.quotes || []).map((q) => ({ source: q.source, amount: q.amount, currency: q.currency, commission_pct: q.commission_pct, is_chosen: q.is_chosen, sort_order: q.sort_order ?? 0 })),
    })),
  }, 'admin', lang), [hdr, rooms, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  function copy() { navigator.clipboard?.writeText(waText); setCopied(true); setTimeout(() => setCopied(false), 1400) }

  return (
    <div style={{ maxWidth: '820px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 4px' }}>{hdr.hotel_name || t('New offer', 'Новый оффер')}</h1>
      <p style={{ color: 'var(--admin-text-muted)', margin: '0 0 18px', fontSize: '13px' }}>
        {t('Working view with price comparison — the WhatsApp text is below.', 'Рабочий визуал со сравнением цен — готовый текст для WhatsApp ниже.')}
      </p>

      {/* header card */}
      <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border-card)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>{t('Client', 'Клиент')}</label>
            <ClientPicker clients={clients} value={clientId} onChange={onPickClient} returnTo={`/admin/offers/${offerId}`} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>{t('Title (client / trip)', 'Название (клиент / поездка)')}</label>
            <input style={field} value={hdr.title} onChange={(e) => setH('title', e.target.value)} onBlur={(e) => saveH('title', e.target.value)} placeholder={t('e.g. The Kuznetsov family', 'напр. Семья Кузнецовых')} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>{t('Hotel', 'Отель')}</label>
            <input style={field} list="offer-hotels" value={hdr.hotel_name} onChange={(e) => setH('hotel_name', e.target.value)} onBlur={(e) => saveH('hotel_name', e.target.value)} placeholder={t('start typing — suggestions from the library', 'начните вводить — подскажем из библиотеки')} />
            <datalist id="offer-hotels">{hotels.map((h) => <option key={h.name} value={h.name} />)}</datalist>
          </div>
          <div><label style={lbl}>{t('Date from', 'Дата с')}</label><input type="date" style={field} value={hdr.date_from} onChange={(e) => { setH('date_from', e.target.value); saveH('date_from', e.target.value) }} /></div>
          <div><label style={lbl}>{t('Date to', 'Дата по')}</label><input type="date" style={field} value={hdr.date_to} onChange={(e) => { setH('date_to', e.target.value); saveH('date_to', e.target.value) }} /></div>
          <div><label style={lbl}>{t('Occupancy', 'Размещение')}</label><input style={field} value={hdr.occupancy} onChange={(e) => setH('occupancy', e.target.value)} onBlur={(e) => saveH('occupancy', e.target.value)} placeholder={t('2 adults + 5 children (14,11,…)', '2 взрослых + 5 детей (14,11,…)')} /></div>
          <div>
            <label style={lbl}>{t('Meals', 'Питание')}</label>
            <select style={field} value={hdr.meal} onChange={(e) => { setH('meal', e.target.value); saveH('meal', e.target.value) }}>
              <option value="">{t('— select —', '— выбрать —')}</option>
              {MEALS.map((m) => <option key={m.key} value={m.key}>{lang === 'ru' ? m.ru : m.en}</option>)}
              {hdr.meal && !MEALS.some((m) => m.key === hdr.meal) && <option value={hdr.meal}>{hdr.meal}</option>}
            </select>
          </div>
          <div>
            <label style={lbl}>{t('Status', 'Статус')}</label>
            <select style={field} value={hdr.status} onChange={(e) => { setH('status', e.target.value); saveH('status', e.target.value) }}>
              <option value="draft">{t('draft', 'черновик')}</option>
              <option value="sent">{t('sent', 'отправлен')}</option>
            </select>
          </div>
        </div>
      </div>

      <datalist id="offer-rooms">{hotelRooms.map((r) => <option key={r} value={r} />)}</datalist>

      {/* rooms */}
      {rooms.map((room, idx) => (
        <div key={room.id} style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border-card)', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--admin-sidebar)', color: '#F5EFE4', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{idx + 1}</span>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>{t('Room', 'Номер')} {idx + 1}</span>
            <button onClick={() => delRoom(room.id)} className="adm-dots" title={t('Delete room', 'Удалить номер')} style={{ marginLeft: 'auto' }}>✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={lbl}>{t('Room category', 'Категория номера')}</label>
              <input style={field} list="offer-rooms" value={room.room_type || ''} onChange={(e) => patchRoomLocal(room.id, { room_type: e.target.value })} onBlur={(e) => saveRoom(room.id, { room_type: e.target.value })} placeholder={t('Deluxe Room (25–40 m²)', 'Deluxe Room (25–40 м²)')} />
            </div>
            <div><label style={lbl}>{t('Room link', 'Ссылка на номер')}</label><input style={field} value={room.room_link || ''} onChange={(e) => patchRoomLocal(room.id, { room_link: e.target.value })} onBlur={(e) => saveRoom(room.id, { room_link: e.target.value })} placeholder="https://…" /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>{t('Room note (optional)', 'Примечание к номеру (необязательно)')}</label><input style={field} value={room.room_note || ''} onChange={(e) => patchRoomLocal(room.id, { room_note: e.target.value })} onBlur={(e) => saveRoom(room.id, { room_note: e.target.value })} placeholder={t('e.g. 2 Outer-connecting rooms…', 'напр. 2 номера Outer-connecting…')} /></div>
          </div>

          <div style={{ fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', fontWeight: 700, marginBottom: '8px' }}>{t('Price comparison', 'Сравнение цен')}</div>
          <div className="adm-tscroll">
            <table className="adm-table" style={{ marginBottom: '2px' }}>
              <thead><tr>
                <th style={{ width: '34px' }}>{t('Act.', 'Акт.')}</th><th>{t('Source', 'Источник')}</th><th>{t('Partner', 'Партнёр')}</th><th>{t('Price', 'Цена')}</th><th>{t('Curr.', 'Валюта')}</th><th>{t('Comm.%', 'Комис.%')}</th><th style={{ width: '34px' }}> </th>
              </tr></thead>
              <tbody>
                {(room.quotes || []).map((q) => (
                  <tr key={q.id} style={q.is_chosen ? { background: '#F3EEDF' } : undefined}>
                    <td>
                      <button aria-label={t('current', 'актуальная')} onClick={() => setChosen(room.id, q.id)}
                        style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${q.is_chosen ? 'var(--admin-gold-soft)' : 'var(--admin-border-hover)'}`, background: q.is_chosen ? 'radial-gradient(circle, var(--admin-gold-soft) 0 45%, transparent 47%)' : 'transparent', cursor: 'pointer', padding: 0 }} />
                    </td>
                    <td>
                      <select value={q.source} onChange={(e) => { patchQuoteLocal(room.id, q.id, { source: e.target.value }); saveQuote(q.id, { source: e.target.value }) }} style={{ ...field, padding: '5px 7px', width: 'auto' }}>
                        {SOURCES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                      </select>
                    </td>
                    <td>
                      {q.source === 'netto' ? (
                        <select value={q.partner_id || ''} onChange={(e) => { patchQuoteLocal(room.id, q.id, { partner_id: e.target.value || null }); saveQuote(q.id, { partner_id: e.target.value || null }) }} style={{ ...field, padding: '5px 7px', width: 'auto', minWidth: '130px' }}>
                          <option value="">{t('— partner —', '— партнёр —')}</option>
                          {partners.map((p) => <option key={p.id} value={p.id}>{p.name || '—'}</option>)}
                        </select>
                      ) : <span className="adm-cell-faint">—</span>}
                    </td>
                    <td><input inputMode="decimal" defaultValue={q.amount ?? ''} onBlur={(e) => { const v = num(e.target.value); patchQuoteLocal(room.id, q.id, { amount: v }); saveQuote(q.id, { amount: v }) }} style={{ ...field, padding: '5px 7px', width: '90px' }} /></td>
                    <td>
                      <select value={q.currency || 'EUR'} onChange={(e) => { patchQuoteLocal(room.id, q.id, { currency: e.target.value }); saveQuote(q.id, { currency: e.target.value }) }} style={{ ...field, padding: '5px 7px', width: 'auto' }}>
                        {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td>{q.source === 'netto'
                      ? <input inputMode="decimal" defaultValue={q.commission_pct ?? ''} onBlur={(e) => { const v = num(e.target.value); patchQuoteLocal(room.id, q.id, { commission_pct: v }); saveQuote(q.id, { commission_pct: v }) }} style={{ ...field, padding: '5px 7px', width: '56px' }} />
                      : <span className="adm-cell-faint">—</span>}</td>
                    <td className="adm-right"><button className="adm-dots" title={t('Delete', 'Удалить')} onClick={() => delQuote(room.id, q.id)}>✕</button></td>
                  </tr>
                ))}
                {(room.quotes || []).length === 0 && (
                  <tr><td colSpan={7} className="adm-cell-faint" style={{ textAlign: 'center', padding: '10px' }}>{t('No quotes yet', 'Котировок нет')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: '8px', margin: '8px 0 14px', flexWrap: 'wrap' }}>
            {SOURCES.map((s) => (
              <button key={s.v} onClick={() => addQuote(room.id, s.v)} style={{ fontSize: '12px', color: 'var(--admin-accent)', background: 'none', border: '1px dashed var(--admin-border-hover)', borderRadius: '7px', padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>+ {s.label}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--admin-border-card)' }}>
            <div><label style={lbl}>{t('Client price', 'Цена клиенту')}</label><input inputMode="decimal" defaultValue={room.sale_price ?? ''} onBlur={(e) => { const v = num(e.target.value); patchRoomLocal(room.id, { sale_price: v }); saveRoom(room.id, { sale_price: v }) }} style={field} /></div>
            <div><label style={lbl}>{t('Currency', 'Валюта')}</label>
              <select value={room.sale_currency || 'EUR'} onChange={(e) => { patchRoomLocal(room.id, { sale_currency: e.target.value }); saveRoom(room.id, { sale_currency: e.target.value }) }} style={field}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      ))}

      <button onClick={addRoom} style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px dashed var(--admin-border-hover)', borderRadius: '10px', color: 'var(--admin-text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, marginBottom: '20px' }}>+ {t('Add room', 'Добавить номер')}</button>

      {/* whatsapp preview */}
      <div style={{ background: '#fff', border: '1px solid var(--admin-border)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ background: 'var(--admin-head)', padding: '10px 14px', fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('WhatsApp preview', 'Превью для WhatsApp')}</span>
          <button onClick={copy} style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 600, background: '#25623b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>{copied ? t('Copied ✓', 'Скопировано ✓') : t('Copy', 'Скопировать')}</button>
        </div>
        <pre style={{ margin: 0, padding: '16px', fontFamily: 'inherit', fontSize: '13px', lineHeight: 1.55, color: '#2C2C2A', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{waText || t('Fill in the hotel and rooms — the text will appear here.', 'Заполните отель и номера — текст появится здесь.')}</pre>
      </div>
      <p style={{ fontSize: '11.5px', color: 'var(--admin-text-faint)', marginTop: '8px', lineHeight: 1.5 }}>
        {t('Internal version — with net/booking/hotel. The client gets the “Simple” (price only) — coming next.', 'Внутренний вариант — с нетто/букинг/отель. Клиенту уйдёт «Симпл» (только цена) — добавим следующим шагом.')}
      </p>
    </div>
  )
}
