'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { updateProposal } from '../../actions'

type Proposal = {
  id: string
  slug: string
  client_name: string
  trip_title_ru: string | null
  trip_title_en: string | null
  guest_count: number | null
  start_date: string | null
  end_date: string | null
  status: string | null
  total_price: number | null
  currency: string | null
  cover_image_url: string | null
  intro_text_ru: string | null
  intro_text_en: string | null
}

type Lang = 'ru' | 'en'
type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

const CURRENCIES = ['USD', 'EUR', 'AED', 'GBP']
const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'confirmed', label: 'Confirmed' },
]

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

export default function ProposalForm({ proposal, actions }: { proposal: Proposal; actions?: React.ReactNode }) {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('ru')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    slug: proposal.slug,
    client_name: proposal.client_name || '',
    trip_title_ru: proposal.trip_title_ru || '',
    trip_title_en: proposal.trip_title_en || '',
    guest_count: proposal.guest_count ?? 1,
    start_date: proposal.start_date || '',
    end_date: proposal.end_date || '',
    status: proposal.status || 'draft',
    total_price: proposal.total_price ?? '',
    currency: proposal.currency || 'USD',
    cover_image_url: proposal.cover_image_url || '',
    intro_text_ru: proposal.intro_text_ru || '',
    intro_text_en: proposal.intro_text_en || '',
  })

  // Debounce timer + flag показывающий что были изменения после монтирования
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
        await updateProposal(proposal.id, {
          slug: currentForm.slug,
          client_name: currentForm.client_name,
          trip_title_ru: currentForm.trip_title_ru || null,
          trip_title_en: currentForm.trip_title_en || null,
          guest_count: typeof currentForm.guest_count === 'number'
            ? currentForm.guest_count
            : parseInt(String(currentForm.guest_count)) || null,
          start_date: currentForm.start_date || null,
          end_date: currentForm.end_date || null,
          status: currentForm.status,
          total_price: currentForm.total_price === '' ? null : Number(currentForm.total_price),
          currency: currentForm.currency,
          cover_image_url: currentForm.cover_image_url || null,
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

  // Autosave: debounce 1.5s после каждого изменения form
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
    }

    saveTimer.current = setTimeout(() => {
      saveNow(form)
    }, 1500)

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  async function handleDone() {
    // Если есть отложенный таймер — сохраняем сразу
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    // Сохраняем текущее состояние (если ещё не сохранено)
    if (saveState === 'editing' || saveState === 'error') {
      await saveNow(form)
    }
    // Дожидаемся текущего сохранения если оно идёт
    if (inFlight.current) {
      await inFlight.current
    }
    router.push('/admin')
  }

  // Bilingual fields use suffix from current lang
  const titleKey = lang === 'ru' ? 'trip_title_ru' : 'trip_title_en'
  const introKey = lang === 'ru' ? 'intro_text_ru' : 'intro_text_en'
  const titlePlaceholder = lang === 'ru'
    ? 'Например: Путешествие в Прованс для семьи Алиевых'
    : 'e.g.: A Provence Journey for the Aliyev Family'
  const introPlaceholder = lang === 'ru'
    ? 'Короткое описание поездки, которое клиент увидит на первой странице'
    : 'A short description of the trip that the client sees on the first page'

  function renderSaveIndicator() {
    if (saveState === 'error') {
      return <span style={{ color: '#E07B7B' }}>● Error: {errorMsg}</span>
    }
    if (saveState === 'saving') {
      return <span style={{ color: '#C8A862' }}>● Saving...</span>
    }
    if (saveState === 'editing') {
      return <span style={{ color: '#888780' }}>● Editing...</span>
    }
    if (saveState === 'saved' && savedAt) {
      return <span style={{ color: '#7AA876' }}>● Saved at {savedAt.toLocaleTimeString()}</span>
    }
    return <span style={{ color: '#888780' }}>● All changes saved</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top bar: language switcher + save indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        paddingBottom: '16px',
        borderBottom: '1px solid #2A2A28',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888780', fontWeight: 500 }}>
            Editing in
          </span>
          <div style={{ display: 'inline-flex', borderRadius: '999px', overflow: 'hidden', border: '1px solid #333' }}>
            <button
              type="button"
              onClick={() => setLang('ru')}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                background: lang === 'ru' ? '#FAF8F4' : 'transparent',
                color: lang === 'ru' ? '#2C2C2A' : '#888780',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              RU
            </button>
            <button
              type="button"
              onClick={() => setLang('en')}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                background: lang === 'en' ? '#FAF8F4' : 'transparent',
                color: lang === 'en' ? '#2C2C2A' : '#888780',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              EN
            </button>
          </div>
        </div>
        <div style={{ fontSize: '12px' }}>
          {renderSaveIndicator()}
        </div>
      </div>

      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: '#E5E2DA' }}>Client & dates</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Client name</label>
            <input
              type="text"
              value={form.client_name}
              onChange={(e) => set('client_name', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Guests</label>
            <input
              type="number"
              min={1}
              value={form.guest_count}
              onChange={(e) => set('guest_count', parseInt(e.target.value) || 1)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Start date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => set('start_date', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>End date</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => set('end_date', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: '#E5E2DA' }}>
          Trip details <span style={{ color: '#888780', fontWeight: 400, fontSize: '13px' }}>· {lang.toUpperCase()}</span>
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Trip title</label>
            <input
              type="text"
              value={form[titleKey]}
              onChange={(e) => set(titleKey, e.target.value)}
              style={inputStyle}
              placeholder={titlePlaceholder}
            />
          </div>
          <div>
            <label style={labelStyle}>Cover image URL</label>
            <input
              type="text"
              value={form.cover_image_url}
              onChange={(e) => set('cover_image_url', e.target.value)}
              style={inputStyle}
              placeholder="https://..."
            />
          </div>
          <div>
            <label style={labelStyle}>Intro text</label>
            <textarea
              value={form[introKey]}
              onChange={(e) => set(introKey, e.target.value)}
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              placeholder={introPlaceholder}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: '#E5E2DA' }}>Price & status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Total price</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.total_price}
              onChange={(e) => set('total_price', e.target.value === '' ? '' : parseFloat(e.target.value))}
              style={inputStyle}
              placeholder="0"
            />
          </div>
          <div>
            <label style={labelStyle}>Currency</label>
            <select
              value={form.currency}
              onChange={(e) => set('currency', e.target.value)}
              style={inputStyle}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
              style={inputStyle}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: '#E5E2DA' }}>URL</h2>
        <div>
          <label style={labelStyle}>Slug</label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => set('slug', e.target.value)}
            style={inputStyle}
            placeholder="e.g.: aliyev-provence-jul26"
          />
          <p style={{ fontSize: '12px', color: '#888780', margin: '6px 0 0' }}>
            Public URL: /p/{form.slug} (RU) · /en/p/{form.slug} (EN)
          </p>
        </div>
      </section>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        paddingTop: '24px',
        borderTop: '1px solid #2A2A28',
        flexWrap: 'wrap',
      }}>
        <div>{actions}</div>
        <button
          onClick={handleDone}
          disabled={saveState === 'saving'}
          style={{
            padding: '10px 24px',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '0.03em',
            background: '#FAF8F4',
            color: '#2C2C2A',
            border: 'none',
            borderRadius: '8px',
            cursor: saveState === 'saving' ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            opacity: saveState === 'saving' ? 0.6 : 1,
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}