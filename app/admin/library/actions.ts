'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type BlockType = 'hotel' | 'activity' | 'transfer' | 'city'

export type BlockUpdate = {
  type?: BlockType
  city_id?: string | null
  country_id?: string | null
  title_ru?: string | null
  title_en?: string | null
  description_ru?: string | null
  description_en?: string | null
  image_url?: string | null
  images?: string[]
  location?: string | null
  tags?: string[]
  notable_amenities_ru?: string | null
  notable_amenities_en?: string | null
  duration_hours?: number | null
  best_season_ru?: string | null
  best_season_en?: string | null
  vehicle_ru?: string | null
  vehicle_en?: string | null
  duration_min?: number | null
  max_passengers?: number | null
  notable_ru?: string | null
  notable_en?: string | null
  facts_ru?: string | null
  facts_en?: string | null
}

export async function createBlock() {
  const supabase = await createSupabaseServer()

  const { data, error } = await supabase
    .from('content_blocks')
    .insert({
      type: 'hotel',
      title_ru: null,
      title_en: null,
      tags: [],
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create block')
  }

  revalidatePath('/admin/library')
  redirect(`/admin/library/${data.id}`)
}
export async function createBlockMinimal(input: {
  type: BlockType
  title_ru: string
  title_en: string
  city_id: string | null
  country_id: string | null
}): Promise<string> {
  const supabase = await createSupabaseServer()

  // Для activity/transfer гео обнуляем (на всякий случай — модалка их и не пришлёт)
  const city_id = input.type === 'hotel' ? input.city_id : null
  const country_id = input.type === 'city' ? input.country_id : null

  const { data, error } = await supabase
    .from('content_blocks')
    .insert({
      type: input.type,
      title_ru: input.title_ru.trim() || null,
      title_en: input.title_en.trim() || null,
      city_id,
      country_id,
      tags: [],
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create block')
  }

  revalidatePath('/admin/library')
  return data.id
}

export async function updateBlock(id: string, updates: BlockUpdate) {
  const supabase = await createSupabaseServer()

  const { error } = await supabase
    .from('content_blocks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/library')
  revalidatePath(`/admin/library/${id}`)
}

export async function archiveBlock(id: string) {
  const supabase = await createSupabaseServer()

  const { error } = await supabase
    .from('content_blocks')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/library')
}

export async function unarchiveBlock(id: string) {
  const supabase = await createSupabaseServer()

  const { error } = await supabase
    .from('content_blocks')
    .update({ archived_at: null })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/library')
}

export async function deleteBlock(id: string) {
  const supabase = await createSupabaseServer()

  const { count, error: countError } = await supabase
    .from('day_blocks')
    .select('*', { count: 'exact', head: true })
    .eq('block_id', id)

  if (countError) throw new Error(countError.message)

  if (count && count > 0) {
    throw new Error(`Cannot delete: this block is used in ${count} day(s) across proposals`)
  }

  const { error } = await supabase
    .from('content_blocks')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/library')
}

export async function getBlockUsage(id: string): Promise<number> {
  const supabase = await createSupabaseServer()

  const { count, error } = await supabase
    .from('day_blocks')
    .select('*', { count: 'exact', head: true })
    .eq('block_id', id)

  if (error) return 0
  return count ?? 0
}