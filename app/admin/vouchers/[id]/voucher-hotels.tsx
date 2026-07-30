'use client'

import { useState, useEffect, useRef } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  addHotel, updateHotel, deleteHotel, duplicateHotel, reorderHotels, type VoucherHotel,
} from './voucher-actions'
import DateInput from '@/app/admin/_components/date-input'
import { useT } from '@/lib/i18n-client'

// парсинг ДД/ММ/ГГГГ (или ДД.ММ.ГГГГ)
function parseDMY(str: string): Date | null {
  const m = str.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (!m) return null
  const d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10)
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

// ночей между заездом и выездом (null если не распарсить)
function calcNights(checkIn: string, checkOut: string): number | null {
  const a = parseDMY(checkIn), b = parseDMY(checkOut)
  if (!a || !b) return null
  const diff = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : null
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', marginBottom: '5px', fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', fontSize: '14px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

type Field = keyof Omit<VoucherHotel, 'id' | 'voucher_id' | 'sort_order'>

function HotelCard({
  hotel, index, onRemove, onAddRoom, onCheckoutChange,
}: {
  hotel: VoucherHotel
  index: number
  onRemove: (id: string) => void
  onAddRoom: (id: string) => void
  onCheckoutChange: (id: string, checkOut: string) => void
}) {
  const t = useT()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: hotel.id })
  const [form, setForm] = useState({
    city: hotel.city || '',
    country: hotel.country || '',
    booking_ref: hotel.booking_ref || '',
    name: hotel.name || '',
    address: hotel.address || '',
    phone: hotel.phone || '',
    check_in: hotel.check_in || '',
    check_out: hotel.check_out || '',
    nights: hotel.nights || '',
    room_type: hotel.room_type || '',
    meal_plan: hotel.meal_plan || '',
    extras: hotel.extras || '',
  })
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)

  function set(field: Field, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // сообщаем дату выезда наверх (для расчёта возраста детей в реальном времени)
  useEffect(() => {
    onCheckoutChange(hotel.id, form.check_out)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.check_out])

  // авто-расчёт ночей
  const autoNights = calcNights(form.check_in, form.check_out)
  const nightsDisplay = autoNights != null ? String(autoNights) : (form.nights || '')

  // если авто-ночи посчитались и отличаются от сохранённого — обновим (попадёт в автосейв)
  useEffect(() => {
    if (autoNights != null && String(autoNights) !== form.nights) {
      setForm((prev) => ({ ...prev, nights: String(autoNights) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNights])

  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return }
    setSaveState('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await updateHotel(hotel.id, {
        city: form.city || null,
        country: form.country || null,
        booking_ref: form.booking_ref || null,
        name: form.name || null,
        address: form.address || null,
        phone: form.phone || null,
        check_in: form.check_in || null,
        check_out: form.check_out || null,
        nights: form.nights || null,
        room_type: form.room_type || null,
        meal_plan: form.meal_plan || null,
        extras: form.extras || null,
      })
      setSaveState('saved')
    }, 1200)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    border: '1px solid var(--admin-border-card)', borderRadius: '10px',
    padding: '16px', marginBottom: '12px', background: 'var(--admin-card)',
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <button type="button" {...attributes} {...listeners} aria-label={t('Drag', 'Перетащить')}
          style={{ background: 'transparent', border: 'none', cursor: 'grab', color: 'var(--admin-text-muted)', fontSize: '14px', padding: '2px 4px', touchAction: 'none', fontFamily: 'inherit' }}>⋮⋮</button>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', flex: 1 }}>
          {t('Hotel', 'Отель')} {index + 1}{form.name ? ` · ${form.name}` : ''}
        </span>
        <span style={{ fontSize: '11px', color: saveState === 'saved' ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
          {saveState === 'saving' ? t('● Saving...', '● Сохранение...') : saveState === 'saved' ? t('● Saved', '● Сохранено') : ''}
        </span>
        <button type="button" onClick={() => onAddRoom(hotel.id)}
          title={t('Duplicate this hotel block as another room', 'Дублировать этот блок отеля как ещё один номер')}
          style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-accent)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '6px 8px', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{t('+ Add room', '+ Добавить номер')}</button>
        <button type="button" onClick={() => onRemove(hotel.id)}
          style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '6px 8px', fontFamily: 'inherit' }}>{t('✕ Remove', '✕ Удалить')}</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>{t('City', 'Город')}</label>
            <input type="text" value={form.city} onChange={(e) => set('city', e.target.value)} style={inputStyle} placeholder="Dubai" />
          </div>
          <div>
            <label style={labelStyle}>{t('Country', 'Страна')}</label>
            <input type="text" value={form.country} onChange={(e) => set('country', e.target.value)} style={inputStyle} placeholder="UAE" />
          </div>
        </div>
        <div>
          <label style={labelStyle}>{t('Hotel name', 'Название отеля')}</label>
          <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} style={inputStyle} placeholder="Grand Hotel Villa Cortine" />
        </div>
        <div>
          <label style={labelStyle}>{t('Address', 'Адрес')}</label>
          <input type="text" value={form.address} onChange={(e) => set('address', e.target.value)} style={inputStyle} placeholder="Viale C. Gennari 2, 25019 Sirmione (BS), Italy" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>{t('Phone', 'Телефон')}</label>
            <input type="text" value={form.phone} onChange={(e) => set('phone', e.target.value)} style={inputStyle} placeholder="+39 030 990 5890" />
          </div>
          <div>
            <label style={labelStyle}>{t('Booking Ref.', 'Номер брони')}</label>
            <input type="text" value={form.booking_ref} onChange={(e) => set('booking_ref', e.target.value)} style={inputStyle} placeholder="3245678" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>{t('Check-in', 'Заезд')}</label>
            <DateInput value={form.check_in} onChange={(v) => set('check_in', v)} />
          </div>
          <div>
            <label style={labelStyle}>{t('Check-out', 'Выезд')}</label>
            <DateInput value={form.check_out} onChange={(v) => set('check_out', v)} />
          </div>
          <div>
            <label style={labelStyle}>{t('Nights', 'Ночей')} {autoNights != null && <span style={{ color: 'var(--admin-success)', textTransform: 'none', letterSpacing: 0 }}>{t('· auto', '· авто')}</span>}</label>
            <input type="text" value={nightsDisplay} onChange={(e) => set('nights', e.target.value)} readOnly={autoNights != null} style={{ ...inputStyle, opacity: autoNights != null ? 0.7 : 1, cursor: autoNights != null ? 'default' : 'text' }} placeholder="10" title={autoNights != null ? t('Calculated from check-in / check-out', 'Рассчитано по датам заезда и выезда') : t('Enter dates as DD/MM/YYYY to auto-calculate', 'Введите даты в формате ДД/ММ/ГГГГ для автоматического расчёта')} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>{t('Room type', 'Тип номера')}</label>
            <input type="text" value={form.room_type} onChange={(e) => set('room_type', e.target.value)} style={inputStyle} placeholder="Deluxe Lake View" />
          </div>
          <div>
            <label style={labelStyle}>{t('Meal plan', 'Питание')}</label>
            <input type="text" list="meal-plan-options" value={form.meal_plan} onChange={(e) => set('meal_plan', e.target.value)} style={inputStyle} placeholder={t('Select or type...', 'Выберите или введите...')} />
            <datalist id="meal-plan-options">
              <option value="Room Only" />
              <option value="Breakfast" />
              <option value="Half Board" />
              <option value="Full Board" />
            </datalist>
          </div>
        </div>

        <div>
          <label style={labelStyle}>{t('Extra services / notes (optional)', 'Дополнительные услуги / примечания (необязательно)')}</label>
          <textarea value={form.extras} onChange={(e) => set('extras', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder="Airport transfer, spa access..." />
        </div>
      </div>
    </div>
  )
}

