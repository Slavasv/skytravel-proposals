'use client'

import { useState, useEffect, useRef } from 'react'
import { updateSection, getBlockBrief, type BlockBrief } from './destination-actions'
import type { DestinationSection } from './destination-actions'
import SectionBlockPicker from './section-block-picker'
import { normalizeRooms, type Room } from '@/app/admin/library/[id]/rooms-editor'

type Lang = 'ru' | 'en'

type HotelData = {
  room_ids?: string[]          // какие номера показывать (id из rooms отеля); пусто = все
  activities_ru?: string
  activities_en?: string
}

function getHotelData(data: unknown): HotelData {
  if (data && typeof data === 'object') return data as HotelData
  return {}
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

export default function SectionHotel({
  section,
  lang,
  onLocalChange,
}: {
  section: DestinationSection
  lang: Lang
  onLocalChange: (patch: Partial<DestinationSection>) => void
}) {
  const initial = getHotelData(section.data)
  const [hotelBlockId, setHotelBlockId] = useState<string | null>(section.hotel_block_id)
  const [brief, setBrief] = useState<BlockBrief | null>(null)
  const [loadingBrief, setLoadingBrief] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [roomIds, setRoomIds] = useState<string[]>(initial.room_ids ?? [])
  const [actRu, setActRu] = useState(initial.activities_ru ?? '')
  const [actEn, setActEn] = useState(initial.activities_en ?? '')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)

  // превью выбранного отеля
  useEffect(() => {
    let cancelled = false
    if (!hotelBlockId) { setBrief(null); return }
    setLoadingBrief(true)
    getBlockBrief(hotelBlockId)
      .then((b) => { if (!cancelled) setBrief(b) })
      .finally(() => { if (!cancelled) setLoadingBrief(false) })
    return () => { cancelled = true }
  }, [hotelBlockId])

  // автосейв data (room_ids + activities)
  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return }
    setSaveState('saving')
    const data: HotelData = { room_ids: roomIds, activities_ru: actRu, activities_en: actEn }
    onLocalChange({ data })
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await updateSection(section.id, { data })
      setSaveState('saved')
    }, 1000)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomIds, actRu, actEn])

  async function handleSelect(blockId: string) {
    setHotelBlockId(blockId)
    setRoomIds([]) // сброс выбранных номеров при смене отеля
    onLocalChange({ hotel_block_id: blockId })
    await updateSection(section.id, { hotel_block_id: blockId })
  }
  async function handleClear() {
    setHotelBlockId(null)
    setBrief(null)
    onLocalChange({ hotel_block_id: null })
    await updateSection(section.id, { hotel_block_id: null })
  }

  const returnTo = `/admin/destinations/${section.proposal_id}`
  const title = brief ? (lang === 'ru' ? brief.title_ru : brief.title_en) : ''
  const rooms: Room[] = brief ? normalizeRooms(brief.rooms) : []

  function toggleRoom(id: string) {
    setRoomIds((prev) => {
      // пусто = все показаны; первый клик превращает в явный список без этого номера
      if (prev.length === 0) return rooms.filter((r) => r.id !== id).map((r) => r.id)
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    })
  }
  const isRoomShown = (id: string) => roomIds.length === 0 || roomIds.includes(id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '12px' }}>
      <div>
        <label style={labelStyle}>Hotel block</label>
        {!hotelBlockId ? (
          <button type="button" onClick={() => setPickerOpen(true)}
            style={{ width: '100%', padding: '12px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            + Choose a hotel from library
          </button>
        ) : (
          <div style={{ border: '1px solid var(--admin-border-card)', borderRadius: '8px', padding: '12px', background: 'var(--admin-input)' }}>
            {loadingBrief ? (
              <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>Loading...</div>
            ) : brief ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '6px', flexShrink: 0, background: brief.image_url ? `url(${brief.image_url}) center/cover no-repeat` : 'var(--admin-card)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--admin-text)' }}>
                    {title || <span style={{ color: 'var(--admin-text-muted)', fontStyle: 'italic' }}>Untitled</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                    {rooms.length} {rooms.length === 1 ? 'room type' : 'room types'}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--admin-danger)' }}>Hotel block not found (deleted?).</div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button type="button" onClick={() => setPickerOpen(true)}
                style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--admin-text)', background: 'transparent', border: '1px solid var(--admin-border)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>Change</button>
              {brief && (
                <a href={`/admin/library/${brief.id}?returnTo=${encodeURIComponent(returnTo)}`}
                  style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--admin-text)', background: 'transparent', border: '1px solid var(--admin-border)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>Edit hotel →</a>
              )}
              <button type="button" onClick={handleClear}
                style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--admin-danger)', background: 'transparent', border: '1px solid var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
            </div>
          </div>
        )}
      </div>

      {/* Выбор номеров для показа */}
      {hotelBlockId && rooms.length > 0 && (
        <div>
          <label style={labelStyle}>Rooms to show</label>
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 8px' }}>
            All shown by default. Uncheck to hide a room type on this page.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {rooms.map((r) => {
              const rt = lang === 'ru' ? r.title_ru : r.title_en
              const rs = lang === 'ru' ? r.subtitle_ru : r.subtitle_en
              return (
                <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', background: isRoomShown(r.id) ? 'var(--admin-input)' : 'transparent', opacity: isRoomShown(r.id) ? 1 : 0.5 }}>
                  <input type="checkbox" checked={isRoomShown(r.id)} onChange={() => toggleRoom(r.id)} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--admin-text)' }}>{rt || 'Untitled room'}</span>
                    {rs && <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}> · {rs}</span>}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Активности отеля — простой текст */}
      {hotelBlockId && (
        <div>
          <label style={labelStyle}>Hotel activities (optional) · {lang.toUpperCase()}</label>
          {lang === 'ru' ? (
            <textarea value={actRu} onChange={(e) => setActRu(e.target.value)} rows={5}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              placeholder={'Утренние и вечерние выезды на сафари\nПешее сафари\nУжин в буше'} />
          ) : (
            <textarea value={actEn} onChange={(e) => setActEn(e.target.value)} rows={5}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              placeholder={'Morning and evening game drives\nWalking safari\nBush dinner'} />
          )}
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>One activity per line.</p>
        </div>
      )}

      <div style={{ fontSize: '11px', color: saveState === 'saved' ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
        {saveState === 'saving' ? '● Saving...' : saveState === 'saved' ? '● Saved' : ''}
      </div>

      <SectionBlockPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
        blockType="hotel"
        lang={lang}
        returnTo={returnTo}
        title={lang === 'ru' ? 'Выберите отель' : 'Choose a hotel'}
        attachKind="hotel"
        attachSectionId={section.id}
      />
    </div>
  )
}