'use client'

import { useState, useEffect } from 'react'
import LocationPicker from '@/app/admin/_components/location-picker'
import { getCitiesByIds, getCityCountry, type CityRow } from '@/app/admin/_components/location-actions'
import {
  addRequestDestination,
  updateRequestDestination,
  deleteRequestDestination,
  type RequestDestination,
} from '../destinations-actions'

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', marginBottom: '6px', fontWeight: 500,
}

// Одно направление: страна + теги городов
function DestinationCard({
  dest, index, onRemove,
}: {
  dest: RequestDestination
  index: number
  onRemove: (id: string) => void
}) {
  const [countryId, setCountryId] = useState<string | null>(dest.country_id)
  const [cityIds, setCityIds] = useState<string[]>(dest.city_ids || [])
  const [cityLabels, setCityLabels] = useState<Record<string, string>>({})
  // ключ пересоздаёт city-picker, чтобы он очищался после выбора
  const [cityPickerKey, setCityPickerKey] = useState(0)

  // подгружаем названия выбранных городов (для тегов)
  useEffect(() => {
    let cancelled = false
    if (cityIds.length === 0) { setCityLabels({}); return }
    getCitiesByIds(cityIds).then((rows: CityRow[]) => {
      if (cancelled) return
      const map: Record<string, string> = {}
      rows.forEach((r) => { map[r.id] = `${r.name_ru} / ${r.name_en}` })
      setCityLabels(map)
    })
    return () => { cancelled = true }
  }, [cityIds])

  async function persist(nextCountry: string | null, nextCities: string[]) {
    await updateRequestDestination(dest.id, { country_id: nextCountry, city_ids: nextCities })
  }

  async function handleCountryChange(id: string | null) {
    setCountryId(id)
    // при смене страны сбрасываем города (они принадлежали другой стране)
    setCityIds([])
    await persist(id, [])
    setCityPickerKey((k) => k + 1)
  }

  async function handleCityPicked(id: string | null) {
    if (!id) return
    if (cityIds.includes(id)) { setCityPickerKey((k) => k + 1); return }

    // если страна ещё не выбрана — подтянем её из города
    let country = countryId
    if (!country) {
      country = await getCityCountry(id)
      if (country) setCountryId(country)
    }

    const next = [...cityIds, id]
    setCityIds(next)
    await persist(country, next)
    setCityPickerKey((k) => k + 1)  // очистить пикер для следующего города
  }

  async function removeCity(id: string) {
    const next = cityIds.filter((c) => c !== id)
    setCityIds(next)
    await persist(countryId, next)
  }

  return (
    <div style={{ border: '1px solid var(--admin-border-card)', borderRadius: '10px', padding: '16px', marginBottom: '12px', background: 'var(--admin-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>Destination {index + 1}</span>
        <button type="button" onClick={() => onRemove(dest.id)}
          style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '5px 8px', fontFamily: 'inherit' }}>
          ✕ Remove
        </button>
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>Country</label>
        <LocationPicker mode="country" value={countryId} onChange={handleCountryChange} />
      </div>

      <div>
        <label style={labelStyle}>Cities</label>

        {/* теги выбранных городов */}
        {cityIds.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {cityIds.map((cid) => (
              <span key={cid} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--admin-input)', border: '1px solid var(--admin-border)', borderRadius: '6px', padding: '4px 8px', fontSize: '13px', color: 'var(--admin-text)' }}>
                {cityLabels[cid] || '…'}
                <button type="button" onClick={() => removeCity(cid)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: 0, fontFamily: 'inherit' }}>×</button>
              </span>
            ))}
          </div>
        )}

        {/* пикер для добавления города; фильтр по выбранной стране */}
        <LocationPicker
          key={cityPickerKey}
          mode="city"
          value={null}
          onChange={handleCityPicked}
          countryFilter={countryId}
        />
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>
          Pick cities one by one. Choosing a city without a country will fill the country automatically.
        </p>
      </div>
    </div>
  )
}

export default function RequestDestinations({
  requestId, initial,
}: {
  requestId: string
  initial: RequestDestination[]
}) {
  const [dests, setDests] = useState<RequestDestination[]>(initial)

  async function handleAdd() {
    const created = await addRequestDestination(requestId)
    if (created) setDests((prev) => [...prev, created])
  }

  async function handleRemove(id: string) {
    setDests((prev) => prev.filter((d) => d.id !== id))
    await deleteRequestDestination(id)
  }

  return (
    <div>
      {dests.map((d, i) => (
        <DestinationCard key={d.id} dest={d} index={i} onRemove={handleRemove} />
      ))}
      <button type="button" onClick={handleAdd}
        style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', marginTop: dests.length > 0 ? '4px' : '0' }}>
        + Add destination
      </button>
    </div>
  )
}