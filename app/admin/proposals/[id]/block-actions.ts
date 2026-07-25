'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export type DayBlockUpdate = {
  custom_note_ru?: string | null
  custom_note_en?: string | null
  room_type_ru?: string | null
  room_type_en?: string | null
  from_ru?: string | null
  from_en?: string | null
  to_ru?: string | null
  to_en?: string | null
  room_ids?: string[] | null
  activities_ru?: string | null
  activities_en?: string | null
  selected_rooms?: { uid: string; room_id: string; guests: number; price: number | null; meal?: string | null }[] | null
  price?: number | null
  guests?: number | null
}

type CityJoin = { country_id: string; name_ru: string; name_en: string; countries: { name_ru: string; name_en: string } | { name_ru: string; name_en: string }[] | null }
type CountryJoin = { name_ru: string; name_en: string }

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
  city_id: string | null
  country_id: string | null
  cities: CityJoin | CityJoin[] | null
  countries: CountryJoin | CountryJoin[] | null
}

async function getProposalIdByDay(dayId: string): Promise<string | null> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('days')
    .select('proposal_id')
    .eq('id', dayId)
    .single()
  return data?.proposal_id ?? null
}

async function getProposalIdByDayBlock(dayBlockId: string): Promise<string | null> {
  const supabase = await createSupabaseServer()
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
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('content_blocks')
    .select(`
      id, type, title_ru, title_en, description_ru, description_en, image_url, location, tags,
      city_id, country_id,
      cities ( country_id, name_ru, name_en, countries ( name_ru, name_en ) ),
      countries ( name_ru, name_en )
    `)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })

  if (error || !data) return []
  return data
}

export async function addBlockToDay(dayId: string, blockId: string) {
  const supabase = await createSupabaseServer()

  const { data: existing } = await supabase
    .from('day_blocks')
    .select('sort_order')
    .eq('day_id', dayId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1

  const { error } = await supabase
    .from('day_blocks')
    .insert({ day_id: dayId, block_id: blockId, sort_order: nextOrder })

  if (error) throw new Error(error.message)

  const proposalId = await getProposalIdByDay(dayId)
  if (proposalId) revalidatePath(`/admin/proposals/${proposalId}`)
}

export async function duplicateDayBlock(dayBlockId: string) {
  const supabase = await createSupabaseServer()

  const { data: original, error: fetchError } = await supabase
    .from('day_blocks')
    .select('*')
    .eq('id', dayBlockId)
    .single()

  if (fetchError || !original) throw new Error('Block not found')

  const { data: siblings } = await supabase
    .from('day_blocks')
    .select('id, sort_order')
    .eq('day_id', original.day_id)
    .order('sort_order', { ascending: true })

  if (!siblings) throw new Error('Cannot fetch day blocks')

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

  if (insertError) throw new Error(insertError.message)

  const proposalId = await getProposalIdByDay(original.day_id)
  if (proposalId) revalidatePath(`/admin/proposals/${proposalId}`)
}

export async function updateDayBlock(dayBlockId: string, updates: DayBlockUpdate) {
  const supabase = await createSupabaseServer()

  const { error } = await supabase
    .from('day_blocks')
    .update(updates)
    .eq('id', dayBlockId)

  if (error) throw new Error(error.message)

  const proposalId = await getProposalIdByDayBlock(dayBlockId)
  if (proposalId) revalidatePath(`/admin/proposals/${proposalId}`)
}

export async function removeBlockFromDay(dayBlockId: string) {
  const supabase = await createSupabaseServer()
  const proposalId = await getProposalIdByDayBlock(dayBlockId)

  const { data: dayBlock } = await supabase
    .from('day_blocks')
    .select('day_id, sort_order')
    .eq('id', dayBlockId)
    .single()

  if (!dayBlock) throw new Error('Block not found')

  const { error } = await supabase
    .from('day_blocks')
    .delete()
    .eq('id', dayBlockId)

  if (error) throw new Error(error.message)

  await renumberDayBlocks(dayBlock.day_id)
  if (proposalId) revalidatePath(`/admin/proposals/${proposalId}`)
}

export async function reorderDayBlocks(dayId: string, orderedIds: string[]) {
  const supabase = await createSupabaseServer()

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
  if (proposalId) revalidatePath(`/admin/proposals/${proposalId}`)
}

async function renumberDayBlocks(dayId: string) {
  const supabase = await createSupabaseServer()

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

// Свежие дни предложения — для обновления провайдера после добавления/удаления блоков и дней.
// Тот же select, что и на странице.
export async function getProposalDays(proposalId: string, variantId?: string | null) {
  const supabase = await createSupabaseServer()
  const daysQuery = supabase
    .from('days')
    .select(`
      *,
      day_blocks (
        id,
        sort_order,
        custom_note_ru,
        custom_note_en,
        room_type_ru,
        room_type_en,
        from_ru,
        from_en,
        to_ru,
        to_en,
        room_ids,
        activities_ru,
        activities_en,
        selected_rooms,
        price,
        guests,
        content_blocks (
          id,
          type,
          title_ru,
          title_en,
          description_ru,
          description_en,
          image_url,
          location,
          tags,
          rooms
        )
      )
    `)
    .order('day_number', { ascending: true })

  const { data: days } = variantId
    ? await daysQuery.eq('variant_id', variantId)
    : await daysQuery.eq('proposal_id', proposalId)

  return (days ?? []).map((day) => ({
    ...day,
    day_blocks: (day.day_blocks ?? []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    ),
  }))
}