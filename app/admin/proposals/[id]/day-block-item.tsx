'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  duplicateDayBlock,
  removeBlockFromDay,
  updateDayBlock,
} from './block-actions'
import type { DayBlock, Lang } from './edit-page-client'
import { useIsMobile } from '@/lib/use-is-mobile'

type Props = {
  dayBlock: DayBlock
  lang: Lang
  isDayPending: boolean
}

type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

export default function DayBlockItem({ dayBlock, lang, isDayPending }: Props) {
  const isMobile = useIsMobile()
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)

  const blockedByOuter = isDayPending

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dayBlock.id, disabled: isPending || blockedByOuter })

  const [noteForm, setNoteForm] = useState({
    custom_note_ru: dayBlock.custom_note_ru || '',
    custom_note_en: dayBlock.custom_note_en || '',
    room_type_ru: dayBlock.room_type_ru || '',
    room_type_en: dayBlock.room_type_en || '',
    from_ru: dayBlock.from_ru || '',
    from_en: dayBlock.from_en || '',
    to_ru: dayBlock.to_ru || '',
    to_en: dayBlock.to_en || '',
  })

  const hasExistingNote = (lang === 'ru' ? noteForm.custom_note_ru : noteForm.custom_note_en).length > 0
  const [noteEditorOpen, setNoteEditorOpen] = useState(hasExistingNote)

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialMount = useRef(true)
  const inFlight = useRef<Promise<void> | null>(null)

  const block = dayBlock.content_blocks
  const title = lang === 'ru' ? block.title_ru : block.title_en
  const description = lang === 'ru' ? block.description_ru : block.description_en

  const noteKey = lang === 'ru' ? 'custom_note_ru' : 'custom_note_en'
  const roomTypeKey = lang === 'ru' ? 'room_type_ru' : 'room_type_en'
  const fromKey = lang === 'ru' ? 'from_ru' : 'from_en'
  const toKey = lang === 'ru' ? 'to_ru' : 'to_en'

  function setNote(value: string) {
    setNoteForm((prev) => ({ ...prev, [noteKey]: value }))
    setSaveState('editing')
  }

  function setField(key: keyof typeof noteForm, value: string) {
    setNoteForm((prev) => ({ ...prev, [key]: value }))
    setSaveState('editing')
  }

  async function saveNow(currentForm: typeof noteForm) {
    setSaveState('saving')
    setErrorMsg(null)

    const promise = (async () => {
      try {
        await updateDayBlock(dayBlock.id, {
          custom_note_ru: currentForm.custom_note_ru || null,
          custom_note_en: currentForm.custom_note_en || null,
          room_type_ru: currentForm.room_type_ru || null,
          room_type_en: currentForm.room_type_en || null,
          from_ru: currentForm.from_ru || null,
          from_en: currentForm.from_en || null,
          to_ru: currentForm.to_ru || null,
          to_en: currentForm.to_en || null,
        })
        setSavedAt(new Date())
        setSaveState('saved')
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Save failed')
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
      saveNow(noteForm)
    }, 1500)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteForm])

  useEffect(() => {
    if (hasExistingNote) {
      setNoteEditorOpen(true)
    }
  }, [hasExistingNote])

  function handleDuplicate() {
    setMenuOpen(false)
    startTransition(async () => {
      await duplicateDayBlock(dayBlock.id)
    })
  }

  function handleRemove() {
    setMenuOpen(false)
    if (!confirm(`Remove "${title || 'this block'}" from this day?\n\nThe block stays in the library and can be added again later.`)) {
      return
    }
    startTransition(async () => {
      await removeBlockFromDay(dayBlock.id)
    })
  }

  function renderSaveIndicator() {
    if (saveState === 'error') return <span style={{ color: '#E07B7B' }}>● Error</span>
    if (saveState === 'saving') return <span style={{ color: '#C8A862' }}>● Saving...</span>
    if (saveState === 'editing') return <span style={{ color: '#888780' }}>● Editing...</span>
    if (saveState === 'saved' && savedAt) return <span style={{ color: '#7AA876' }}>● Saved</span>
    return null
  }

  const currentNote = noteForm[noteKey]

  const containerStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '24px 88px 1fr',
    gap: isMobile ? '0' : '10px',
    padding: '12px',
    paddingRight: isMobile ? '12px' : '40px',
    border: '1px solid #2A2A28',
    borderRadius: '6px',
    background: isDragging ? '#1a1a1a' : '#0d0d0d',
    opacity: isPending || blockedByOuter ? 0.4 : isDragging ? 0.85 : 1,
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.5)' : 'none',
    zIndex: isDragging ? 10 : 'auto',
    alignItems: 'start',
  }

  return (
    <div
      ref={setNodeRef}
      style={containerStyle}
      onMouseEnter={(e) => {
        if (!isDragging && !isPending && !blockedByOuter) {
          e.currentTarget.style.borderColor = '#444'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#2A2A28'
      }}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={isPending || blockedByOuter}
        aria-label="Drag to reorder"
        style={{
          background: isMobile ? 'rgba(20, 20, 20, 0.85)' : 'transparent',
          border: isMobile ? '1px solid #444' : 'none',
          padding: isMobile ? '4px 8px' : '4px',
          cursor: isPending || blockedByOuter ? 'not-allowed' : 'grab',
          color: '#888780',
          fontSize: '14px',
          lineHeight: 1,
          fontFamily: 'inherit',
          touchAction: 'none',
          alignSelf: 'center',
          transition: 'color 0.15s',
          ...(isMobile ? {
            position: 'absolute',
            top: '8px',
            left: '8px',
            zIndex: 2,
            borderRadius: '6px',
            backdropFilter: 'blur(4px)',
          } : {}),
        }}
        onMouseEnter={(e) => {
          if (!isPending && !blockedByOuter && !isMobile) e.currentTarget.style.color = '#E5E2DA'
        }}
        onMouseLeave={(e) => {
          if (!isMobile) e.currentTarget.style.color = '#888780'
        }}
      >
        ⋮⋮
      </button>

      {/* Image */}
      <div style={{
        width: isMobile ? '100%' : '88px',
        height: isMobile ? '180px' : '88px',
        borderRadius: '4px',
        background: block.image_url
          ? `url(${block.image_url}) center/cover no-repeat`
          : '#222',
        flexShrink: 0,
        marginBottom: isMobile ? '12px' : '0',
      }} />

      {/* Content */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: '10px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#888780',
          marginBottom: '4px',
          fontWeight: 500,
        }}>
          {block.type}
          {block.location && <span style={{ color: '#555', fontWeight: 400 }}> · {block.location}</span>}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
          {title || <span style={{ color: '#888780', fontStyle: 'italic' }}>Untitled</span>}
        </div>
        {description && (
          <p style={{ fontSize: '12px', lineHeight: 1.5, color: '#888780', margin: '0 0 10px' }}>
            {description}
          </p>
        )}

        {block.type === 'hotel' && (
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888780', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
              {lang === 'ru' ? 'Тип номера' : 'Room type'} · {lang.toUpperCase()}
            </label>
            <input
              type="text"
              value={noteForm[roomTypeKey]}
              onChange={(e) => setField(roomTypeKey, e.target.value)}
              placeholder={lang === 'ru' ? 'Например: Deluxe City View, All Inclusive' : 'e.g.: Deluxe City View, All Inclusive'}
              style={{
                width: '100%', padding: '8px 10px', fontSize: '12px', lineHeight: 1.5,
                color: '#E5E2DA', background: '#1a1a1a', border: '1px solid #333',
                borderRadius: '4px', fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {block.type === 'transfer' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888780', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
                {lang === 'ru' ? 'Откуда' : 'From'} · {lang.toUpperCase()}
              </label>
              <input
                type="text"
                value={noteForm[fromKey]}
                onChange={(e) => setField(fromKey, e.target.value)}
                placeholder={lang === 'ru' ? 'Аэропорт Марселя' : 'Marseille Airport'}
                style={{
                  width: '100%', padding: '8px 10px', fontSize: '12px', lineHeight: 1.5,
                  color: '#E5E2DA', background: '#1a1a1a', border: '1px solid #333',
                  borderRadius: '4px', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888780', fontWeight: 500, display: 'block', marginBottom: '4px' }}>
                {lang === 'ru' ? 'Куда' : 'To'} · {lang.toUpperCase()}
              </label>
              <input
                type="text"
                value={noteForm[toKey]}
                onChange={(e) => setField(toKey, e.target.value)}
                placeholder={lang === 'ru' ? 'Отель в Гордесе' : 'Hotel in Gordes'}
                style={{
                  width: '100%', padding: '8px 10px', fontSize: '12px', lineHeight: 1.5,
                  color: '#E5E2DA', background: '#1a1a1a', border: '1px solid #333',
                  borderRadius: '4px', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        )}

        {!noteEditorOpen ? (
          <button
            type="button"
            onClick={() => setNoteEditorOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: '#888780',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              textDecorationColor: '#444',
            }}
          >
            + Add note for this trip
          </button>
        ) : (
          <div style={{ marginTop: '4px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
              <label style={{
                fontSize: '10px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#888780',
                fontWeight: 500,
              }}>
                Note for this trip · {lang.toUpperCase()}
              </label>
              <span style={{ fontSize: '11px' }}>
                {renderSaveIndicator()}
              </span>
            </div>
            <textarea
              value={currentNote}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={lang === 'ru'
                ? 'Например: Выезд из отеля в 6:30 утра. Гид встретит вас в холле.'
                : 'e.g.: Departure from the hotel at 6:30 AM. The guide will meet you in the lobby.'}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: '12px',
                lineHeight: 1.5,
                color: '#E5E2DA',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '4px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                outline: 'none',
                resize: 'vertical',
              }}
            />
            <p style={{ fontSize: '10px', color: '#555', margin: '4px 0 0' }}>
              Visible to client on this trip only. The library block stays unchanged.
            </p>
            {errorMsg && (
              <p style={{ fontSize: '11px', color: '#E07B7B', margin: '4px 0 0' }}>
                Error: {errorMsg}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions menu trigger */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setMenuOpen(!menuOpen)
        }}
        disabled={isPending || blockedByOuter}
        aria-label="Block actions"
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'transparent',
          border: 'none',
          padding: '6px 8px',
          cursor: isPending || blockedByOuter ? 'wait' : 'pointer',
          color: '#888780',
          fontSize: '14px',
          lineHeight: 1,
          borderRadius: '4px',
          fontFamily: 'inherit',
          transition: 'color 0.15s, background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#E5E2DA'
          e.currentTarget.style.background = '#1a1a1a'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#888780'
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
            top: '34px',
            right: '8px',
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '4px',
            minWidth: '140px',
            zIndex: 2,
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          }}>
            <button
              onClick={handleDuplicate}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: '#E5E2DA',
                fontSize: '13px',
                cursor: 'pointer',
                borderRadius: '4px',
                fontFamily: 'inherit',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#222' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Duplicate
            </button>
            <button
              onClick={handleRemove}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: '#E07B7B',
                fontSize: '13px',
                cursor: 'pointer',
                borderRadius: '4px',
                fontFamily: 'inherit',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(224, 123, 123, 0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Remove from day
            </button>
          </div>
        </>
      )}
    </div>
  )
}