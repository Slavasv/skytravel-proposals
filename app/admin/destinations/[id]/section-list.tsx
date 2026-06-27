'use client'

import { useState, useTransition } from 'react'
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
  addSection,
  deleteSection,
  reorderSections,
  type DestinationSection,
  type SectionType,
} from './destination-actions'
import SectionGallery from './section-gallery'
import SectionSampleDay from './section-sample-day'
import SectionRoute from './section-route'
import SectionCity from './section-city'
import SectionActivities from './section-activities'
import SectionHotel from './section-hotel'

type Lang = 'ru' | 'en'

const SECTION_TYPES: { type: SectionType; label: string; desc: string }[] = [
  { type: 'route', label: 'Route', desc: 'Sample itinerary (one per destination)' },
  { type: 'city', label: 'City', desc: 'Place story with facts' },
  { type: 'activities', label: 'Activities', desc: 'Themed collection of activities' },
  { type: 'hotel', label: 'Hotel', desc: 'Hotel with rooms' },
  { type: 'gallery', label: 'Gallery', desc: 'Photo gallery' },
  { type: 'sample_day', label: 'Sample day', desc: 'A typical day timeline' },
]

function typeLabel(type: SectionType): string {
  return SECTION_TYPES.find((t) => t.type === type)?.label ?? type
}

function SortableSection({
  section,
  lang,
  expanded,
  onToggle,
  onDelete,
  onLocalChange,
  disabled,
}: {
  section: DestinationSection
  lang: Lang
  expanded: boolean
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onLocalChange: (id: string, patch: Partial<DestinationSection>) => void
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    border: '1px solid var(--admin-border-card)',
    borderRadius: '8px',
    background: 'var(--admin-card)',
    marginBottom: '8px',
    overflow: 'hidden',
  }

  const title = (lang === 'ru' ? section.title_ru : section.title_en) || ''

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' }}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          style={{
            background: 'transparent', border: 'none', padding: '2px 6px',
            cursor: disabled ? 'not-allowed' : 'grab', color: 'var(--admin-text-muted)',
            fontSize: '14px', fontFamily: 'inherit', touchAction: 'none',
          }}
        >
          ⋮⋮
        </button>
        <button
          type="button"
          onClick={() => onToggle(section.id)}
          style={{
            flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>
            <span style={{ color: 'var(--admin-text-muted)', marginRight: '6px' }}>{expanded ? '▾' : '▸'}</span>
            {typeLabel(section.type)}
            {title && <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}> · {title}</span>}
          </div>
        </button>
        <button
          type="button"
          onClick={() => onDelete(section.id)}
          disabled={disabled}
          style={{
            padding: '4px 10px', fontSize: '12px', color: 'var(--admin-danger)',
            background: 'transparent', border: '1px solid var(--admin-border-card)',
            borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}
        >
          ✕ Remove
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--admin-border-card)' }}>
          {section.type === 'gallery' ? (
            <SectionGallery section={section} lang={lang} onLocalChange={(patch) => onLocalChange(section.id, patch)} />
          ) : section.type === 'sample_day' ? (
            <SectionSampleDay section={section} lang={lang} onLocalChange={(patch) => onLocalChange(section.id, patch)} />
          ) : section.type === 'route' ? (
            <SectionRoute section={section} lang={lang} onLocalChange={(patch) => onLocalChange(section.id, patch)} />
          ) : section.type === 'city' ? (
            <SectionCity section={section} lang={lang} onLocalChange={(patch) => onLocalChange(section.id, patch)} />
          ) : section.type === 'activities' ? (
            <SectionActivities section={section} lang={lang} onLocalChange={(patch) => onLocalChange(section.id, patch)} />
          ) : section.type === 'hotel' ? (
            <SectionHotel section={section} lang={lang} onLocalChange={(patch) => onLocalChange(section.id, patch)} />
          ) : (
            <div style={{ paddingTop: '12px', fontSize: '12px', color: 'var(--admin-text-muted)' }}>
              Editing for &quot;{typeLabel(section.type)}&quot; is coming in the next step.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SectionList({
  proposalId,
  initialSections,
  lang,
}: {
  proposalId: string
  initialSections: DestinationSection[]
  lang: Lang
}) {
  const [sections, setSections] = useState<DestinationSection[]>(initialSections)
  const [addOpen, setAddOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const hasRoute = sections.some((s) => s.type === 'route')

  function handleAdd(type: SectionType) {
    setAddOpen(false)
    startTransition(async () => {
      await addSection(proposalId, type)
      window.location.reload()
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Remove this section?')) return
    if (expandedId === id) setExpandedId(null)
    setSections((prev) => prev.filter((s) => s.id !== id))
    startTransition(async () => {
      await deleteSection(id)
    })
  }

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  function handleLocalChange(id: string, patch: Partial<DestinationSection>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex((s) => s.id === active.id)
    const newIndex = sections.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const next = arrayMove(sections, oldIndex, newIndex)
    setSections(next)
    startTransition(async () => {
      await reorderSections(proposalId, next.map((s) => s.id))
    })
  }

  return (
    <section>
      <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>Sections</h2>
      <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
        Build the destination page from sections. Drag to reorder. All optional except Cover &amp; Costs.
      </p>

      {sections.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div>
              {sections.map((s) => (
                <SortableSection
                  key={s.id}
                  section={s}
                  lang={lang}
                  expanded={expandedId === s.id}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onLocalChange={handleLocalChange}
                  disabled={isPending}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {!addOpen ? (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          disabled={isPending}
          style={{
            padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)',
            background: 'transparent', border: '1px dashed var(--admin-border-card)',
            borderRadius: '8px', cursor: isPending ? 'wait' : 'pointer', fontFamily: 'inherit',
            marginTop: sections.length > 0 ? '4px' : '0',
          }}
        >
          + Add section
        </button>
      ) : (
        <div style={{ border: '1px solid var(--admin-border-card)', borderRadius: '8px', padding: '8px', marginTop: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Choose a section type</span>
            <button type="button" onClick={() => setAddOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>Cancel</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {SECTION_TYPES.map((st) => {
              const blocked = st.type === 'route' && hasRoute
              return (
                <button
                  key={st.type}
                  type="button"
                  onClick={() => !blocked && handleAdd(st.type)}
                  disabled={blocked}
                  title={blocked ? 'Route can only be added once' : st.desc}
                  style={{
                    textAlign: 'left', padding: '10px 12px',
                    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
                    borderRadius: '6px', cursor: blocked ? 'not-allowed' : 'pointer',
                    opacity: blocked ? 0.4 : 1, fontFamily: 'inherit',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>{st.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>{st.desc}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}