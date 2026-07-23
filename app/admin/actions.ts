'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
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
  payment_terms_ru?: string | null
  payment_terms_en?: string | null
  cancellation_policy_ru?: string | null
  cancellation_policy_en?: string | null
  cost_currency?: string | null
  cost_includes_ru?: string | null
  cost_includes_en?: string | null
  cost_excludes_ru?: string | null
  cost_excludes_en?: string | null
  cost_notes_ru?: string | null
  cost_notes_en?: string | null
  cost_lines?: unknown
  slug?: string
  season_ru?: string | null
  season_en?: string | null
  tagline_ru?: string | null
  tagline_en?: string | null
  price_from?: boolean
  client_id?: string | null
  layout?: string | null
}

async function createProposalOfKind(kind: 'individual' | 'destination') {
  const slug = `untitled-${Date.now().toString(36)}`
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      slug,
      kind,
      client_name_ru: null,
      client_name_en: null,
      trip_title_ru: null,
      trip_title_en: null,
      guest_count: 1,
      status: 'draft',
      currency: 'USD',
      owner_id: user?.id ?? null,
    })
    .select()
    .single()

  if (error || !data) throw new Error(error?.message || 'Failed to create proposal')

  revalidatePath('/admin')
  revalidatePath('/admin/destinations')
  redirect(kind === 'destination' ? `/admin/destinations/${data.id}` : `/admin/proposals/${data.id}`)
}

export async function createProposal() {
  await createProposalOfKind('individual')
}

export async function createDestination() {
  await createProposalOfKind('destination')
}

export async function deleteProposal(id: string) {
  const supabase = await createSupabaseServer()

  const { error } = await supabase
    .from('proposals')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin')
}

export async function duplicateProposal(id: string) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: original, error: fetchError } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !original) throw new Error('Original proposal not found')

  const { data: newProposal, error: createError } = await supabase
    .from('proposals')
    .insert({
      slug: `${original.slug}-copy-${Date.now().toString(36)}`,
      kind: original.kind,
      season_ru: original.season_ru,
      season_en: original.season_en,
      tagline_ru: original.tagline_ru,
      tagline_en: original.tagline_en,
      price_from: original.price_from,
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
      payment_terms_ru: original.payment_terms_ru,
      payment_terms_en: original.payment_terms_en,
      cancellation_policy_ru: original.cancellation_policy_ru,
      cancellation_policy_en: original.cancellation_policy_en,
      cost_currency: original.cost_currency,
      cost_includes_ru: original.cost_includes_ru,
      cost_includes_en: original.cost_includes_en,
      cost_excludes_ru: original.cost_excludes_ru,
      cost_excludes_en: original.cost_excludes_en,
      cost_notes_ru: original.cost_notes_ru,
      cost_notes_en: original.cost_notes_en,
      cost_lines: original.cost_lines,
      client_id: original.client_id,
      owner_id: user?.id ?? null,
    })
    .select()
    .single()

  if (createError || !newProposal) throw new Error(createError?.message || 'Failed to duplicate')

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
          day.day_blocks.map((db: {
            block_id: string
            sort_order: number
            custom_note_ru: string | null
            custom_note_en: string | null
          }) => ({
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
  const supabase = await createSupabaseServer()

  const { error } = await supabase
    .from('proposals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath(`/admin/proposals/${id}`)
}

// ============ CRM: клиенты для дропдауна в предложении ============

export type ProposalClientOption = {
  id: string
  name: string
  client_code: string | null
}

export async function getClientsForProposal(): Promise<ProposalClientOption[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, client_code')
    .order('name', { ascending: true })
  if (error || !data) return []
  return data as ProposalClientOption[]
}
export async function createVoucher() {
  const slug = `voucher-${Date.now().toString(36)}`
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  // company_id из профиля (для брендинга футера)
  let companyId: string | null = null
  if (user) {
    const { data: me } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()
    companyId = me?.company_id ?? null
  }

  const { data, error } = await supabase
    .from('vouchers')
    .insert({
      slug,
      company_id: companyId,
      owner_id: user?.id ?? null,
      voucher_no: null,
      issue_date: null,
      booking_ref: null,
      guests: [],
      show_transfer: false,
      transfers: [],
    })
    .select()
    .single()

  if (error || !data) throw new Error(error?.message || 'Failed to create voucher')

  revalidatePath('/admin/vouchers')
  redirect(`/admin/vouchers/${data.id}`)
}

export async function deleteVoucher(id: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('vouchers')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/vouchers')
}

// генерит уникальный slug на базе исходного: base-copy, base-copy-2, base-copy-3...
async function uniqueVoucherSlug(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  baseSlug: string
): Promise<string> {
  const root = `${baseSlug}-copy`
  let candidate = root
  let n = 1
  // ищем свободный вариант
  // (в норме 1-2 итерации; ограничим на всякий случай)
  while (n < 100) {
    const { data } = await supabase
      .from('vouchers')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (!data) return candidate
    n += 1
    candidate = `${root}-${n}`
  }
  // крайний случай — добавим таймстамп
  return `${root}-${Date.now().toString(36)}`
}

export async function duplicateVoucher(id: string) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Исходный ваучер
  const { data: original, error: fetchError } = await supabase
    .from('vouchers')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !original) throw new Error('Original voucher not found')

  // 2. Новый уникальный slug
  const newSlug = await uniqueVoucherSlug(supabase, original.slug || 'voucher')

  // 3. Копия ваучера (копируем ВСЁ: гостей, трансферы, настройки)
  const { data: newVoucher, error: createError } = await supabase
    .from('vouchers')
    .insert({
      slug: newSlug,
      company_id: original.company_id,
      owner_id: user?.id ?? original.owner_id ?? null,
      voucher_no: original.voucher_no,
      issue_date: original.issue_date,
      booking_ref: original.booking_ref,
      greeting_for: original.greeting_for,
      guests: original.guests,
      show_transfer: original.show_transfer,
      show_greeting: original.show_greeting,
      transfers: original.transfers,
      notes: original.notes,
      client_id: original.client_id,
    })
    .select()
    .single()

  if (createError || !newVoucher) throw new Error(createError?.message || 'Failed to duplicate voucher')

  // 4. Копируем связанные отели (voucher_hotels)
  const { data: originalHotels } = await supabase
    .from('voucher_hotels')
    .select('*')
    .eq('voucher_id', id)
    .order('sort_order', { ascending: true })

  if (originalHotels && originalHotels.length > 0) {
    await supabase.from('voucher_hotels').insert(
      originalHotels.map((h) => ({
        voucher_id: newVoucher.id,
        sort_order: h.sort_order,
        city: h.city,
        country: h.country,
        booking_ref: h.booking_ref,
        name: h.name,
        address: h.address,
        phone: h.phone,
        check_in: h.check_in,
        check_out: h.check_out,
        nights: h.nights,
        room_type: h.room_type,
        meal_plan: h.meal_plan,
        extras: h.extras,
      }))
    )
  }

  revalidatePath('/admin/vouchers')
}