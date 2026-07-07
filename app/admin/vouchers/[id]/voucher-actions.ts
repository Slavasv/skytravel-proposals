'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export type Guest = {
  id: string
  title: string      // Mr / Mrs / Ms / Miss / ''
  name: string
  is_child: boolean
  birth_date: string // текст, только если is_child
}

export type VoucherUpdate = {
  issue_date?: string | null
  greeting_for?: string | null
  guests?: unknown
  show_transfer?: boolean
  transfers?: unknown
  notes?: string | null
}

export async function updateVoucher(id: string, updates: VoucherUpdate) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('vouchers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/vouchers/${id}`)
}

// ============ Слаг ваучера ============

// чистит слаг: нижний регистр, пробелы→дефисы, только буквы/цифры/дефис
function cleanSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// возвращает { ok, error } — проверяет уникальность
export async function updateVoucherSlug(id: string, rawSlug: string): Promise<{ ok: boolean; slug?: string; error?: string }> {
  const slug = cleanSlug(rawSlug)
  if (!slug) return { ok: false, error: 'Slug cannot be empty' }

  const supabase = await createSupabaseServer()

  // занят ли слаг другим ваучером?
  const { data: existing } = await supabase
    .from('vouchers')
    .select('id')
    .eq('slug', slug)
    .neq('id', id)
    .maybeSingle()

  if (existing) return { ok: false, error: 'This link is already taken' }

  const { error } = await supabase
    .from('vouchers')
    .update({ slug, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/admin/vouchers/${id}`)
  return { ok: true, slug }
}

// ============ Блоки отелей ваучера ============

export type VoucherHotel = {
  id: string
  voucher_id: string
  sort_order: number
  city: string | null
  country: string | null
  booking_ref: string | null
  name: string | null
  address: string | null
  phone: string | null
  check_in: string | null
  check_out: string | null
  nights: string | null
  room_type: string | null
  meal_plan: string | null
  extras: string | null
}

export type HotelUpdate = {
  city?: string | null
  country?: string | null
  booking_ref?: string | null
  name?: string | null
  address?: string | null
  phone?: string | null
  check_in?: string | null
  check_out?: string | null
  nights?: string | null
  room_type?: string | null
  meal_plan?: string | null
  extras?: string | null
}

export async function getHotels(voucherId: string): Promise<VoucherHotel[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('voucher_hotels')
    .select('*')
    .eq('voucher_id', voucherId)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as VoucherHotel[]
}

export async function addHotel(voucherId: string) {
  const supabase = await createSupabaseServer()
  const { data: existing } = await supabase
    .from('voucher_hotels')
    .select('sort_order')
    .eq('voucher_id', voucherId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  const { data, error } = await supabase
    .from('voucher_hotels')
    .insert({ voucher_id: voucherId, sort_order: nextOrder })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/vouchers/${voucherId}`)
  return data as VoucherHotel
}

export async function updateHotel(hotelId: string, updates: HotelUpdate) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('voucher_hotels')
    .update(updates)
    .eq('id', hotelId)
  if (error) throw new Error(error.message)
}

export async function deleteHotel(hotelId: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('voucher_hotels')
    .delete()
    .eq('id', hotelId)
  if (error) throw new Error(error.message)
}

export async function reorderHotels(orderedIds: string[]) {
  const supabase = await createSupabaseServer()
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('voucher_hotels').update({ sort_order: index }).eq('id', id)
    )
  )
}