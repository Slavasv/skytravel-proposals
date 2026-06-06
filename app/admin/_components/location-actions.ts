'use server'

import { createSupabaseServer } from '@/lib/supabase-server'

export type CountryRow = { id: string; name_ru: string; name_en: string }
export type CityRow = { id: string; name_ru: string; name_en: string; country_id: string }

// Поиск стран по подстроке (ru + en, ilike)
export async function searchCountries(query: string): Promise<CountryRow[]> {
  const supabase = await createSupabaseServer()
  const q = query.trim()

  let req = supabase
    .from('countries')
    .select('id, name_ru, name_en')
    .eq('is_active', true)
    .order('name_ru')
    .limit(20)

  if (q) {
    req = req.or(`name_ru.ilike.%${q}%,name_en.ilike.%${q}%`)
  }

  const { data, error } = await req
  if (error) throw new Error(error.message)
  return data ?? []
}

// Поиск городов по подстроке (ru + en, ilike)
export async function searchCities(query: string, countryId?: string | null): Promise<CityRow[]> {
  const supabase = await createSupabaseServer()
  const q = query.trim()

  let req = supabase
    .from('cities')
    .select('id, name_ru, name_en, country_id')
    .eq('is_active', true)
    .order('name_ru')
    .limit(20)

  if (countryId) {
    req = req.eq('country_id', countryId)
  }

  if (q) {
    req = req.or(`name_ru.ilike.%${q}%,name_en.ilike.%${q}%`)
  }

  const { data, error } = await req
  if (error) throw new Error(error.message)
  return data ?? []
}

// Создание страны
export async function createCountry(nameRu: string, nameEn: string): Promise<CountryRow> {
  const supabase = await createSupabaseServer()
  const ru = nameRu.trim()
  const en = nameEn.trim()

  if (!ru || !en) throw new Error('Нужно указать название на двух языках')

  const { data, error } = await supabase
    .from('countries')
    .insert({ name_ru: ru, name_en: en })
    .select('id, name_ru, name_en')
    .single()

  if (error) throw new Error(error.message)
  return data
}

// Создание города (с обязательной привязкой к стране)
export async function createCity(
  nameRu: string,
  nameEn: string,
  countryId: string
): Promise<CityRow> {
  const supabase = await createSupabaseServer()
  const ru = nameRu.trim()
  const en = nameEn.trim()

  if (!ru || !en) throw new Error('Нужно указать название на двух языках')
  if (!countryId) throw new Error('Не указана страна')

  const { data, error } = await supabase
    .from('cities')
    .insert({ name_ru: ru, name_en: en, country_id: countryId })
    .select('id, name_ru, name_en, country_id')
    .single()

  if (error) throw new Error(error.message)
  return data
}