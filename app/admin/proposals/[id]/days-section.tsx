'use client'

import { useTransition } from 'react'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { createDay, deleteDay, reorderDays } from './day-actions'
import DayCard from './day-card'
import type { Lang, Day } from './edit-page-client'

type Props = {
  proposalId: string
  days: Day[]
  lang: Lang
}

export default function DaysSection({ proposalId, days, lang }: Props) {
  const [isPending, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  function handleAddDay() {
    startTransition(async () => {
      await createDay(proposalId)
    })
  }

  function handleDeleteRequest(dayId: string, dayTitle: string) {
    if (!confirm(`Delete this day?\n\n"${dayTitle || 'Untitled'}"\n\nAll content inside (blocks and notes) will be removed. This cannot be undone.`)) {
      return
    }
    startTransition(async () => {
      await deleteDay(dayId)
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = days.findIndex((d) => d.id === active.id)
    const newIndex = days.findIndex((d) => d.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(days, oldIndex, newIndex)
    const orderedIds = reordered.map((d) => d.id)

    startTransition(async () => {
      await reorderDays(proposalId, orderedIds)
    })
  }

  return (
    <section>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid #2A2A28',
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            Itinerary
          </h2>
          <p style={{ color: '#888780', margin: 0, fontSize: '13px' }}>
            {days.length} {days.length === 1 ? 'day' : 'days'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddDay}
          disabled={isPending}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '0.03em',
            background: 'transparent',
            color: '#E5E2DA',
            border: '1px solid #333',
            borderRadius: '6px',
            cursor: isPending ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          + Add day
        </button>
      </div>

      {days.length === 0 ? (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          color: '#888780',
          border: '1px dashed #555',
          borderRadius: '8px',
          fontSize: '14px',
        }}>
          No days yet. Click + Add day to start building the itinerary.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={days.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {days.map((day) => (
                <DayCard
                  key={day.id}
                  day={day}
                  isPending={isPending}
                  onDeleteRequest={handleDeleteRequest}
                  lang={lang}
                  proposalId={proposalId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}