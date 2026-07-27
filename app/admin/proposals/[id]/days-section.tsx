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
import type { Lang } from './edit-page-client'
import { useDays } from './days-context'

type Props = {
  proposalId: string
  lang: Lang
}

export default function DaysSection({ proposalId, lang }: Props) {
  const { days, refresh, variantId, tripStart, tripEnd } = useDays()
  const [isPending, startTransition] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  function handleAddDay() {
    startTransition(async () => {
      await createDay(proposalId, variantId)
      await refresh()
    })
  }

  function handleDeleteRequest(dayId: string, dayTitle: string) {
    if (!confirm(`Delete this day?\n\n"${dayTitle || 'Untitled'}"\n\nAll content inside (blocks and notes) will be removed. This cannot be undone.`)) {
      return
    }
    startTransition(async () => {
      await deleteDay(dayId)
      await refresh()
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
      await reorderDays(proposalId, orderedIds, variantId)
      await refresh()
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
        borderBottom: '1px solid var(--admin-border-card)',
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            Itinerary
          </h2>
          <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '13px' }}>
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
            color: 'var(--admin-text)',
            border: '1px solid var(--admin-border)',
            borderRadius: '6px',
            cursor: isPending ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          + Add day
        </button>
      </div>

      {(() => {
        if (!tripStart || !tripEnd || days.length === 0) return null
        const d1 = new Date(tripStart), d2 = new Date(tripEnd)
        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null
        const expected = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1
        if (expected <= 0 || expected === days.length) return null
        return (
          <div style={{ padding: '12px 16px', marginBottom: '16px', background: '#2a2417', border: '1px solid #4a3f1e', borderRadius: '8px', fontSize: '13px', color: 'var(--admin-accent)', lineHeight: 1.5 }}>
            {`${days.length} of ${expected} days filled in.`}
          </div>
        )
      })()}

      {days.length === 0 ? (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          color: 'var(--admin-text-muted)',
          border: '1px dashed var(--admin-text-faint)',
          borderRadius: '8px',
          fontSize: '14px',
        }}>
          No days yet. Click + Add day to start building the itinerary.
        </div>
      ) : (
        <DndContext id="days-reorder" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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