'use client'

import { useState, useEffect, useRef } from 'react'
import { useT } from '@/lib/i18n-client'
import {
  searchCountries,
  searchCities,
  createCountry,
  createCity,
  type CountryRow,
  type CityRow,
} from './location-actions'

type Mode = 'country' | 'city'

type Props = {
  mode: Mode
  value: string | null
  onChange: (id: string | null) => void
  label?: string
  disableCreate?: boolean
  countryFilter?: string | null // только для mode='city': показывать города этой страны
}

type Item = CountryRow | CityRow

export default function LocationPicker({ mode, value, onChange, label, disableCreate, countryFilter }: Props) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [open, setOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [newRu, setNewRu] = useState('')
  const [newEn, setNewEn] = useState('')
  const [newCountryId, setNewCountryId] = useState<string | null>(null)
  const [countriesForNewCity, setCountriesForNewCity] = useState<CountryRow[]>([])
  const [creatingCountryInline, setCreatingCountryInline] = useState(false)
  const [inlineCountryRu, setInlineCountryRu] = useState('')
  const [inlineCountryEn, setInlineCountryEn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // При инициализации подгружаем label выбранного элемента
  useEffect(() => {
    async function loadCurrent() {
      if (!value) {
        setSelectedLabel('')
        return
      }
      try {
        // Для подгрузки label выбранного города НЕ фильтруем по стране —
        // иначе если страна изменилась, label выбранного города пропадёт.
        const results = mode === 'country' ? await searchCountries('') : await searchCities('')
        const found = results.find((r) => r.id === value)
        if (found) setSelectedLabel(`${found.name_ru} / ${found.name_en}`)
      } catch {/* ignore */}
    }
    loadCurrent()
  }, [value, mode])

  // Поиск с debounce
  useEffect(() => {
    if (!open) return
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      try {
        const results = mode === 'country'
          ? await searchCountries(query)
          : await searchCities(query, countryFilter)
        setItems(results)
      } catch (e) {
        setError(e instanceof Error ? e.message : t('Search error', 'Ошибка поиска'))
      }
    }, 200)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [query, open, mode, countryFilter])

  // Закрытие по клику вне
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleSelect(item: Item) {
    onChange(item.id)
    setSelectedLabel(`${item.name_ru} / ${item.name_en}`)
    setOpen(false)
    setQuery('')
  }

  function handleClear() {
    onChange(null)
    setSelectedLabel('')
    setQuery('')
  }

  async function startCreating() {
    setError('')
    setNewRu(query)
    setNewEn(query)
    if (mode === 'city') {
      try {
        const list = await searchCountries('')
        setCountriesForNewCity(list)
        setNewCountryId(list[0]?.id ?? null)
      } catch (e) {
        setError(e instanceof Error ? e.message : t('Failed to load countries', 'Не удалось загрузить страны'))
      }
    }
    setCreating(true)
  }

  async function handleCreate() {
    setError('')
    setBusy(true)
    try {
      let created: Item
      if (mode === 'country') {
        created = await createCountry(newRu, newEn)
      } else {
        if (!newCountryId) throw new Error(t('Select a country', 'Выберите страну'))
        created = await createCity(newRu, newEn, newCountryId)
      }
      handleSelect(created)
      setCreating(false)
      setNewRu('')
      setNewEn('')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Creation error', 'Ошибка создания'))
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateCountryInline() {
    setError('')
    setBusy(true)
    try {
      const country = await createCountry(inlineCountryRu, inlineCountryEn)
      // Добавляем в список и сразу выбираем
      setCountriesForNewCity((prev) => [...prev, country])
      setNewCountryId(country.id)
      // Сворачиваем под-форму
      setCreatingCountryInline(false)
      setInlineCountryRu('')
      setInlineCountryEn('')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Failed to create country', 'Ошибка создания страны'))
    } finally {
      setBusy(false)
    }
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

  const placeholder = mode === 'country' ? t('Search country...', 'Поиск страны...') : t('Search city...', 'Поиск города...')

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {label && (
        <label style={{
          display: 'block',
          fontSize: '11px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--admin-text-muted)',
          marginBottom: '6px',
          fontWeight: 500,
        }}>
          {label}
        </label>
      )}

      {/* Если что-то выбрано — показываем «чип» с возможностью сбросить */}
      {value && selectedLabel && !open ? (
        <div
          onClick={() => setOpen(true)}
          style={{
            ...inputStyle,
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{selectedLabel}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleClear() }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--admin-text-muted)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0 4px',
              lineHeight: 1,
            }}
            title={t('Clear', 'Сбросить')}
          >
            ×
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          style={inputStyle}
        />
      )}

      {/* Дропдаун с результатами + кнопка «создать» */}
      {open && !creating && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'var(--admin-input)',
          border: '1px solid var(--admin-border)',
          borderRadius: '6px',
          maxHeight: '300px',
          overflowY: 'auto',
          zIndex: 100,
          boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
        }}>
          {items.length === 0 ? (
            <div style={{ padding: '12px', fontSize: '13px', color: 'var(--admin-text-muted)' }}>
              {query ? t(`Nothing found for "${query}"`, `Ничего не найдено по "${query}"`) : t('Start typing...', 'Начните вводить...')}
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                style={{
                  padding: '10px 12px',
                  fontSize: '14px',
                  color: 'var(--admin-text)',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--admin-border-card)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                {item.name_ru} <span style={{ color: 'var(--admin-text-muted)' }}>· {item.name_en}</span>
              </div>
            ))
          )}

          {!disableCreate && (
            <div
              onClick={startCreating}
              style={{
                padding: '10px 12px',
                fontSize: '13px',
                color: 'var(--admin-accent)',
                cursor: 'pointer',
                borderTop: '1px solid var(--admin-border-card)',
                fontWeight: 500,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              + {mode === 'country' ? t('Create country', 'Создать страну') : t('Create city', 'Создать город')}{query ? ` «${query}»` : ''}
            </div>
          )}
        </div>
      )}

      {/* Мини-форма создания */}
      {open && creating && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'var(--admin-input)',
          border: '1px solid var(--admin-border)',
          borderRadius: '6px',
          padding: '12px',
          zIndex: 100,
          boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '4px' }}>
            {mode === 'country' ? t('New country', 'Новая страна') : t('New city', 'Новый город')}
          </div>
          <input
            type="text"
            value={newRu}
            onChange={(e) => setNewRu(e.target.value)}
            placeholder={t('Name in Russian', 'Название на русском')}
            autoFocus
            style={inputStyle}
          />
          <input
            type="text"
            value={newEn}
            onChange={(e) => setNewEn(e.target.value)}
            placeholder={t('Name in English', 'Название на английском')}
            style={inputStyle}
          />
          {mode === 'city' && !creatingCountryInline && (
            <>
              <select
                value={newCountryId ?? ''}
                onChange={(e) => setNewCountryId(e.target.value || null)}
                style={inputStyle}
              >
                <option value="">{t('— select country —', '— выберите страну —')}</option>
                {countriesForNewCity.map((c) => (
                  <option key={c.id} value={c.id}>{c.name_ru} / {c.name_en}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setCreatingCountryInline(true)}
                style={{
                  padding: '6px 10px',
                  fontSize: '12px',
                  background: 'transparent',
                  color: 'var(--admin-accent)',
                  border: '1px dashed var(--admin-border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                }}
              >
                + {t('Create new country', 'Создать новую страну')}
              </button>
            </>
          )}

          {mode === 'city' && creatingCountryInline && (
            <div style={{
              padding: '10px',
              border: '1px solid var(--admin-border-hover)',
              borderRadius: '6px',
              background: 'var(--admin-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                {t('New country', 'Новая страна')}
              </div>
              <input
                type="text"
                value={inlineCountryRu}
                onChange={(e) => setInlineCountryRu(e.target.value)}
                placeholder={t('Name in Russian', 'Название на русском')}
                autoFocus
                style={inputStyle}
              />
              <input
                type="text"
                value={inlineCountryEn}
                onChange={(e) => setInlineCountryEn(e.target.value)}
                placeholder={t('Name in English', 'Название на английском')}
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCreateCountryInline}
                  disabled={busy || !inlineCountryRu || !inlineCountryEn}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 500,
                    background: 'var(--admin-text-on-dark)',
                    color: 'var(--admin-dark-panel)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: busy ? 'wait' : 'pointer',
                    opacity: busy || !inlineCountryRu || !inlineCountryEn ? 0.4 : 1,
                    fontFamily: 'inherit',
                  }}
                >
                  {busy ? t('Creating...', 'Создание...') : t('Create country', 'Создать страну')}
                </button>
                <button
                  type="button"
                  onClick={() => { setCreatingCountryInline(false); setInlineCountryRu(''); setInlineCountryEn('') }}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    background: 'transparent',
                    color: 'var(--admin-text-muted)',
                    border: '1px solid var(--admin-border)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t('Cancel', 'Отмена')}
                </button>
              </div>
            </div>
          )}
          {error && <div style={{ fontSize: '12px', color: 'var(--admin-danger)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleCreate}
              disabled={busy || !newRu || !newEn || (mode === 'city' && !newCountryId)}
              style={{
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 500,
                background: 'var(--admin-text-on-dark)',
                color: 'var(--admin-dark-panel)',
                border: 'none',
                borderRadius: '6px',
                cursor: busy ? 'wait' : 'pointer',
                opacity: busy || !newRu || !newEn || (mode === 'city' && !newCountryId) ? 0.4 : 1,
                fontFamily: 'inherit',
              }}
            >
              {busy ? t('Creating...', 'Создание...') : t('Create', 'Создать')}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setError('') }}
              style={{
                padding: '8px 14px',
                fontSize: '13px',
                background: 'transparent',
                color: 'var(--admin-text-muted)',
                border: '1px solid var(--admin-border)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('Cancel', 'Отмена')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}