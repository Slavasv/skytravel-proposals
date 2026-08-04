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
import { useT } from '@/lib/i18n-client'
import { updateSection } from './destination-actions'
import type { DestinationSection } from './destination-actions'

type Lang = 'ru' | 'en'

type RouteStop = {
  id: string
  date_ru: string
  date_en: string
  title_ru: string
  title_en: string
  desc_ru: string
  desc_en: string
}

function getStops(data: unknown): RouteStop[] {
  if (data && typeof data === 'object' && 'stops' in data) {
    const stops = (data as { stops?: unknown }).stops
    if (Array.isArray(stops)) {
      return stops
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => ({
          id: typeof x.id === 'string' ? x.id : Math.random().toString(36).slice(2),
          date_ru: typeof x.date_ru === 'string' ? x.date_ru : '',
          date_en: typeof x.date_en === 'string' ? x.date_en : '',
          title_ru: typeof x.title_ru === 'string' ? x.title_ru : '',
          title_en: typeof x.title_en === 'string' ? x.title_en : '',
          desc_ru: typeof x.desc_ru === 'string' ? x.desc_ru : '',
          desc_en: typeof x.desc_en === 'string' ? x.desc_en : '',
        }))
    }
  }
  return []
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: '14px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', marginBottom: '6px', fontWeight: 500,
}

function SortableStop({
  stop,
  lang,
  onChange,
  onRemove,
}: {
  stop: RouteStop
  lang: Lang
  onChange: (id: string, patch: Partial<RouteStop>) => void
  onRemove: (id: string) => void
}) {
  const t = useT()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    border: '1px solid var(--admin-border-card)',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '8px',
    background: 'var(--admin-input)',
  }
  const dateKey = lang === 'ru' ? 'date_ru' : 'date_en'
  const titleKey = lang === 'ru' ? 'title_ru' : 'title_en'
  const descKey = lang === 'ru' ? 'desc_ru' : 'desc_en'

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <button type="button" {...attributes} {...listeners} aria-label={t('Drag', 'Перетащить')}
          style={{ background: 'transparent', border: 'none', cursor: 'grab', color: 'var(--admin-text-muted)', fontSize: '14px', padding: '2px 4px', touchAction: 'none', fontFamily: 'inherit' }}>
          ⋮⋮
        </button>
        <input type="text" value={stop[dateKey]} onChange={(e) => onChange(stop.id, { [dateKey]: e.target.value })}
          style={{ ...inputStyle, width: '160px' }} placeholder={lang === 'ru' ? '24 октября (опц.)' : 'Oct 24 (opt.)'} />
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => onRemove(stop.id)}
          style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '6px 8px', fontFamily: 'inherit' }}>
          ✕
        </button>
      </div>
      <input type="text" value={stop[titleKey]} onChange={(e) => onChange(stop.id, { [titleKey]: e.target.value })}
        style={{ ...inputStyle, marginBottom: '8px', fontWeight: 600 }} placeholder={lang === 'ru' ? 'Заголовок' : 'Title'} />
      <textarea value={stop[descKey]} onChange={(e) => onChange(stop.id, { [descKey]: e.target.value })}
        rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder={lang === 'ru' ? 'Описание...' : 'Description...'} />
    </div>
  )
}

export default function SectionRoute({
  section,
  lang,
  onLocalChange,
}: {
  section: DestinationSection
  lang: Lang
  onLocalChange: (patch: Partial<DestinationSection>) => void
}) {
  const t = useT()
  const [stops, setStops] = useState<RouteStop[]>(getStops(section.data))
  const [titleRu, setTitleRu] = useState(section.title_ru || '')
  const [titleEn, setTitleEn] = useState(section.title_en || '')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)

  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return }
    setSaveState('saving')
    onLocalChange({ title_ru: titleRu || null, title_en: titleEn || null, data: { stops } })
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await updateSection(section.id, {
        title_ru: titleRu || null,
        title_en: titleEn || null,
        data: { stops },
      })
      setSaveState('saved')
    }, 1200)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, titleRu, titleEn])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function addStop() {
    setStops((prev) => [...prev, { id: Math.random().toString(36).slice(2), date_ru: '', date_en: '', title_ru: '', title_en: '', desc_ru: '', desc_en: '' }])
  }
  function changeStop(id: string, patch: Partial<RouteStop>) {
    setStops((prev) => prev.map((st) => (st.id === id ? { ...st, ...patch } : st)))
  }
  function removeStop(id: string) {
    setStops((prev) => prev.filter((st) => st.id !== id))
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = stops.findIndex((i) => i.id === active.id)
    const newIndex = stops.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    setStops((prev) => arrayMove(prev, oldIndex, newIndex))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '12px' }}>
      <div>
        <label style={labelStyle}>{t('Section title (optional)', 'Заголовок раздела (необяз.)')} · {lang.toUpperCase()}</label>
        {lang === 'ru' ? (
          <input type="text" value={titleRu} onChange={(e) => setTitleRu(e.target.value)} style={inputStyle} placeholder="Например: Маршрут путешествия" />
        ) : (
          <input type="text" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} style={inputStyle} placeholder="e.g.: Travel route" />
        )}
      </div>

      <div>
        <label style={labelStyle}>{t('Stops', 'Остановки')}</label>
        {stops.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={stops.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div>
                {stops.map((st) => (
                  <SortableStop key={st.id} stop={st} lang={lang} onChange={changeStop} onRemove={removeStop} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <p style={{ fontSize: '12px', color: 'var(--admin-text-faint)', margin: '0 0 8px' }}>{t('No stops yet.', 'Пока нет остановок.')}</p>
        )}
        <button type="button" onClick={addStop}
          style={{ padding: '8px 14px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', marginTop: '4px' }}>
          + {t('Add stop', 'Добавить остановку')}
        </button>
      </div>

      <div style={{ fontSize: '11px', color: saveState === 'saved' ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
        {saveState === 'saving' ? t('● Saving...', '● Сохранение...') : saveState === 'saved' ? t('● Saved', '● Сохранено') : ''}
      </div>
    </div>
  )
}