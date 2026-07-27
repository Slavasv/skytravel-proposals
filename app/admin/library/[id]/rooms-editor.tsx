'use client'

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import GalleryUploader from './gallery-uploader'
import { normalizePhotos, type Photo } from '@/lib/photos'

export type Room = {
  id: string
  title_ru: string
  title_en: string
  subtitle_ru: string
  subtitle_en: string
  images: Photo[]
}

type Lang = 'ru' | 'en'

export function normalizeRooms(data: unknown): Room[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      id: typeof x.id === 'string' ? x.id : Math.random().toString(36).slice(2),
      title_ru: typeof x.title_ru === 'string' ? x.title_ru : '',
      title_en: typeof x.title_en === 'string' ? x.title_en : '',
      subtitle_ru: typeof x.subtitle_ru === 'string' ? x.subtitle_ru : '',
      subtitle_en: typeof x.subtitle_en === 'string' ? x.subtitle_en : '',
      images: normalizePhotos(x.images),
    }))
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

function SortableRoom({
  room,
  lang,
  onChange,
  onRemove,
}: {
  room: Room
  lang: Lang
  onChange: (id: string, patch: Partial<Room>) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: room.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    border: '1px solid var(--admin-border-card)',
    borderRadius: '8px',
    padding: '14px',
    marginBottom: '12px',
    background: 'var(--admin-input)',
  }
  const titleKey = lang === 'ru' ? 'title_ru' : 'title_en'
  const subKey = lang === 'ru' ? 'subtitle_ru' : 'subtitle_en'

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <button type="button" {...attributes} {...listeners} aria-label="Drag"
          style={{ background: 'transparent', border: 'none', cursor: 'grab', color: 'var(--admin-text-muted)', fontSize: '14px', padding: '2px 4px', touchAction: 'none', fontFamily: 'inherit' }}>⋮⋮</button>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-text-muted)', flex: 1 }}>Room</span>
        <button type="button" onClick={() => onRemove(room.id)}
          style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '6px 8px', fontFamily: 'inherit' }}>✕ Remove</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={labelStyle}>Room name · {lang.toUpperCase()}</label>
          <input type="text" value={room[titleKey]} onChange={(e) => onChange(room.id, { [titleKey]: e.target.value })}
            style={inputStyle} placeholder={lang === 'ru' ? 'Executive Suite' : 'Executive Suite'} />
        </div>
        <div>
          <label style={labelStyle}>Subtitle · {lang.toUpperCase()}</label>
          <input type="text" value={room[subKey]} onChange={(e) => onChange(room.id, { [subKey]: e.target.value })}
            style={inputStyle} placeholder={lang === 'ru' ? '80 кв.м., кровати кинг или твин' : '80 sqm, king or twin beds'} />
        </div>
        <div>
          <label style={labelStyle}>Room photos</label>
          <GalleryUploader images={room.images} onChange={(imgs) => onChange(room.id, { images: imgs })} lang={lang} />
        </div>
      </div>
    </div>
  )
}

export default function RoomsEditor({
  rooms,
  lang,
  onChange,
}: {
  rooms: Room[]
  lang: Lang
  onChange: (rooms: Room[]) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function addRoom() {
    onChange([...rooms, { id: Math.random().toString(36).slice(2), title_ru: '', title_en: '', subtitle_ru: '', subtitle_en: '', images: [] }])
  }
  function changeRoom(id: string, patch: Partial<Room>) {
    onChange(rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  function removeRoom(id: string) {
    onChange(rooms.filter((r) => r.id !== id))
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = rooms.findIndex((r) => r.id === active.id)
    const newIndex = rooms.findIndex((r) => r.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    onChange(arrayMove(rooms, oldIndex, newIndex))
  }

  return (
    <div>
      {rooms.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rooms.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div>
              {rooms.map((r) => (
                <SortableRoom key={r.id} room={r} lang={lang} onChange={changeRoom} onRemove={removeRoom} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <p style={{ fontSize: '12px', color: 'var(--admin-text-faint)', margin: '0 0 8px' }}>No rooms yet.</p>
      )}
      <button type="button" onClick={addRoom}
        style={{ padding: '8px 14px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
        + Add room
      </button>
    </div>
  )
}