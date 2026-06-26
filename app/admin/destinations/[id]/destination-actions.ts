'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export type SectionType = 'route' | 'city' | 'activities' | 'hotel' | 'gallery' | 'sample_day'

export type DestinationSection = {
  id: string
  proposal_id: string
  type: SectionType
  sort_order: number
  title_ru: string | null
  title_en: string | null
  data: unknown
  city_block_id: string | null
  hotel_block_id: string | null
}

export type SectionUpdate = {
  title_ru?: string | null
  title_en?: string | null
  data?: unknown
  city_block_id?: string | null
  hotel_block_id?: string | null
}

// Получить все секции направления (по порядку)
export async function getSections(proposalId: string): Promise<DestinationSection[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('destination_sections')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as DestinationSection[]
}

// Добавить секцию в конец ленты
export async function addSection(proposalId: string, type: SectionType) {
  const supabase = await createSupabaseServer()

  const { data: existing } = await supabase
    .from('destination_sections')
    .select('sort_order')
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  const { error } = await supabase
    .from('destination_sections')
    .insert({
      proposal_id: proposalId,
      type,
      sort_order: nextOrder,
      data: {},
    })

  if (error) throw new Error(error.message)
  revalidatePath(`/admin/destinations/${proposalId}`)
}

// Обновить поля секции
export async function updateSection(sectionId: string, updates: SectionUpdate) {
  const supabase = await createSupabaseServer()

  const { data: sec } = await supabase
    .from('destination_sections')
    .select('proposal_id')
    .eq('id', sectionId)
    .single()

  const { error } = await supabase
    .from('destination_sections')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', sectionId)

  if (error) throw new Error(error.message)
  if (sec?.proposal_id) revalidatePath(`/admin/destinations/${sec.proposal_id}`)
}

// Удалить секцию
export async function deleteSection(sectionId: string) {
  const supabase = await createSupabaseServer()

  const { data: sec } = await supabase
    .from('destination_sections')
    .select('proposal_id')
    .eq('id', sectionId)
    .single()

  const { error } = await supabase
    .from('destination_sections')
    .delete()
    .eq('id', sectionId)

  if (error) throw new Error(error.message)
  if (sec?.proposal_id) revalidatePath(`/admin/destinations/${sec.proposal_id}`)
}

// Переставить секции (массив id в новом порядке)
export async function reorderSections(proposalId: string, orderedIds: string[]) {
  const supabase = await createSupabaseServer()

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('destination_sections')
        .update({ sort_order: index })
        .eq('id', id)
    )
  )

  revalidatePath(`/admin/destinations/${proposalId}`)
}