'use client'

import { useState, useEffect, useTransition } from 'react'
import { createDay } from './day-actions'
import { addBlockToDay } from './block-actions'
import DayBlockItem from './day-block-item'
import SectionBlockPicker from '@/app/admin/destinations/[id]/section-block-picker'
import type { Lang } from './edit-page-client'
import { useDays } from './days-context'

// Отельное предложение: плоский список отелей.
// Технически всё лежит в одном служебном "дне" — агент его не видит.
export default function HotelsSection({
  proposalId, lang,
}: {
  proposalId: string
  lang: Lang
}) {
  const { days, refresh, variantId } = useDays()
  const [isPending, startTransition] = useTransition()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const holder = days[0] ?? null
  const blocks = holder?.day_blocks ?? []

  // служебный день создаём при первом заходе
  useEffect(() => {
    if (holder || creating) return
    setCreating(true)
    startTransition(async () => {
      // служебный день должен принадлежать активному варианту,
      // иначе загрузка (фильтр по variant_id) его не увидит и holder навсегда null
      await createDay(proposalId, variantId)
      await refresh()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holder])

  function handleSelect(blockId: string) {
    if (!holder) return
    setPickerOpen(false)
    startTransition(async () => {
      await addBlockToDay(holder.id, blockId)
      await refresh()
    })
  }

  return (
    <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: 0, color: 'var(--admin-text)' }}>
          Hotels <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400, fontSize: '13px' }}>· {lang.toUpperCase()}</span>
        </h2>
        <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
          {blocks.length} {blocks.length === 1 ? 'option' : 'options'}
        </span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
        Add hotel options for the client to choose from. Remove the ones they don&apos;t pick.
      </p>

      {blocks.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px', marginBottom: '12px' }}>
          {holder ? 'No hotels yet. Add the first option below.' : 'Preparing…'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
          {blocks.map((db) => (
            <DayBlockItem key={db.id} dayBlock={db} lang={lang} isDayPending={isPending} proposalId={proposalId} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        disabled={!holder || isPending}
        style={{
          padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)',
          background: 'transparent', border: '1px dashed var(--admin-border-card)',
          borderRadius: '8px', cursor: !holder || isPending ? 'wait' : 'pointer',
          fontFamily: 'inherit', opacity: !holder || isPending ? 0.5 : 1,
        }}
      >
        + Add hotel
      </button>

      <SectionBlockPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
        blockType="hotel"
        lang={lang}
        returnTo={`/admin/proposals/${proposalId}`}
        title={lang === 'ru' ? 'Выберите отель' : 'Choose a hotel'}
      />
    </section>
  )
}