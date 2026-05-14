'use client'

import { useState, useEffect, useRef } from 'react'
import { updateDay } from './day-actions'
import type { Lang } from './edit-page-client'

type Day = {
  id: string
  day_number: number
  date: string | null
  title_ru: string | null
  title_en: string | null
  intro_text_ru: string | null
  intro_text_en: string | null
}

type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

type Props = {
  day: Day
  isPending: boolean
  onDeleteRequest: (dayId: string, dayTitle: string) => void
  lang: Lang
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#888780',
  marginBottom: '6px',
  fontWeight: 500,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '14px',
  color: '#E5E2DA',
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: '6px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
}

export default function DayCard({ day, isPending, onDeleteRequest, lang }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
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
    if (saveState === 'error') return <span style={{ color: '#E07B7B' }}>● Error</span>
    if (saveState === 'saving') return <span style={{ color: '#C8A862' }}>● Saving...</span>
    if (saveState === 'editing') return <span style={{ color: '#888780' }}>● Editing...</span>
    if (saveState === 'saved' && savedAt) return <span style={{ color: '#7AA876' }}>● Saved</span>
    return null
  }

  const headerTitle = lang === 'ru'
    ? (form.title_ru || day.title_ru)
    : (form.title_en || day.title_en)

  return (
    <div
      style={{
        position: 'relative',
        border: '1px solid #2A2A28',
        borderRadius: '8px',
        background: 'transparent',
        opacity: isPending ? 0.5 : 1,
        transition: 'opacity 0.15s',
      }}
    >
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
          paddingRight: '50px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
          <div style={{
            fontSize: '10px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#888780',
            fontWeight: 500,
            minWidth: '50px',
          }}>
            Day {day.day_number}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 500 }}>
              {headerTitle || <span style={{ color: '#888780', fontStyle: 'italic' }}>Untitled day</span>}
            </div>
            <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>{day.date || 'No date'}</span>
              {expanded && <span style={{ fontSize: '11px' }}>{renderSaveIndicator()}</span>}
            </div>
          </div>
          <div style={{ fontSize: '14px', color: '#888780' }}>
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
        aria-label="Day actions"
        style={{
          position: 'absolute',
          top: '14px',
          right: '12px',
          background: 'transparent',
          border: 'none',
          padding: '6px 10px',
          cursor: 'pointer',
          color: '#888780',
          fontSize: '16px',
          lineHeight: 1,
          borderRadius: '6px',
          fontFamily: 'inherit',
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
            background: '#1a1a1a',
            border: '1px solid #333',
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
                color: '#E07B7B',
                fontSize: '13px',
                cursor: 'pointer',
                borderRadius: '4px',
                fontFamily: 'inherit',
              }}
            >
              Delete day
            </button>
          </div>
        </>
      )}

      {expanded && (
        <div style={{
          padding: '0 16px 16px 16px',
          borderTop: '1px solid #2A2A28',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '16px' }}>
            <div>
              <label style={labelStyle}>Day title</label>
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
              <label style={labelStyle}>Day intro</label>
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
              color: '#E07B7B',
              marginTop: '10px',
            }}>
              Error: {errorMsg}
            </div>
          )}
        </div>
      )}
    </div>
  )
}