'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'

export type DayBlockUpdate = {
  custom_note_ru?: string | null
  custom_note_en?: string | null
}

export type LibraryBlock = {
  id: string
  type: string
  title_ru: string | null
  title_en: string | null
  description_ru: string | null
  description_en: string | null
  image_url: string | null
  location: string | null
  tags: string[] | null
}

async function getProposalIdByDay(dayId: string): Promise<string | null> {
  const { data } = await supabase
    .from('days')
    .select('proposal_id')
    .eq('id', dayId)
    .single()
  return data?.proposal_id ?? null
}

async function getProposalIdByDayBlock(dayBlockId: string): Promise<string | null> {
  const { data } = await supabase
    .from('day_blocks')
    .select('day_id, days(proposal_id)')
    .eq('id', dayBlockId)
    .single()

  const days = data?.days as { proposal_id: string } | { proposal_id: string }[] | null
  if (!days) return null
  if (Array.isArray(days)) return days[0]?.proposal_id ?? null
  return days.proposal_id ?? null
}

export async function getLibraryBlocks(): Promise<LibraryBlock[]> {
  const { data, error } = await supabase
    .from('content_blocks')
    .select('id, type, title_ru, title_en, description_ru, description_en, image_url, location, tags')
    .order('updated_at', { ascending: false })

  if (error || !data) {
    return []
  }

  return data
}

export async function addBlockToDay(dayId: string, blockId: string) {
  const { data: existing } = await supabase
    .from('day_blocks')
    .select('sort_order')
    .eq('day_id', dayId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { error } = await supabase
    .from('day_blocks')
    .insert({
      day_id: dayId,
      block_id: blockId,
      sort_order: nextOrder,
    })

  if (error) {
    throw new Error(error.message)
  }

  const proposalId = await getProposalIdByDay(dayId)
  if (proposalId) {
    revalidatePath(`/admin/proposals/${proposalId}`)
  }
}

export async function duplicateDayBlock(dayBlockId: string) {
  const { data: original, error: fetchError } = await supabase
    .from('day_blocks')
    .select('*')
    .eq('id', dayBlockId)
    .single()

  if (fetchError || !original) {
    throw new Error('Block not found')
  }

  const { data: siblings } = await supabase
    .from('day_blocks')
    .select('id, sort_order')
    .eq('day_id', original.day_id)
    .order('sort_order', { ascending: true })

  if (!siblings) {
    throw new Error('Cannot fetch day blocks')
  }

  const originalIndex = siblings.findIndex((s) => s.id === dayBlockId)
  const newSortOrder = original.sort_order + 1

  for (let i = siblings.length - 1; i > originalIndex; i--) {
    await supabase
      .from('day_blocks')
      .update({ sort_order: siblings[i].sort_order + 1 })
      .eq('id', siblings[i].id)
  }

  const { error: insertError } = await supabase
    .from('day_blocks')
    .insert({
      day_id: original.day_id,
      block_id: original.block_id,
      sort_order: newSortOrder,
      custom_note_ru: original.custom_note_ru,
      custom_note_en: original.custom_note_en,
    })

  if (insertError) {
    throw new Error(insertError.message)
  }

  const proposalId = await getProposalIdByDay(original.day_id)
  if (proposalId) {
    revalidatePath(`/admin/proposals/${proposalId}`)
  }
}

export async function updateDayBlock(dayBlockId: string, updates: DayBlockUpdate) {
  const { error } = await supabase
    .from('day_blocks')
    .update(updates)
    .eq('id', dayBlockId)

  if (error) {
    throw new Error(error.message)
  }

  const proposalId = await getProposalIdByDayBlock(dayBlockId)
  if (proposalId) {
    revalidatePath(`/admin/proposals/${proposalId}`)
  }
}

export async function removeBlockFromDay(dayBlockId: string) {
  const proposalId = await getProposalIdByDayBlock(dayBlockId)

  const { data: dayBlock } = await supabase
    .from('day_blocks')
    .select('day_id, sort_order')
    .eq('id', dayBlockId)
    .single()

  if (!dayBlock) {
    throw new Error('Block not found')
  }

  const { error } = await supabase
    .from('day_blocks')
    .delete()
    .eq('id', dayBlockId)

  if (error) {
    throw new Error(error.message)
  }

  await renumberDayBlocks(dayBlock.day_id)

  if (proposalId) {
    revalidatePath(`/admin/proposals/${proposalId}`)
  }
}

export async function reorderDayBlocks(dayId: string, orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from('day_blocks')
      .update({ sort_order: -(i + 1) })
      .eq('id', orderedIds[i])
  }
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from('day_blocks')
      .update({ sort_order: i })
      .eq('id', orderedIds[i])
  }

  const proposalId = await getProposalIdByDay(dayId)
  if (proposalId) {
    revalidatePath(`/admin/proposals/${proposalId}`)
  }
}

async function renumberDayBlocks(dayId: string) {
  const { data: blocks } = await supabase
    .from('day_blocks')
    .select('id, sort_order')
    .eq('day_id', dayId)
    .order('sort_order', { ascending: true })

  if (!blocks || blocks.length === 0) return

  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].sort_order !== i) {
      await supabase
        .from('day_blocks')
        .update({ sort_order: i })
        .eq('id', blocks[i].id)
    }
  }
}