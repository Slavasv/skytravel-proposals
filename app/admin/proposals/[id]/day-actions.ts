'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export type DayUpdate = {
  title_ru?: string | null
  title_en?: string | null
  intro_text_ru?: string | null
  intro_text_en?: string | null
  date?: string | null
}

function addDays(dateStr: string | null, days: number): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function createDay(proposalId: string, variantId?: string | null) {
  const supabase = await createSupabaseServer()

  // нумерация в пределах варианта (если он есть), иначе — предложения
  const existingQuery = supabase
    .from('days')
    .select('day_number')
    .order('day_number', { ascending: false })
    .limit(1)

  const { data: existing } = variantId
    ? await existingQuery.eq('variant_id', variantId)
    : await existingQuery.eq('proposal_id', proposalId)

  const { data: proposal } = await supabase
    .from('proposals')
    .select('start_date')
    .eq('id', proposalId)
    .single()

  const nextNumber = (existing?.[0]?.day_number ?? 0) + 1
  const nextDate = addDays(proposal?.start_date ?? null, nextNumber - 1)

  const { data, error } = await supabase
    .from('days')
    .insert({
      proposal_id: proposalId,
      variant_id: variantId ?? null,
      day_number: nextNumber,
      date: nextDate,
      title_ru: '',
      title_en: '',
    })
    .select()
    .single()

  if (error || !data) throw new Error(error?.message || 'Failed to create day')

  revalidatePath(`/admin/proposals/${proposalId}`)
  return data
}

export async function updateDay(id: string, updates: DayUpdate) {
  const supabase = await createSupabaseServer()

  const { error } = await supabase
    .from('days')
    .update(updates)
    .eq('id', id)

  if (error) throw new Error(error.message)

  const { data } = await supabase
    .from('days')
    .select('proposal_id')
    .eq('id', id)
    .single()

  if (data?.proposal_id) {
    revalidatePath(`/admin/proposals/${data.proposal_id}`)
  }
}

export async function deleteDay(id: string) {
  const supabase = await createSupabaseServer()

  const { data: day } = await supabase
    .from('days')
    .select('proposal_id, day_number')
    .eq('id', id)
    .single()

  if (!day) throw new Error('Day not found')

  const { error } = await supabase
    .from('days')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)

  await renumberDays(day.proposal_id)
  revalidatePath(`/admin/proposals/${day.proposal_id}`)
}

export async function reorderDays(proposalId: string, orderedIds: string[]) {
  const supabase = await createSupabaseServer()

  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from('days')
      .update({ day_number: -(i + 1) })
      .eq('id', orderedIds[i])
  }
  for (let i = 0; i < orderedIds.length; i++) {
    await supabase
      .from('days')
      .update({ day_number: i + 1 })
      .eq('id', orderedIds[i])
  }

  await renumberDays(proposalId)
  revalidatePath(`/admin/proposals/${proposalId}`)
}

async function renumberDays(proposalId: string) {
  const supabase = await createSupabaseServer()

  const { data: proposal } = await supabase
    .from('proposals')
    .select('start_date')
    .eq('id', proposalId)
    .single()

  const { data: days } = await supabase
    .from('days')
    .select('id, day_number')
    .eq('proposal_id', proposalId)
    .order('day_number', { ascending: true })

  if (!days || days.length === 0) return

  for (let i = 0; i < days.length; i++) {
    const newNumber = i + 1
    const newDate = addDays(proposal?.start_date ?? null, newNumber - 1)
    const update: { day_number: number; date: string | null } = {
      day_number: newNumber,
      date: newDate,
    }

    if (days[i].day_number !== newNumber) {
      await supabase
        .from('days')
        .update(update)
        .eq('id', days[i].id)
    } else {
      await supabase
        .from('days')
        .update({ date: newDate })
        .eq('id', days[i].id)
    }
  }
}