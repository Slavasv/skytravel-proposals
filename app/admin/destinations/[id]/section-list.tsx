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
  onDelete,
  disabled,
}: {
  section: DestinationSection
  onDelete: (id: string) => void
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
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    border: '1px solid var(--admin-border-card)',
    borderRadius: '8px',
    background: 'var(--admin-card)',
    marginBottom: '8px',
  }

  const title = section.title_ru || section.title_en || ''

  return (
    <div ref={setNodeRef} style={style}>
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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>
          {typeLabel(section.type)}
          {title && <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}> · {title}</span>}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--admin-text-faint)', marginTop: '2px' }}>
          Empty — open to fill (editing coming next step)
        </div>
      </div>
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
  )
}

export default function SectionList({
  proposalId,
  initialSections,
}: {
  proposalId: string
  initialSections: DestinationSection[]
}) {
  const [sections, setSections] = useState<DestinationSection[]>(initialSections)
  const [addOpen, setAddOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const hasRoute = sections.some((s) => s.type === 'route')

  function handleAdd(type: SectionType) {
    setAddOpen(false)
    startTransition(async () => {
      await addSection(proposalId, type)
      // оптимистично — добавим заглушку, серверный revalidate обновит
      window.location.reload()
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Remove this section?')) return
    setSections((prev) => prev.filter((s) => s.id !== id))
    startTransition(async () => {
      await deleteSection(id)
    })
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
                <SortableSection key={s.id} section={s} onDelete={handleDelete} disabled={isPending} />
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