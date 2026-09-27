'use client'

import { useState, useMemo, useRef } from 'react'
import { buildOfferText } from '@/lib/offer-text'

type Quote = {
  id: string; source: string; partner_id: string | null; amount: number | null
  currency: string | null; commission_pct: number | null; is_chosen: boolean; sort_order: number | null
}
type Room = {
  id: string; room_type: string | null; room_link: string | null; room_note: string | null
  sale_price: number | null; sale_currency: string | null; extra_label: string | null; extra_price: number | null
  is_recommended: boolean; sort_order: number | null; offer_room_quotes?: Quote[]; quotes?: Quote[]
}
type Offer = {
  id: string; title: string | null; hotel_name: string | null; date_from: string | null; date_to: string | null
  occupancy: string | null; meal: string | null; status: string | null; offer_rooms?: Room[]
}
type Partner = { id: string; name: string }

const CURRENCIES = ['EUR', 'USD', 'AED', 'GBP']
const SOURCES: { v: string; label: string }[] = [
  { v: 'netto', label: 'Нетто' }, { v: 'booking', label: 'Букинг' }, { v: 'hotel', label: 'Отель' },
]
const TONE: Record<string, string> = { netto: 'adm-tone-done', booking: 'adm-tone-info', hotel: 'adm-tone-mid' }

const field: React.CSSProperties = {
  padding: '8px 10px', fontSize: '13px', color: 'var(--admin-text)', background: 'var(--admin-input)',
  border: '1px solid var(--admin-border)', borderRadius: '7px', fontFamily: 'inherit', outline: 'none', width: '100%',
}
const lbl: React.CSSProperties = { display: 'block', fontSize: '10.5px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--admin-text-faint)', marginBottom: '5px' }

function num(v: string): number | null { return v.trim() === '' ? null : Number(v) }

