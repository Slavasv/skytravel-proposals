'use server'

import { createSupabaseServer } from '@/lib/supabase-server'

export type FlightKind = 'outbound' | 'return' | 'internal'
export type FlightClass = 'economy' | 'premium' | 'business' | 'first' | 'charter'

export type FlightSegment = {
  id: string
  variant_id: string
  sort_order: number
  kind: FlightKind
  flight_date: string | null
  from_place: string | null
  to_place: string | null
  airline: string | null
  flight_no: string | null
  depart_time: string | null
  arrive_time: string | null
  stops: string | null
  travel_class: FlightClass
  price: number | null
  price_currency: string
  note: string | null
}

export async function getFlights(variantId: string): Promise<FlightSegment[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('flight_segments')
    .select('*')
    .eq('variant_id', variantId)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as FlightSegment[]
}

export async function addFlight(variantId: string): Promise<FlightSegment | null> {
  const supabase = await createSupabaseServer()
  const { data: last } = await supabase
    .from('flight_segments').select('sort_order').eq('variant_id', variantId)
    .order('sort_order', { ascending: false }).limit(1)
  const nextOrder = last && last.length > 0 ? (last[0].sort_order as number) + 1 : 0
  // первое плечо — «туда», второе — «обратно», дальше «внутренний»
  const kind: FlightKind = nextOrder === 0 ? 'outbound' : nextOrder === 1 ? 'return' : 'internal'
  const { data, error } = await supabase
    .from('flight_segments')
    .insert({ variant_id: variantId, sort_order: nextOrder, kind })
    .select('*').single()
  if (error || !data) return null
  return data as FlightSegment
}

export async function updateFlight(id: string, patch: Partial<Omit<FlightSegment, 'id' | 'variant_id'>>): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('flight_segments').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteFlight(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('flight_segments').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
