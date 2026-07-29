'use client'

import { useState, useEffect, useRef } from 'react'
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
import ImageUploader from '@/app/admin/_components/image-uploader'
import { updateSection } from './destination-actions'
import type { DestinationSection } from './destination-actions'

type Lang = 'ru' | 'en'

type TimelineItem = {
  id: string
  time: string
  text_ru: string
  text_en: string
}

function getItems(data: unknown): TimelineItem[] {
  if (data && typeof data === 'object' && 'items' in data) {
    const items = (data as { items?: unknown }).items
    if (Array.isArray(items)) {
      return items
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => ({
          id: typeof x.id === 'string' ? x.id : Math.random().toString(36).slice(2),
          time: typeof x.time === 'string' ? x.time : '',
          text_ru: typeof x.text_ru === 'string' ? x.text_ru : '',
          text_en: typeof x.text_en === 'string' ? x.text_en : '',
        }))
    }
  }
  return []
}

function getStr(data: unknown, key: string): string {
  if (data && typeof data === 'object' && key in data) {
    const v = (data as Record<string, unknown>)[key]
    return typeof v === 'string' ? v : ''
  }
  return ''
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px', fontSize: '14px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', marginBottom: '6px', fontWeight: 500,
}

function SortableRow({
  item,
  lang,
  onChange,
  onRemove,
}: {
  item: TimelineItem
  lang: Lang
  onChange: (id: string, patch: Partial<TimelineItem>) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    display: 'grid',
    gridTemplateColumns: 'auto 90px 1fr auto',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '8px',
  }
  const textKey = lang === 'ru' ? 'text_ru' : 'text_en'
  return (
    <div ref={setNodeRef} style={style}>
      <button type="button" {...attributes} {...listeners} aria-label="Drag"
        style={{ background: 'transparent', border: 'none', cursor: 'grab', color: 'var(--admin-text-muted)', fontSize: '14px', padding: '2px 4px', touchAction: 'none', fontFamily: 'inherit' }}>
        ⋮⋮
      </button>
      <input type="text" value={item.time} onChange={(e) => onChange(item.id, { time: e.target.value })} style={inputStyle} placeholder="05:30" />
      <input type="text" value={item[textKey]} onChange={(e) => onChange(item.id, { [textKey]: e.target.value })} style={inputStyle} placeholder={lang === 'ru' ? 'Кофе на рассвете' : 'Coffee at dawn'} />
      <button type="button" onClick={() => onRemove(item.id)}
        style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '6px 8px', fontFamily: 'inherit' }}>
        ✕
      </button>
    </div>
  )
}

export default function SectionSampleDay({
  section,
  lang,
  onLocalChange,
}: {
  section: DestinationSection
  lang: Lang
  onLocalChange: (patch: Partial<DestinationSection>) => void
}) {
  const [items, setItems] = useState<TimelineItem[]>(getItems(section.data))
  const [titleRu, setTitleRu] = useState(section.title_ru || '')
  const [titleEn, setTitleEn] = useState(section.title_en || '')
  const [imageLeft, setImageLeft] = useState(getStr(section.data, 'image_left'))
  const [imageRight, setImageRight] = useState(getStr(section.data, 'image_right'))
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)

  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return }
    setSaveState('saving')
    const payload = { items, image_left: imageLeft, image_right: imageRight }
    onLocalChange({ title_ru: titleRu || null, title_en: titleEn || null, data: payload })
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await updateSection(section.id, {
        title_ru: titleRu || null,
        title_en: titleEn || null,
        data: payload,
      })
      setSaveState('saved')
    }, 1200)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, titleRu, titleEn, imageLeft, imageRight])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function addRow() {
    setItems((prev) => [...prev, { id: Math.random().toString(36).slice(2), time: '', text_ru: '', text_en: '' }])
  }
  function changeRow(id: string, patch: Partial<TimelineItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }
  function removeRow(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    setItems((prev) => arrayMove(prev, oldIndex, newIndex))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '12px' }}>
      <div>
        <label style={labelStyle}>Section title (optional) · {lang.toUpperCase()}</label>
        {lang === 'ru' ? (
          <input type="text" value={titleRu} onChange={(e) => setTitleRu(e.target.value)} style={{ ...inputStyle, width: '100%' }} placeholder="Например: Обычный день в буше" />
        ) : (
          <input type="text" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} style={{ ...inputStyle, width: '100%' }} placeholder="e.g.: A typical day in the bush" />
        )}
      </div>

      <div>
        <label style={labelStyle}>Timeline</label>
        {items.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div>
                {items.map((it) => (
                  <SortableRow key={it.id} item={it} lang={lang} onChange={changeRow} onRemove={removeRow} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <p style={{ fontSize: '12px', color: 'var(--admin-text-faint)', margin: '0 0 8px' }}>No entries yet.</p>
        )}
        <button type="button" onClick={addRow}
          style={{ padding: '8px 14px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', marginTop: '4px' }}>
          + Add entry
        </button>
      </div>

      <div>
        <label style={labelStyle}>Side photos (optional) — shown left & right of the timeline</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <ImageUploader value={imageLeft} onChange={setImageLeft} label="Left photo" height={200} />
          <ImageUploader value={imageRight} onChange={setImageRight} label="Right photo" height={200} />
        </div>
      </div>

      <div style={{ fontSize: '11px', color: saveState === 'saved' ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
        {saveState === 'saving' ? '● Saving...' : saveState === 'saved' ? '● Saved' : ''}
      </div>
    </div>
  )
}