'use server'

import { supabase } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

type ProposalUpdate = {
  client_name_ru?: string | null
  client_name_en?: string | null
  trip_title_ru?: string | null
  trip_title_en?: string | null
  guest_count?: number | null
  start_date?: string | null
  end_date?: string | null
  status?: string
  total_price?: number | null
  currency?: string
  cover_image_url?: string | null
  intro_text_ru?: string | null
  intro_text_en?: string | null
  slug?: string
}

export async function createProposal() {
  const slug = `untitled-${Date.now().toString(36)}`

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      slug,
      client_name_ru: 'Новый клиент',
      client_name_en: 'New client',
      trip_title_ru: 'Новый proposal',
      trip_title_en: 'New proposal',
      guest_count: 1,
      status: 'draft',
      currency: 'USD',
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create proposal')
  }

  revalidatePath('/admin')
  redirect(`/admin/proposals/${data.id}`)
}

export async function deleteProposal(id: string) {
  const { error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin')
}

export async function duplicateProposal(id: string) {
  const { data: original, error: fetchError } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !original) {
    throw new Error('Original proposal not found')
  }

  const { data: newProposal, error: createError } = await supabase
    .from('proposals')
    .insert({
      slug: `${original.slug}-copy-${Date.now().toString(36)}`,
      client_name_ru: original.client_name_ru,
      client_name_en: original.client_name_en,
      trip_title_ru: original.trip_title_ru ? `${original.trip_title_ru} (копия)` : null,
      trip_title_en: original.trip_title_en ? `${original.trip_title_en} (copy)` : null,
      guest_count: original.guest_count,
      start_date: original.start_date,
      end_date: original.end_date,
      status: 'draft',
      total_price: original.total_price,
      currency: original.currency,
      cover_image_url: original.cover_image_url,
      intro_text_ru: original.intro_text_ru,
      intro_text_en: original.intro_text_en,
    })
    .select()
    .single()

  if (createError || !newProposal) {
    throw new Error(createError?.message || 'Failed to duplicate')
  }

  const { data: originalDays } = await supabase
    .from('days')
    .select('*, day_blocks(block_id, sort_order, custom_note_ru, custom_note_en)')
    .eq('proposal_id', id)

  if (originalDays) {
    for (const day of originalDays) {
      const { data: newDay } = await supabase
        .from('days')
        .insert({
          proposal_id: newProposal.id,
          day_number: day.day_number,
          title_ru: day.title_ru,
          title_en: day.title_en,
          date: day.date,
          intro_text_ru: day.intro_text_ru,
          intro_text_en: day.intro_text_en,
        })
        .select()
        .single()

      if (newDay && day.day_blocks?.length) {
        await supabase.from('day_blocks').insert(
          day.day_blocks.map((db: { block_id: string; sort_order: number; custom_note_ru: string | null; custom_note_en: string | null }) => ({
            day_id: newDay.id,
            block_id: db.block_id,
            sort_order: db.sort_order,
            custom_note_ru: db.custom_note_ru,
            custom_note_en: db.custom_note_en,
          }))
        )
      }
    }
  }

  revalidatePath('/admin')
}

export async function updateProposal(id: string, updates: ProposalUpdate) {
  const { error } = await supabase
    .from('proposals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin')
  revalidatePath(`/admin/proposals/${id}`)
}