'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { buildOfferText, type Lang } from '@/lib/offer-text'
import { useT, useLang } from '@/lib/i18n-client'

type Room = {
  id: string; room_type: string | null; room_link: string | null; room_note: string | null
  price: number | null; currency: string | null; sort_order: number | null
}
type Simple = {
  id: string; title: string | null; hotel_name: string | null; date_from: string | null; date_to: string | null
  occupancy: string | null; meal: string | null; status: string | null; simple_rooms?: Room[]
}
type HotelRoom = { ru: string; en: string }
type Hotel = { name: string; link: string; rooms: HotelRoom[] }

const CURRENCIES = ['EUR', 'USD', 'AED', 'GBP']
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

export default function SimpleEditor({ simple, hotels = [] }: { simple: Simple; hotels?: Hotel[] }) {
  const t = useT()
  const lang = useLang() as Lang
  const simpleId = simple.id

  const [hdr, setHdr] = useState({
    title: simple.title || '', hotel_name: simple.hotel_name || '',
    date_from: simple.date_from || '', date_to: simple.date_to || '',
    occupancy: simple.occupancy || '', meal: simple.meal || '', status: simple.status || 'draft',
  })
  const initRooms: Room[] = useMemo(() => [...(simple.simple_rooms || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), [simple.simple_rooms])
  const [rooms, setRooms] = useState<Room[]>(initRooms)
  const [copied, setCopied] = useState(false)

  const mealLabel = (key: string) => MEALS.find((m) => m.key === key)?.[lang] || key

  // номера из библиотеки для выбранного отеля (подсказки категорий)
  const hotelRooms = useMemo(() => {
    const h = hotels.find((x) => x.name.trim().toLowerCase() === hdr.hotel_name.trim().toLowerCase())
    return (h?.rooms || []).map((r) => (lang === 'ru' ? (r.ru || r.en) : (r.en || r.ru))).filter(Boolean)
  }, [hotels, hdr.hotel_name, lang])

  async function api(body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/simple/${simpleId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      return res.ok ? await res.json() : null
    } catch { return null }
  }
  function setH<K extends keyof typeof hdr>(k: K, v: string) { setHdr((p) => ({ ...p, [k]: v })) }
  function saveH(k: keyof typeof hdr, v: string) { api({ op: 'simple_update', patch: { [k]: v || null } }) }

  async function addRoom() {
    const res = await api({ op: 'room_add' })
    if (res?.room) setRooms((p) => [...p, res.room])
  }
  function patchRoomLocal(roomId: string, patch: Partial<Room>) { setRooms((p) => p.map((r) => (r.id === roomId ? { ...r, ...patch } : r))) }
  function saveRoom(roomId: string, patch: Record<string, unknown>) { api({ op: 'room_update', roomId, patch }) }
  async function delRoom(roomId: string) {
    if (!confirm(t('Delete this room?', 'Удалить номер?'))) return
    setRooms((p) => p.filter((r) => r.id !== roomId))
    await api({ op: 'room_delete', roomId })
  }

  const waText = useMemo(() => buildOfferText({
    hotel_name: hdr.hotel_name, date_from: hdr.date_from, date_to: hdr.date_to, occupancy: hdr.occupancy, meal: mealLabel(hdr.meal),
    rooms: rooms.map((r) => ({ room_type: r.room_type, room_link: r.room_link, room_note: r.room_note, sale_price: r.price, sale_currency: r.currency })),
  }, 'client', lang), [hdr, rooms, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  function copy() { navigator.clipboard?.writeText(waText); setCopied(true); setTimeout(() => setCopied(false), 1400) }
  function renderWa(text: string) {
    return text.split('\n').map((line, i) => {
      const m = line.match(/^\*(.+)\*$/)
      return <span key={i}>{m ? <strong>{m[1]}</strong> : line}{'\n'}</span>
    })
  }

  return (
    <div style={{ maxWidth: '820px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 4px' }}>{hdr.hotel_name || t('Simple proposal', 'Симпл-пропозал')}</h1>
          <p style={{ color: 'var(--admin-text-muted)', margin: '0 0 18px', fontSize: '13px' }}>
            {t('What the client gets — only the client price. The WhatsApp text is below.', 'Что уходит клиенту — только цена клиенту. Текст для WhatsApp ниже.')}
          </p>
        </div>
        <Link href="/admin/simple" style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600, background: 'transparent', color: 'var(--admin-text)', border: '1px solid var(--admin-border-hover)', borderRadius: '9px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          {t('Done', 'Готово')}
        </Link>
      </div>

      <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border-card)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>{t('Hotel', 'Отель')}</label>
            <input style={field} list="simple-hotels" value={hdr.hotel_name} onChange={(e) => setH('hotel_name', e.target.value)} onBlur={(e) => saveH('hotel_name', e.target.value)} placeholder={t('choose from the library or type your own', 'выбрать из базы или вписать вручную')} />
            <datalist id="simple-hotels">{hotels.map((h) => <option key={h.name} value={h.name} />)}</datalist>
          </div>
          <div><label style={lbl}>{t('Date from', 'Дата с')}</label><input type="date" style={field} value={hdr.date_from} onChange={(e) => { setH('date_from', e.target.value); saveH('date_from', e.target.value) }} /></div>
          <div><label style={lbl}>{t('Date to', 'Дата по')}</label><input type="date" style={field} value={hdr.date_to} onChange={(e) => { setH('date_to', e.target.value); saveH('date_to', e.target.value) }} /></div>
          <div><label style={lbl}>{t('Occupancy', 'Размещение')}</label><input style={field} value={hdr.occupancy} onChange={(e) => setH('occupancy', e.target.value)} onBlur={(e) => saveH('occupancy', e.target.value)} /></div>
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

      <datalist id="simple-rooms">{hotelRooms.map((r) => <option key={r} value={r} />)}</datalist>

      {rooms.map((room, idx) => (
        <div key={room.id} style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border-card)', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--admin-sidebar)', color: '#F5EFE4', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{idx + 1}</span>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>{t('Room', 'Номер')} {idx + 1}</span>
            <button onClick={() => delRoom(room.id)} className="adm-dots" title={t('Delete room', 'Удалить номер')} style={{ marginLeft: 'auto' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
            <div><label style={lbl}>{t('Room category', 'Категория номера')}</label><input style={field} list="simple-rooms" value={room.room_type || ''} onChange={(e) => patchRoomLocal(room.id, { room_type: e.target.value })} onBlur={(e) => saveRoom(room.id, { room_type: e.target.value })} placeholder={t('from the library or type your own', 'из базы или вписать вручную')} /></div>
            <div><label style={lbl}>{t('Room link', 'Ссылка на номер')}</label><input style={field} value={room.room_link || ''} onChange={(e) => patchRoomLocal(room.id, { room_link: e.target.value })} onBlur={(e) => saveRoom(room.id, { room_link: e.target.value })} placeholder="https://…" /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>{t('Room note (optional)', 'Примечание к номеру (необязательно)')}</label><input style={field} value={room.room_note || ''} onChange={(e) => patchRoomLocal(room.id, { room_note: e.target.value })} onBlur={(e) => saveRoom(room.id, { room_note: e.target.value })} /></div>
            <div><label style={lbl}>{t('Client price', 'Цена клиенту')}</label><input inputMode="decimal" defaultValue={room.price ?? ''} onBlur={(e) => { const v = num(e.target.value); patchRoomLocal(room.id, { price: v }); saveRoom(room.id, { price: v }) }} style={field} /></div>
            <div><label style={lbl}>{t('Currency', 'Валюта')}</label>
              <select value={room.currency || 'EUR'} onChange={(e) => { patchRoomLocal(room.id, { currency: e.target.value }); saveRoom(room.id, { currency: e.target.value }) }} style={field}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      ))}

      <button onClick={addRoom} style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px dashed var(--admin-border-hover)', borderRadius: '10px', color: 'var(--admin-text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, marginBottom: '20px' }}>+ {t('Add room', 'Добавить номер')}</button>

      <div style={{ background: '#fff', border: '1px solid var(--admin-border)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ background: 'var(--admin-head)', padding: '10px 14px', fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('Text for the client', 'Текст для клиента')}</span>
          <button onClick={copy} style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 600, background: '#25623b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>{copied ? t('Copied ✓', 'Скопировано ✓') : t('Copy', 'Скопировать')}</button>
        </div>
        <pre style={{ margin: 0, padding: '16px', fontFamily: 'inherit', fontSize: '13px', lineHeight: 1.55, color: '#2C2C2A', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{waText ? renderWa(waText) : t('Fill in the hotel and rooms — the text will appear here.', 'Заполните отель и номера — текст появится здесь.')}</pre>
      </div>
      <p style={{ fontSize: '11.5px', color: 'var(--admin-text-faint)', marginTop: '8px', lineHeight: 1.5 }}>
        {t('Only the client price. Net / booking / hotel / partners stay in the offer.', 'Только цена клиенту. Нетто / букинг / отель / партнёры остаются в оффере.')}
      </p>
    </div>
  )
}
