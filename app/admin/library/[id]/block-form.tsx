'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { updateBlock, type BlockType } from '../actions'
import { addBlockToDay } from '@/app/admin/proposals/[id]/block-actions'
import TagsInput from './tags-input'
import ImageUploader from '@/app/admin/_components/image-uploader'
import LocationPicker from '@/app/admin/_components/location-picker'
import GalleryUploader from './gallery-uploader'
import { useIsMobile } from '@/lib/use-is-mobile'

type Block = {
  id: string
  type: BlockType
  city_id: string | null
  country_id: string | null
  title_ru: string | null
  title_en: string | null
  description_ru: string | null
  description_en: string | null
  image_url: string | null
  images: string[] | null
  location: string | null
  tags: string[] | null
  notable_amenities_ru: string | null
  notable_amenities_en: string | null
  duration_hours: number | null
  best_season_ru: string | null
  best_season_en: string | null
  vehicle_ru: string | null
  vehicle_en: string | null
  duration_min: number | null
  max_passengers: number | null
  notable_ru: string | null
  notable_en: string | null
  facts_ru: string | null
  facts_en: string | null
}

type Lang = 'ru' | 'en'
type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

const TYPES: { value: BlockType; label: string }[] = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'activity', label: 'Activity' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'city', label: 'City' },
]

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
  transition: 'border-color 0.15s',
}

