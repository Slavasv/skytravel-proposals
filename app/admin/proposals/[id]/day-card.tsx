'use client'

import { useState, useEffect, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import { useTransition } from 'react'
import { reorderDayBlocks } from './block-actions'
import { useDays } from './days-context'
import { updateDay } from './day-actions'
import DayBlockItem from './day-block-item'
import AddBlockModal from './add-block-modal'
import type { Day, Lang } from './edit-page-client'
import { useT } from '@/lib/i18n-client'

type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

type Props = {
  day: Day
  isPending: boolean
  onDeleteRequest: (dayId: string, dayTitle: string) => void
  lang: Lang
  proposalId: string
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--admin-text-muted)',
  marginBottom: '6px',
  fontWeight: 500,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '14px',
  color: 'var(--admin-text)',
  background: 'var(--admin-input)',
  border: '1px solid var(--admin-border)',
  borderRadius: '6px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
}

export default function DayCard({ day, isPending, onDeleteRequest, lang, proposalId }: Props) {
  const t = useT()
  const { refresh } = useDays()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: day.id, disabled: isPending })

  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isBlocksPending, startBlocksTransition] = useTransition()

  const blockSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  function handleBlocksDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const blocks = day.day_blocks
    const oldIndex = blocks.findIndex((b) => b.id === active.id)
    const newIndex = blocks.findIndex((b) => b.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(blocks, oldIndex, newIndex)
    const orderedIds = reordered.map((b) => b.id)

    startBlocksTransition(async () => {
      await reorderDayBlocks(day.id, orderedIds)
      await refresh()
    })
  }
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    title_ru: day.title_ru || '',
    title_en: day.title_en || '',
    intro_text_ru: day.intro_text_ru || '',
    intro_text_en: day.intro_text_en || '',
  })

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialMount = useRef(true)
  const inFlight = useRef<Promise<void> | null>(null)

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaveState('editing')
  }

  async function saveNow(currentForm: typeof form) {
    setSaveState('saving')
    setErrorMsg(null)

    const promise = (async () => {
      try {
        await updateDay(day.id, {
          title_ru: currentForm.title_ru || null,
          title_en: currentForm.title_en || null,
          intro_text_ru: currentForm.intro_text_ru || null,
          intro_text_en: currentForm.intro_text_en || null,
        })
        setSavedAt(new Date())
        setSaveState('saved')
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : t('Save failed', 'Не удалось сохранить'))
        setSaveState('error')
      }
    })()

    inFlight.current = promise
    await promise
    if (inFlight.current === promise) {
      inFlight.current = null
    }
  }

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    if (saveTimer.current) clearTimeout(saveTimer.current)

    saveTimer.current = setTimeout(() => {
      saveNow(form)
    }, 1500)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  const titleKey = lang === 'ru' ? 'title_ru' : 'title_en'
  const introKey = lang === 'ru' ? 'intro_text_ru' : 'intro_text_en'

  function renderSaveIndicator() {
    if (saveState === 'error') return <span style={{ color: 'var(--admin-danger)' }}>{t('● Error', '● Ошибка')}</span>
    if (saveState === 'saving') return <span style={{ color: 'var(--admin-accent)' }}>{t('● Saving...', '● Сохранение...')}</span>
    if (saveState === 'editing') return <span style={{ color: 'var(--admin-text-muted)' }}>{t('● Editing...', '● Редактирование...')}</span>
    if (saveState === 'saved' && savedAt) return <span style={{ color: 'var(--admin-success)' }}>{t('● Saved', '● Сохранено')}</span>
    return null
  }

  const headerTitle = lang === 'ru'
    ? (form.title_ru || day.title_ru)
    : (form.title_en || day.title_en)

  const blocksCount = day.day_blocks?.length ?? 0

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    border: '1px solid var(--admin-border-card)',
    borderRadius: '8px',
    background: isDragging ? 'var(--admin-input)' : 'transparent',
    opacity: isPending ? 0.5 : isDragging ? 0.85 : 1,
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.5)' : 'none',
    zIndex: isDragging ? 10 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={isPending}
        aria-label={t('Drag to reorder', 'Перетащите для изменения порядка')}
        style={{
          position: 'absolute',
          left: '8px',
          top: '16px',
          background: 'transparent',
          border: 'none',
          padding: '4px 4px',
          cursor: isPending ? 'not-allowed' : 'grab',
          color: 'var(--admin-text-faint)',
          fontSize: '14px',
          lineHeight: 1,
          fontFamily: 'inherit',
          touchAction: 'none',
          transition: 'color 0.15s',
          zIndex: 1,
        }}
        onMouseEnter={(e) => {
          if (!isPending) e.currentTarget.style.color = 'var(--admin-text-muted)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--admin-text-faint)'
        }}
      >
        ⋮⋮
      </button>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          padding: '14px 16px',
          paddingLeft: '34px',
          paddingRight: '50px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: 'inherit',
          borderRadius: '8px',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!isDragging) e.currentTarget.style.background = 'var(--admin-bg)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
          <div style={{
            fontSize: '10px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--admin-text-muted)',
            fontWeight: 500,
            minWidth: '50px',
          }}>
            {t('Day', 'День')} {day.day_number}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>
              {headerTitle || <span style={{ color: 'var(--admin-text-muted)', fontStyle: 'italic' }}>{t('Untitled day', 'День без названия')}</span>}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>{day.date || t('No date', 'Без даты')}</span>
              <span>{blocksCount} {blocksCount === 1 ? t('block', 'блок') : t('blocks', 'блоков')}</span>
              {expanded && <span style={{ fontSize: '11px' }}>{renderSaveIndicator()}</span>}
            </div>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--admin-text-muted)' }}>
            {expanded ? '▾' : '▸'}
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setMenuOpen(!menuOpen)
        }}
        disabled={isPending}
        aria-label={t('Day actions', 'Действия с днём')}
        style={{
          position: 'absolute',
          top: '14px',
          right: '12px',
          background: 'transparent',
          border: 'none',
          padding: '6px 10px',
          cursor: 'pointer',
          color: 'var(--admin-text-muted)',
          fontSize: '16px',
          lineHeight: 1,
          borderRadius: '6px',
          fontFamily: 'inherit',
          transition: 'color 0.15s, background 0.15s',
          zIndex: 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--admin-text)'
          e.currentTarget.style.background = 'var(--admin-input)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--admin-text-muted)'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        ⋯
      </button>

      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1 }}
          />
          <div style={{
            position: 'absolute',
            top: '46px',
            right: '12px',
            background: 'var(--admin-input)',
            border: '1px solid var(--admin-border)',
            borderRadius: '8px',
            padding: '4px',
            minWidth: '140px',
            zIndex: 2,
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          }}>
            <button
              onClick={() => {
                setMenuOpen(false)
                onDeleteRequest(day.id, day.title_ru || '')
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: 'var(--admin-danger)',
                fontSize: '13px',
                cursor: 'pointer',
                borderRadius: '4px',
                fontFamily: 'inherit',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(224, 123, 123, 0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {t('Delete day', 'Удалить день')}
            </button>
          </div>
        </>
      )}

      {expanded && (
        <div style={{
          padding: '0 16px 16px 16px',
          borderTop: '1px solid var(--admin-border-card)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '16px' }}>
            <div>
              <label style={labelStyle}>{t('Day title', 'Название дня')}</label>
              <input
                type="text"
                value={form[titleKey]}
                onChange={(e) => set(titleKey, e.target.value)}
                style={inputStyle}
                placeholder={lang === 'ru'
                  ? 'Например: Прибытие в Прованс'
                  : 'e.g.: Arrival in Provence'}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('Day intro', 'Описание дня')}</label>
              <textarea
                value={form[introKey]}
                onChange={(e) => set(introKey, e.target.value)}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                placeholder={lang === 'ru'
                  ? 'Краткое описание дня для клиента...'
                  : 'Short description of the day for the client...'}
              />
            </div>
          </div>

          {errorMsg && (
            <div style={{
              fontSize: '12px',
              color: 'var(--admin-danger)',
              marginTop: '10px',
            }}>
              {t('Error', 'Ошибка')}: {errorMsg}
            </div>
          )}

          {/* Blocks section */}
          <div style={{ marginTop: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}>
              <span style={{
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--admin-text-muted)',
                fontWeight: 500,
              }}>
                {t('Blocks', 'Блоки')}
              </span>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                disabled={isPending}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.03em',
                  background: 'transparent',
                  color: 'var(--admin-text)',
                  border: '1px solid var(--admin-border)',
                  borderRadius: '6px',
                  cursor: isPending ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: isPending ? 0.6 : 1,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isPending) {
                    e.currentTarget.style.borderColor = 'var(--admin-text-faint)'
                    e.currentTarget.style.background = 'var(--admin-input)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--admin-border)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {t('+ Add block', '+ Добавить блок')}
              </button>
            </div>

            {blocksCount === 0 ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: 'var(--admin-text-muted)',
                border: '1px dashed var(--admin-border)',
                borderRadius: '6px',
                fontSize: '13px',
              }}>
                {t('No blocks yet. Click + Add block to insert from the library.', 'Пока нет блоков. Нажмите «+ Добавить блок», чтобы вставить из библиотеки.')}
              </div>
            ) : (
              <DndContext sensors={blockSensors} collisionDetection={closestCenter} onDragEnd={handleBlocksDragEnd}>
                <SortableContext items={day.day_blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {day.day_blocks.map((db) => (
                      <DayBlockItem key={db.id} dayBlock={db} lang={lang} isDayPending={isBlocksPending} proposalId={proposalId} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      )}

      <AddBlockModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        dayId={day.id}
        dayNumber={day.day_number}
        lang={lang}
        proposalId={proposalId}
      />
    </div>
  )
}