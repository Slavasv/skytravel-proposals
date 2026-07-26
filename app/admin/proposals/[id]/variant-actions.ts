'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export type VariantBrief = {
  id: string
  sort_order: number
  name_ru: string | null
  name_en: string | null
  subtitle_ru: string | null
  subtitle_en: string | null
  is_selected: boolean
  total_price: number | null
}

export type VariantFull = {
  id: string
  payment_terms_ru: string | null
  payment_terms_en: string | null
  cancellation_policy_ru: string | null
  cancellation_policy_en: string | null
  cost_includes_ru: string | null
  cost_includes_en: string | null
  cost_excludes_ru: string | null
  cost_excludes_en: string | null
  cost_notes_ru: string | null
  cost_notes_en: string | null
  gallery: unknown
}

// Все варианты предложения
export async function getVariants(proposalId: string): Promise<VariantBrief[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('proposal_variants')
    .select('id, sort_order, name_ru, name_en, subtitle_ru, subtitle_en, is_selected, total_price')
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as VariantBrief[]
}

// Создать пустой вариант
export async function createVariant(proposalId: string): Promise<string | null> {
  const supabase = await createSupabaseServer()

  const { data: existing } = await supabase
    .from('proposal_variants')
    .select('sort_order')
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0
  const num = nextOrder + 1

  const { data, error } = await supabase
    .from('proposal_variants')
    .insert({
      proposal_id: proposalId,
      sort_order: nextOrder,
      name_ru: `Маршрут ${num}`,
      name_en: `Route ${num}`,
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(error?.message || 'Failed to create variant')
  revalidatePath(`/admin/proposals/${proposalId}`)
  return data.id
}

export type VariantUpdate = {
  name_ru?: string | null
  name_en?: string | null
  subtitle_ru?: string | null
  subtitle_en?: string | null
  total_price?: number | null
  payment_terms_ru?: string | null
  payment_terms_en?: string | null
  cancellation_policy_ru?: string | null
  cancellation_policy_en?: string | null
  cost_includes_ru?: string | null
  cost_includes_en?: string | null
  cost_excludes_ru?: string | null
  cost_excludes_en?: string | null
  cost_notes_ru?: string | null
  cost_notes_en?: string | null
  gallery?: unknown
}

export async function updateVariant(variantId: string, updates: VariantUpdate) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('proposal_variants')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', variantId)
  if (error) throw new Error(error.message)
}

// Отметить выбранный вариант (клиент выбрал) — один на предложение
export async function selectVariant(proposalId: string, variantId: string) {
  const supabase = await createSupabaseServer()
  await supabase
    .from('proposal_variants')
    .update({ is_selected: false })
    .eq('proposal_id', proposalId)
  const { error } = await supabase
    .from('proposal_variants')
    .update({ is_selected: true })
    .eq('id', variantId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/proposals/${proposalId}`)
}

// Удалить вариант (нельзя удалить последний)
export async function deleteVariant(proposalId: string, variantId: string) {
  const supabase = await createSupabaseServer()

  const { count } = await supabase
    .from('proposal_variants')
    .select('id', { count: 'exact', head: true })
    .eq('proposal_id', proposalId)

  if ((count ?? 0) <= 1) {
    throw new Error('Cannot delete the last variant')
  }

  const { error } = await supabase
    .from('proposal_variants')
    .delete()
    .eq('id', variantId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/proposals/${proposalId}`)
}