export default function BlockForm({ block }: { block: Block }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo')
  const addToDay = searchParams.get('addToDay')
  const [lang, setLang] = useState<Lang>('ru')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const isMobile = useIsMobile()

  const [form, setForm] = useState({
    type: (block.type || 'hotel') as BlockType,
    city_id: block.city_id,
    country_id: block.country_id,
    title_ru: block.title_ru || '',
    title_en: block.title_en || '',
    description_ru: block.description_ru || '',
    description_en: block.description_en || '',
    image_url: block.image_url || '',
    images: (block.images ?? []) as string[],
    location: block.location || '',
    tags: block.tags || [],
    // hotel
    notable_amenities_ru: block.notable_amenities_ru || '',
    notable_amenities_en: block.notable_amenities_en || '',
    // activity
    duration_hours: block.duration_hours ?? '',
    best_season_ru: block.best_season_ru || '',
    best_season_en: block.best_season_en || '',
    // transfer
    vehicle_ru: block.vehicle_ru || '',
    vehicle_en: block.vehicle_en || '',
    duration_min: block.duration_min ?? '',
    max_passengers: block.max_passengers ?? '',
    // city
    notable_ru: block.notable_ru || '',
    notable_en: block.notable_en || '',
    facts_ru: block.facts_ru || '',
    facts_en: block.facts_en || '',
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
        await updateBlock(block.id, {
          type: currentForm.type,
          // hotel хранит город (страна вычисляется через city.country_id)
          city_id: currentForm.type === 'hotel' ? currentForm.city_id : null,
          // city хранит страну
          country_id: currentForm.type === 'city' ? currentForm.country_id : null,
          title_ru: currentForm.title_ru || null,
          title_en: currentForm.title_en || null,
          description_ru: currentForm.description_ru || null,
          description_en: currentForm.description_en || null,
          image_url: currentForm.image_url || null,
          images: currentForm.images,
          location: currentForm.location || null,
          tags: currentForm.tags,
          notable_amenities_ru: currentForm.type === 'hotel' ? (currentForm.notable_amenities_ru || null) : null,
          notable_amenities_en: currentForm.type === 'hotel' ? (currentForm.notable_amenities_en || null) : null,
          duration_hours: currentForm.type === 'activity'
            ? (currentForm.duration_hours === '' ? null : Number(currentForm.duration_hours))
            : null,
          best_season_ru: currentForm.type === 'activity' ? (currentForm.best_season_ru || null) : null,
          best_season_en: currentForm.type === 'activity' ? (currentForm.best_season_en || null) : null,
          vehicle_ru: currentForm.type === 'transfer' ? (currentForm.vehicle_ru || null) : null,
          vehicle_en: currentForm.type === 'transfer' ? (currentForm.vehicle_en || null) : null,
          duration_min: currentForm.type === 'transfer'
            ? (currentForm.duration_min === '' ? null : Number(currentForm.duration_min))
            : null,
          max_passengers: currentForm.type === 'transfer'
            ? (currentForm.max_passengers === '' ? null : Number(currentForm.max_passengers))
            : null,
          notable_ru: currentForm.type === 'city' ? (currentForm.notable_ru || null) : null,
          notable_en: currentForm.type === 'city' ? (currentForm.notable_en || null) : null,
          facts_ru: currentForm.type === 'city' ? (currentForm.facts_ru || null) : null,
          facts_en: currentForm.type === 'city' ? (currentForm.facts_en || null) : null,
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

  async function handleDone() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    if (saveState === 'editing' || saveState === 'error') {
      await saveNow(form)
    }
    if (inFlight.current) {
      await inFlight.current
    }

    // Если пришли из модалки proposal'а — добавляем блок в день и возвращаемся туда
    if (addToDay) {
      try {
        await addBlockToDay(addToDay, block.id)
      } catch {
        // Если не удалось — всё равно вернёмся, не блокируем поток
      }
    }

    router.push(returnTo || '/admin/library')
  }

  // Keys для двуязычных полей в зависимости от выбранного языка
  const titleKey = lang === 'ru' ? 'title_ru' : 'title_en'
  const descKey = lang === 'ru' ? 'description_ru' : 'description_en'
  const amenitiesKey = lang === 'ru' ? 'notable_amenities_ru' : 'notable_amenities_en'
  const seasonKey = lang === 'ru' ? 'best_season_ru' : 'best_season_en'
  const vehicleKey = lang === 'ru' ? 'vehicle_ru' : 'vehicle_en'
  const notableKey = lang === 'ru' ? 'notable_ru' : 'notable_en'
  const factsKey = lang === 'ru' ? 'facts_ru' : 'facts_en'

  function renderSaveIndicator() {
    if (saveState === 'error') return <span style={{ color: 'var(--admin-danger)' }}>● Error: {errorMsg}</span>
    if (saveState === 'saving') return <span style={{ color: 'var(--admin-accent)' }}>● Saving...</span>
    if (saveState === 'editing') return <span style={{ color: 'var(--admin-text-muted)' }}>● Editing...</span>
    if (saveState === 'saved' && savedAt) return <span style={{ color: 'var(--admin-success)' }}>● Saved at {savedAt.toLocaleTimeString()}</span>
    return <span style={{ color: 'var(--admin-text-muted)' }}>● All changes saved</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top bar: language + save indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--admin-border-card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', fontWeight: 500 }}>
            Editing in
          </span>
          <div style={{ display: 'inline-flex', borderRadius: '999px', overflow: 'hidden', border: '1px solid var(--admin-border)' }}>
            <button
              type="button"
              onClick={() => setLang('ru')}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                background: lang === 'ru' ? 'var(--admin-text-on-dark)' : 'transparent',
                color: lang === 'ru' ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (lang !== 'ru') e.currentTarget.style.color = 'var(--admin-text)'
              }}
              onMouseLeave={(e) => {
                if (lang !== 'ru') e.currentTarget.style.color = 'var(--admin-text-muted)'
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
                background: lang === 'en' ? 'var(--admin-text-on-dark)' : 'transparent',
                color: lang === 'en' ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (lang !== 'en') e.currentTarget.style.color = 'var(--admin-text)'
              }}
              onMouseLeave={(e) => {
                if (lang !== 'en') e.currentTarget.style.color = 'var(--admin-text-muted)'
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

      {/* Type selector */}
      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>Type</h2>
        <select
          value={form.type}
          onChange={(e) => set('type', e.target.value as BlockType)}
          style={inputStyle}
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>
          Changing type will show different specific fields below
        </p>
      </section>

      {/* Common fields */}
      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>
          Basic info <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400, fontSize: '13px' }}>· {lang.toUpperCase()}</span>
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Title</label>
            <input
              type="text"
              value={form[titleKey]}
              onChange={(e) => set(titleKey, e.target.value)}
              style={inputStyle}
              placeholder={lang === 'ru' ? 'Название блока' : 'Block title'}
            />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={form[descKey]}
              onChange={(e) => set(descKey, e.target.value)}
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              placeholder={lang === 'ru' ? 'Подробное описание...' : 'Detailed description...'}
            />
          </div>
        </div>
      </section>

      {/* Location & image */}
      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>Location & image</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {form.type === 'hotel' && (
            <LocationPicker
              mode="city"
              value={form.city_id}
              onChange={(id) => set('city_id', id)}
              label="Город"
            />
          )}

          {form.type === 'city' && (
            <LocationPicker
              mode="country"
              value={form.country_id}
              onChange={(id) => set('country_id', id)}
              label="Страна"
            />
          )}

          <div>
            <ImageUploader
              value={form.image_url}
              onChange={(url) => set('image_url', url)}
              label="Cover image"
              height={200}
            />
            <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>
              Shown first in the client gallery. If empty, the first gallery photo is used instead.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Gallery (additional photos)</label>
            <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 10px' }}>
              Extra photos shown to the client as a gallery. Drag to reorder.
            </p>
            <GalleryUploader
              images={form.images}
              onChange={(imgs) => set('images', imgs)}
            />
          </div>
        </div>
      </section>
      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>Tags</h2>
        <TagsInput
          value={form.tags}
          onChange={(tags) => set('tags', tags)}
        />
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>
          Press Enter or comma to add. Used for search. Same for both languages.
        </p>
      </section>

      {/* Type-specific fields */}
      {form.type === 'hotel' && (
        <section>
          <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>
            Hotel details <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400, fontSize: '13px' }}>· {lang.toUpperCase()}</span>
          </h2>
          <div>
            <label style={labelStyle}>Notable amenities</label>
            <textarea
              value={form[amenitiesKey]}
              onChange={(e) => set(amenitiesKey, e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              placeholder={lang === 'ru' ? 'Мишлен, спа, выход к пляжу...' : 'Michelin, spa, beach access...'}
            />
          </div>
        </section>
      )}

      {form.type === 'activity' && (
        <section>
          <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>
            Activity details <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400, fontSize: '13px' }}>· {lang.toUpperCase()}</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Duration (hours)</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.duration_hours}
                  onChange={(e) => set('duration_hours', e.target.value === '' ? '' : parseFloat(e.target.value))}
                  style={inputStyle}
                  placeholder="4"
                />
                <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>Same for both languages</p>
              </div>
              <div>
                <label style={labelStyle}>Best season</label>
                <input
                  type="text"
                  value={form[seasonKey]}
                  onChange={(e) => set(seasonKey, e.target.value)}
                  style={inputStyle}
                  placeholder={lang === 'ru' ? 'Конец июня — начало августа' : 'Late June — early August'}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {form.type === 'transfer' && (
        <section>
          <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>
            Transfer details <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400, fontSize: '13px' }}>· {lang.toUpperCase()}</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Vehicle</label>
              <input
                type="text"
                value={form[vehicleKey]}
                onChange={(e) => set(vehicleKey, e.target.value)}
                style={inputStyle}
                placeholder={lang === 'ru' ? 'Mercedes V-Class с водителем' : 'Mercedes V-Class with chauffeur'}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Duration (min)</label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={form.duration_min}
                  onChange={(e) => set('duration_min', e.target.value === '' ? '' : parseInt(e.target.value))}
                  style={inputStyle}
                  placeholder="90"
                />
              </div>
              <div>
                <label style={labelStyle}>Max passengers</label>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={form.max_passengers}
                  onChange={(e) => set('max_passengers', e.target.value === '' ? '' : parseInt(e.target.value))}
                  style={inputStyle}
                  placeholder="7"
                />
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0' }}>Duration and passengers are same for both languages</p>
          </div>
        </section>
      )}

      {form.type === 'city' && (
        <section>
          <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>
            City details <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400, fontSize: '13px' }}>· {lang.toUpperCase()}</span>
          </h2>
          <div>
            <label style={labelStyle}>Notable</label>
            <textarea
              value={form[notableKey]}
              onChange={(e) => set(notableKey, e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              placeholder={lang === 'ru' ? 'UNESCO, рынок по субботам...' : 'UNESCO, Saturday market...'}
            />
          </div>
          <div style={{ marginTop: '16px' }}>
            <label style={labelStyle}>Facts</label>
            <textarea
              value={form[factsKey]}
              onChange={(e) => set(factsKey, e.target.value)}
              rows={6}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              placeholder={lang === 'ru'
                ? 'Найроби — единственная столица с нацпарком в черте города\nСредняя температура круглый год — около 22°С'
                : 'Nairobi is the only capital with a national park inside the city\nAverage temperature year-round — about 22°C'}
            />
            <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>
              One fact per line. Shown as a list on destination pages.
            </p>
          </div>
        </section>
      )}

      {/* Done button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '16px',
        paddingTop: '24px',
        borderTop: '1px solid var(--admin-border-card)',
      }}>
        <button
          onClick={handleDone}
          disabled={saveState === 'saving'}
          style={{
            padding: '10px 24px',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '0.03em',
            background: 'var(--admin-text-on-dark)',
            color: 'var(--admin-dark-panel)',
            border: 'none',
            borderRadius: '8px',
            cursor: saveState === 'saving' ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            opacity: saveState === 'saving' ? 0.6 : 1,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            if (saveState !== 'saving') e.currentTarget.style.background = '#FFFFFF'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--admin-text-on-dark)'
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}