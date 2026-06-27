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
import {
  updateSection,
  getSectionBlocks,
  addBlockToSection,
  removeBlockFromSection,
  reorderSectionBlocks,
  type SectionBlockItem,
} from './destination-actions'
import type { DestinationSection } from './destination-actions'
import SectionBlockPicker from './section-block-picker'

type Lang = 'ru' | 'en'

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', marginBottom: '6px', fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: '14px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

function SortableBlockRow({
  item,
  lang,
  onRemove,
}: {
  item: SectionBlockItem
  lang: Lang
  onRemove: (rowId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    display: 'flex', alignItems: 'center', gap: '10px',
    border: '1px solid var(--admin-border-card)', borderRadius: '8px',
    padding: '8px 10px', marginBottom: '8px', background: 'var(--admin-input)',
  }
  const title = lang === 'ru' ? item.title_ru : item.title_en
  return (
    <div ref={setNodeRef} style={style}>
      <button type="button" {...attributes} {...listeners} aria-label="Drag"
        style={{ background: 'transparent', border: 'none', cursor: 'grab', color: 'var(--admin-text-muted)', fontSize: '14px', padding: '2px 4px', touchAction: 'none', fontFamily: 'inherit' }}>⋮⋮</button>
      <div style={{ width: '44px', height: '44px', borderRadius: '4px', flexShrink: 0, background: item.image_url ? `url(${item.image_url}) center/cover no-repeat` : 'var(--admin-card)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--admin-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title || <span style={{ color: 'var(--admin-text-muted)', fontStyle: 'italic' }}>Untitled</span>}
        </div>
        {item.duration_hours != null && (
          <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>{item.duration_hours}h</div>
        )}
      </div>
      <button type="button" onClick={() => onRemove(item.id)}
        style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '6px 8px', fontFamily: 'inherit' }}>✕</button>
    </div>
  )
}

export default function SectionActivities({
  section,
  lang,
  onLocalChange,
}: {
  section: DestinationSection
  lang: Lang
  onLocalChange: (patch: Partial<DestinationSection>) => void
}) {
  const [titleRu, setTitleRu] = useState(section.title_ru || '')
  const [titleEn, setTitleEn] = useState(section.title_en || '')
  const [items, setItems] = useState<SectionBlockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [titleSaveState, setTitleSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)

  // загрузка прикреплённых блоков
  useEffect(() => {
    let cancelled = false
    getSectionBlocks(section.id)
      .then((data) => { if (!cancelled) setItems(data) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [section.id])

  // автосейв заголовка темы
  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return }
    setTitleSaveState('saving')
    onLocalChange({ title_ru: titleRu || null, title_en: titleEn || null })
    if (titleTimer.current) clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(async () => {
      await updateSection(section.id, { title_ru: titleRu || null, title_en: titleEn || null })
      setTitleSaveState('saved')
    }, 1000)
    return () => { if (titleTimer.current) clearTimeout(titleTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleRu, titleEn])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const returnTo = `/admin/destinations/${section.proposal_id}`

  async function handleAdd(blockId: string) {
    await addBlockToSection(section.id, blockId)
    const fresh = await getSectionBlocks(section.id)
    setItems(fresh)
  }
  async function handleRemove(rowId: string) {
    setItems((prev) => prev.filter((i) => i.id !== rowId))
    await removeBlockFromSection(rowId)
  }
  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next)
    await reorderSectionBlocks(next.map((i) => i.id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '12px' }}>
      <div>
        <label style={labelStyle}>Theme title · {lang.toUpperCase()}</label>
        {lang === 'ru' ? (
          <input type="text" value={titleRu} onChange={(e) => setTitleRu(e.target.value)} style={inputStyle} placeholder="Например: Природа · Культура и гастрономия" />
        ) : (
          <input type="text" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} style={inputStyle} placeholder="e.g.: Nature · Culture & dining" />
        )}
        <div style={{ fontSize: '11px', marginTop: '4px', color: titleSaveState === 'saved' ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
          {titleSaveState === 'saving' ? '● Saving...' : titleSaveState === 'saved' ? '● Saved' : ''}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Activities</label>
        {loading ? (
          <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Loading...</div>
        ) : items.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div>
                {items.map((it) => (
                  <SortableBlockRow key={it.id} item={it} lang={lang} onRemove={handleRemove} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <p style={{ fontSize: '12px', color: 'var(--admin-text-faint)', margin: '0 0 8px' }}>No activities yet.</p>
        )}
        <button type="button" onClick={() => setPickerOpen(true)}
          style={{ padding: '8px 14px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', marginTop: '4px' }}>
          + Add activity
        </button>
      </div>

      <SectionBlockPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAdd}
        blockType="activity"
        lang={lang}
        returnTo={returnTo}
        title={lang === 'ru' ? 'Добавить активность' : 'Add activity'}
        attachKind="blocks"
        attachSectionId={section.id}
      />
    </div>
  )
}