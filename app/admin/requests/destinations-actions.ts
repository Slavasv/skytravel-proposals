'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export type RequestDestination = {
  id: string
  request_id: string
  region: string | null
  country_id: string | null
  city_ids: string[]
  sort_order: number
}

// Получить направления запроса
export async function getRequestDestinations(requestId: string): Promise<RequestDestination[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('request_destinations')
    .select('*')
    .eq('request_id', requestId)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as RequestDestination[]
}

// Добавить пустое направление
export async function addRequestDestination(requestId: string): Promise<RequestDestination | null> {
  const supabase = await createSupabaseServer()

  const { data: existing } = await supabase
    .from('request_destinations')
    .select('sort_order')
    .eq('request_id', requestId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  const { data, error } = await supabase
    .from('request_destinations')
    .insert({ request_id: requestId, city_ids: [], sort_order: nextOrder })
    .select()
    .single()

  if (error) return null
  revalidatePath(`/admin/requests/${requestId}`)
  return data as RequestDestination
}

// Обновить направление (страна и/или города)
export async function updateRequestDestination(
  id: string,
  updates: { country_id?: string | null; city_ids?: string[]; region?: string | null }
) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('request_destinations')
    .update(updates)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// Удалить направление
export async function deleteRequestDestination(id: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('request_destinations')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// Сводка направлений для списка запросов: requestId -> "Italy: Rome, Milan · France: Lyon"
export async function getDestinationsSummary(
  requestIds: string[]
): Promise<Record<string, string>> {
  if (!requestIds || requestIds.length === 0) return {}
  const supabase = await createSupabaseServer()

  const { data: dests } = await supabase
    .from('request_destinations')
    .select('request_id, country_id, city_ids, sort_order')
    .in('request_id', requestIds)
    .order('sort_order', { ascending: true })

  if (!dests || dests.length === 0) return {}

  // собрать все id стран и городов
  const countryIds = new Set<string>()
  const cityIds = new Set<string>()
  dests.forEach((d) => {
    if (d.country_id) countryIds.add(d.country_id)
    ;(d.city_ids || []).forEach((c: string) => cityIds.add(c))
  })

  const [countriesRes, citiesRes] = await Promise.all([
    countryIds.size > 0
      ? supabase.from('countries').select('id, name_en').in('id', Array.from(countryIds))
      : Promise.resolve({ data: [] as { id: string; name_en: string }[] }),
    cityIds.size > 0
      ? supabase.from('cities').select('id, name_en').in('id', Array.from(cityIds))
      : Promise.resolve({ data: [] as { id: string; name_en: string }[] }),
  ])

  const countryName: Record<string, string> = {}
  ;(countriesRes.data ?? []).forEach((c) => { countryName[c.id] = c.name_en })
  const cityName: Record<string, string> = {}
  ;(citiesRes.data ?? []).forEach((c) => { cityName[c.id] = c.name_en })

  // собрать строку по каждому запросу
  const byRequest: Record<string, string[]> = {}
  dests.forEach((d) => {
    const country = d.country_id ? countryName[d.country_id] : ''
    const cities = (d.city_ids || []).map((c: string) => cityName[c]).filter(Boolean)
    let part = ''
    if (country && cities.length > 0) part = `${country}: ${cities.join(', ')}`
    else if (country) part = country
    else if (cities.length > 0) part = cities.join(', ')
    if (part) {
      if (!byRequest[d.request_id]) byRequest[d.request_id] = []
      byRequest[d.request_id].push(part)
    }
  })

  const result: Record<string, string> = {}
  Object.entries(byRequest).forEach(([reqId, parts]) => {
    result[reqId] = parts.join(' · ')
  })
  return result
}