export default function VoucherHotels({
  voucherId, initialHotels, onCheckoutsChange,
}: {
  voucherId: string
  initialHotels: VoucherHotel[]
  onCheckoutsChange?: (checkouts: string[]) => void
}) {
  const t = useT()
  const [hotels, setHotels] = useState<VoucherHotel[]>(initialHotels)
  const checkoutsRef = useRef<Record<string, string>>({})
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleCheckoutChange(id: string, checkOut: string) {
    checkoutsRef.current[id] = checkOut
    if (onCheckoutsChange) onCheckoutsChange(Object.values(checkoutsRef.current))
  }

  async function handleAdd() {
    const created = await addHotel(voucherId)
    if (created) setHotels((prev) => [...prev, created])
  }
  async function handleRemove(id: string) {
    if (!confirm(t('Remove this hotel?', 'Удалить этот отель?'))) return
    delete checkoutsRef.current[id]
    if (onCheckoutsChange) onCheckoutsChange(Object.values(checkoutsRef.current))
    setHotels((prev) => prev.filter((h) => h.id !== id))
    await deleteHotel(id)
  }

  // "+ Add room" — дублирует блок отеля, новая карточка встаёт сразу под ним
  async function handleAddRoom(id: string) {
    const created = await duplicateHotel(id)
    if (!created) return
    setHotels((prev) => {
      const idx = prev.findIndex((h) => h.id === id)
      if (idx === -1) return [...prev, created]
      const next = [...prev]
      next.splice(idx + 1, 0, created)
      return next
    })
  }
  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = hotels.findIndex((h) => h.id === active.id)
    const newIndex = hotels.findIndex((h) => h.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const next = arrayMove(hotels, oldIndex, newIndex)
    setHotels(next)
    await reorderHotels(next.map((h) => h.id))
  }

  return (
    <div>
      {hotels.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={hotels.map((h) => h.id)} strategy={verticalListSortingStrategy}>
            <div>
              {hotels.map((h, i) => (
                <HotelCard key={h.id} hotel={h} index={i} onRemove={handleRemove} onAddRoom={handleAddRoom} onCheckoutChange={handleCheckoutChange} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <button type="button" onClick={handleAdd}
        style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', marginTop: hotels.length > 0 ? '4px' : '0' }}>
        {t('+ Add hotel', '+ Добавить отель')}
      </button>
    </div>
  )
}