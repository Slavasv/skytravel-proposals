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

// Получить краткую инфу о блоке (для превью выбранного city/hotel в секции)
export type BlockBrief = {
  id: string
  type: string
  title_ru: string | null
  title_en: string | null
  image_url: string | null
  facts_ru: string | null
  facts_en: string | null
}

export async function getBlockBrief(blockId: string): Promise<BlockBrief | null> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('content_blocks')
    .select('id, type, title_ru, title_en, image_url, facts_ru, facts_en')
    .eq('id', blockId)
    .single()
  if (error || !data) return null
  return data as BlockBrief
}

// ============ Блоки внутри секции (для activities: несколько блocков) ============

export type SectionBlockItem = {
  id: string          // id строки destination_section_blocks
  block_id: string
  sort_order: number
  title_ru: string | null
  title_en: string | null
  image_url: string | null
  duration_hours: number | null
}

// Получить блоки секции (с краткой инфой)
export async function getSectionBlocks(sectionId: string): Promise<SectionBlockItem[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('destination_section_blocks')
    .select('id, block_id, sort_order, content_blocks(title_ru, title_en, image_url, duration_hours)')
    .eq('section_id', sectionId)
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data.map((row) => {
    const cb = Array.isArray(row.content_blocks) ? row.content_blocks[0] : row.content_blocks
    return {
      id: row.id as string,
      block_id: row.block_id as string,
      sort_order: row.sort_order as number,
      title_ru: cb?.title_ru ?? null,
      title_en: cb?.title_en ?? null,
      image_url: cb?.image_url ?? null,
      duration_hours: cb?.duration_hours ?? null,
    }
  })
}

// Привязать блок к секции (в конец)
export async function addBlockToSection(sectionId: string, blockId: string) {
  const supabase = await createSupabaseServer()
  const { data: existing } = await supabase
    .from('destination_section_blocks')
    .select('sort_order')
    .eq('section_id', sectionId)
    .order('sort_order', { ascending: false })
    .limit(1)
  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0
  const { error } = await supabase
    .from('destination_section_blocks')
    .insert({ section_id: sectionId, block_id: blockId, sort_order: nextOrder })
  if (error) throw new Error(error.message)
}

// Отвязать блок от секции
export async function removeBlockFromSection(rowId: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('destination_section_blocks')
    .delete()
    .eq('id', rowId)
  if (error) throw new Error(error.message)
}

// Переставить блоки секции (массив id строк в новом порядке)
export async function reorderSectionBlocks(orderedRowIds: string[]) {
  const supabase = await createSupabaseServer()
  await Promise.all(
    orderedRowIds.map((id, index) =>
      supabase.from('destination_section_blocks').update({ sort_order: index }).eq('id', id)
    )
  )
}

// Универсальная привязка блока к секции после создания из библиотеки.
// kind='city' → пишем в city_block_id секции (одиночная привязка)
// kind='hotel' → пишем в hotel_block_id секции (одиночная)
// kind='blocks' → добавляем в destination_section_blocks (множественная, для activities)
export async function attachBlockToSection(
  sectionId: string,
  blockId: string,
  kind: 'city' | 'hotel' | 'blocks'
) {
  const supabase = await createSupabaseServer()

  if (kind === 'city') {
    const { error } = await supabase
      .from('destination_sections')
      .update({ city_block_id: blockId, updated_at: new Date().toISOString() })
      .eq('id', sectionId)
    if (error) throw new Error(error.message)
  } else if (kind === 'hotel') {
    const { error } = await supabase
      .from('destination_sections')
      .update({ hotel_block_id: blockId, updated_at: new Date().toISOString() })
      .eq('id', sectionId)
    if (error) throw new Error(error.message)
  } else {
    // blocks: добавить в конец destination_section_blocks
    const { data: existing } = await supabase
      .from('destination_section_blocks')
      .select('sort_order')
      .eq('section_id', sectionId)
      .order('sort_order', { ascending: false })
      .limit(1)
    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0
    const { error } = await supabase
      .from('destination_section_blocks')
      .insert({ section_id: sectionId, block_id: blockId, sort_order: nextOrder })
    if (error) throw new Error(error.message)
  }

  // обновим страницу направления (proposal_id найдём по секции)
  const { data: sec } = await supabase
    .from('destination_sections')
    .select('proposal_id')
    .eq('id', sectionId)
    .single()
  if (sec?.proposal_id) revalidatePath(`/admin/destinations/${sec.proposal_id}`)
}