export default function OfferEditor({ offer, partners }: { offer: Offer; partners: Partner[] }) {
  const offerId = offer.id
  const [hdr, setHdr] = useState({
    title: offer.title || '', hotel_name: offer.hotel_name || '',
    date_from: offer.date_from || '', date_to: offer.date_to || '',
    occupancy: offer.occupancy || '', meal: offer.meal || '', status: offer.status || 'draft',
  })
  const initRooms: Room[] = useMemo(() => {
    return [...(offer.offer_rooms || [])]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((r) => ({ ...r, quotes: [...(r.offer_room_quotes || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) }))
  }, [offer.offer_rooms])
  const [rooms, setRooms] = useState<Room[]>(initRooms)
  const [copied, setCopied] = useState(false)

  async function api(body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/offers/${offerId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      return res.ok ? await res.json() : null
    } catch { return null }
  }

  // ---- header ----
  function setH<K extends keyof typeof hdr>(k: K, v: string) { setHdr((p) => ({ ...p, [k]: v })) }
  function saveH(k: keyof typeof hdr, v: string) { api({ op: 'offer_update', patch: { [k]: v || null } }) }

  // ---- rooms ----
  async function addRoom() {
    const res = await api({ op: 'room_add' })
    if (res?.room) setRooms((p) => [...p, { ...res.room, quotes: [] }])
  }
  function patchRoomLocal(roomId: string, patch: Partial<Room>) {
    setRooms((p) => p.map((r) => (r.id === roomId ? { ...r, ...patch } : r)))
  }
  function saveRoom(roomId: string, patch: Record<string, unknown>) { api({ op: 'room_update', roomId, patch }) }
  async function delRoom(roomId: string) {
    if (!confirm('Удалить номер?')) return
    setRooms((p) => p.filter((r) => r.id !== roomId))
    await api({ op: 'room_delete', roomId })
  }

  // ---- quotes ----
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

  // ---- whatsapp text (admin mode) ----
  const waText = useMemo(() => buildOfferText({
    hotel_name: hdr.hotel_name, date_from: hdr.date_from, date_to: hdr.date_to, occupancy: hdr.occupancy, meal: hdr.meal,
    rooms: rooms.map((r) => ({
      room_type: r.room_type, room_link: r.room_link, room_note: r.room_note,
      sale_price: r.sale_price, sale_currency: r.sale_currency, extra_label: r.extra_label, extra_price: r.extra_price,
      quotes: (r.quotes || []).map((q) => ({ source: q.source, amount: q.amount, currency: q.currency, commission_pct: q.commission_pct, is_chosen: q.is_chosen, sort_order: q.sort_order ?? 0 })),
    })),
  }, 'admin'), [hdr, rooms])

  const copyRef = useRef<HTMLPreElement>(null)
  function copy() {
    navigator.clipboard?.writeText(waText)
    setCopied(true); setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div>
      <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 4px' }}>{hdr.hotel_name || 'Новый оффер'}</h1>
      <p style={{ color: 'var(--admin-text-muted)', margin: '0 0 18px', fontSize: '13px' }}>
        Слева — рабочий визуал со сравнением цен · справа — готовый текст для WhatsApp
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 360px', gap: '18px', alignItems: 'start' }} className="offer-cols">
        {/* LEFT: editor */}
        <div>
          {/* header card */}
          <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border-card)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Название (клиент / поездка)</label>
                <input style={field} value={hdr.title} onChange={(e) => setH('title', e.target.value)} onBlur={(e) => saveH('title', e.target.value)} placeholder="напр. Семья Кузнецовых" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Отель</label>
                <input style={field} value={hdr.hotel_name} onChange={(e) => setH('hotel_name', e.target.value)} onBlur={(e) => saveH('hotel_name', e.target.value)} placeholder="напр. Botanic Sanctuary Antwerp" />
              </div>
              <div><label style={lbl}>Дата с</label><input type="date" style={field} value={hdr.date_from} onChange={(e) => { setH('date_from', e.target.value); saveH('date_from', e.target.value) }} /></div>
              <div><label style={lbl}>Дата по</label><input type="date" style={field} value={hdr.date_to} onChange={(e) => { setH('date_to', e.target.value); saveH('date_to', e.target.value) }} /></div>
              <div><label style={lbl}>Размещение</label><input style={field} value={hdr.occupancy} onChange={(e) => setH('occupancy', e.target.value)} onBlur={(e) => saveH('occupancy', e.target.value)} placeholder="2 взрослых + 5 детей (14,11,…)" /></div>
              <div><label style={lbl}>Питание</label><input style={field} value={hdr.meal} onChange={(e) => setH('meal', e.target.value)} onBlur={(e) => saveH('meal', e.target.value)} placeholder="завтраки / без питания" /></div>
              <div>
                <label style={lbl}>Статус</label>
                <select style={field} value={hdr.status} onChange={(e) => { setH('status', e.target.value); saveH('status', e.target.value) }}>
                  <option value="draft">черновик</option>
                  <option value="sent">отправлен</option>
                </select>
              </div>
            </div>
          </div>

          {/* rooms */}
          {rooms.map((room, idx) => (
            <div key={room.id} style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border-card)', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--admin-sidebar)', color: '#F5EFE4', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{idx + 1}</span>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Номер {idx + 1}</span>
                <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--admin-text-muted)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={room.is_recommended} onChange={(e) => { patchRoomLocal(room.id, { is_recommended: e.target.checked }); saveRoom(room.id, { is_recommended: e.target.checked }) }} />
                  рекомендуем
                </label>
                <button onClick={() => delRoom(room.id)} className="adm-dots" title="Удалить номер" style={{ marginLeft: '4px' }}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px', marginBottom: '14px' }}>
                <div><label style={lbl}>Категория номера</label><input style={field} value={room.room_type || ''} onChange={(e) => patchRoomLocal(room.id, { room_type: e.target.value })} onBlur={(e) => saveRoom(room.id, { room_type: e.target.value })} placeholder="Deluxe Room (25–40 м²)" /></div>
                <div><label style={lbl}>Ссылка на номер</label><input style={field} value={room.room_link || ''} onChange={(e) => patchRoomLocal(room.id, { room_link: e.target.value })} onBlur={(e) => saveRoom(room.id, { room_link: e.target.value })} placeholder="https://…" /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Примечание к номеру (необязательно)</label><input style={field} value={room.room_note || ''} onChange={(e) => patchRoomLocal(room.id, { room_note: e.target.value })} onBlur={(e) => saveRoom(room.id, { room_note: e.target.value })} placeholder="напр. 2 номера Outer-connecting…" /></div>
              </div>

              {/* quotes comparison */}
              <div style={{ fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', fontWeight: 700, marginBottom: '8px' }}>Сравнение цен</div>
              <div className="adm-tscroll">
                <table className="adm-table" style={{ marginBottom: '2px' }}>
                  <thead><tr>
                    <th style={{ width: '34px' }}>Акт.</th><th>Источник</th><th>Партнёр</th><th>Цена</th><th>Валюта</th><th>Комис.%</th><th style={{ width: '34px' }}> </th>
                  </tr></thead>
                  <tbody>
                    {(room.quotes || []).map((q) => (
                      <tr key={q.id} style={q.is_chosen ? { background: '#F3EEDF' } : undefined}>
                        <td>
                          <button aria-label="актуальная" onClick={() => setChosen(room.id, q.id)}
                            style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${q.is_chosen ? 'var(--admin-gold-soft)' : 'var(--admin-border-hover)'}`, background: q.is_chosen ? 'radial-gradient(circle, var(--admin-gold-soft) 0 45%, transparent 47%)' : 'transparent', cursor: 'pointer', padding: 0 }} />
                        </td>
                        <td>
                          <select value={q.source} onChange={(e) => { patchQuoteLocal(room.id, q.id, { source: e.target.value }); saveQuote(q.id, { source: e.target.value }) }}
                            style={{ ...field, padding: '5px 7px', width: 'auto' }}>
                            {SOURCES.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                          </select>
                        </td>
                        <td>
                          {q.source === 'netto' ? (
                            <select value={q.partner_id || ''} onChange={(e) => { patchQuoteLocal(room.id, q.id, { partner_id: e.target.value || null }); saveQuote(q.id, { partner_id: e.target.value || null }) }}
                              style={{ ...field, padding: '5px 7px', width: 'auto', minWidth: '130px' }}>
                              <option value="">— партнёр —</option>
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
                          ? <input inputMode="decimal" defaultValue={q.commission_pct ?? ''} onBlur={(e) => { const v = num(e.target.value); patchQuoteLocal(room.id, q.id, { commission_pct: v }); saveQuote(q.id, { commission_pct: v }) }} style={{ ...field, padding: '5px 7px', width: '60px' }} />
                          : <span className="adm-cell-faint">—</span>}</td>
                        <td className="adm-right"><button className="adm-dots" title="Удалить" onClick={() => delQuote(room.id, q.id)}>✕</button></td>
                      </tr>
                    ))}
                    {(room.quotes || []).length === 0 && (
                      <tr><td colSpan={7} className="adm-cell-faint" style={{ textAlign: 'center', padding: '10px' }}>Котировок нет</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: '8px', margin: '8px 0 14px', flexWrap: 'wrap' }}>
                {SOURCES.map((s) => (
                  <button key={s.v} onClick={() => addQuote(room.id, s.v)} style={{ fontSize: '12px', color: 'var(--admin-accent)', background: 'none', border: '1px dashed var(--admin-border-hover)', borderRadius: '7px', padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>+ {s.label}</button>
                ))}
              </div>

              {/* client price + extra */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--admin-border-card)' }}>
                <div><label style={lbl}>Цена клиенту</label><input inputMode="decimal" defaultValue={room.sale_price ?? ''} onBlur={(e) => { const v = num(e.target.value); patchRoomLocal(room.id, { sale_price: v }); saveRoom(room.id, { sale_price: v }) }} style={field} /></div>
                <div><label style={lbl}>Валюта</label>
                  <select value={room.sale_currency || 'EUR'} onChange={(e) => { patchRoomLocal(room.id, { sale_currency: e.target.value }); saveRoom(room.id, { sale_currency: e.target.value }) }} style={field}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Доп. строка (необяз.)</label><input defaultValue={room.extra_label ?? ''} onBlur={(e) => { patchRoomLocal(room.id, { extra_label: e.target.value }); saveRoom(room.id, { extra_label: e.target.value || null }) }} style={field} placeholder="Дополнительный номер" /></div>
                <div><label style={lbl}>Доп. цена</label><input inputMode="decimal" defaultValue={room.extra_price ?? ''} onBlur={(e) => { const v = num(e.target.value); patchRoomLocal(room.id, { extra_price: v }); saveRoom(room.id, { extra_price: v }) }} style={field} /></div>
              </div>
            </div>
          ))}

          <button onClick={addRoom} style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px dashed var(--admin-border-hover)', borderRadius: '10px', color: 'var(--admin-text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600 }}>+ Добавить номер</button>
        </div>

        {/* RIGHT: whatsapp preview */}
        <div style={{ position: 'sticky', top: '16px' }} className="offer-wa">
          <div style={{ background: '#fff', border: '1px solid var(--admin-border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ background: 'var(--admin-head)', padding: '10px 14px', fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Превью для WhatsApp</span>
              <button onClick={copy} style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 600, background: '#25623b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>{copied ? 'Скопировано ✓' : 'Скопировать'}</button>
            </div>
            <pre ref={copyRef} style={{ margin: 0, padding: '16px', fontFamily: 'inherit', fontSize: '13px', lineHeight: 1.55, color: '#2C2C2A', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{waText || 'Заполните отель и номера — текст появится здесь.'}</pre>
          </div>
          <p style={{ fontSize: '11.5px', color: 'var(--admin-text-faint)', marginTop: '8px', lineHeight: 1.5 }}>
            Внутренний вариант — с нетто/букинг/отель. Клиенту уйдёт «Симпл» (только цена) — добавим следующим шагом.
          </p>
        </div>
      </div>

      <style>{`@media (max-width: 900px){ .offer-cols{ grid-template-columns: 1fr !important } .offer-wa{ position: static !important } }`}</style>
    </div>
  )
}
