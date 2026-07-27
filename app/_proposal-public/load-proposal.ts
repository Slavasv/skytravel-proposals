// Серверная загрузка публичного предложения со всеми вариантами.
// Один источник данных для RU (app/p/[slug]) и EN (app/en/p/[slug]).
// Тянет: предложение (общее) + компанию (бренд) + все варианты,
// у каждого — его дни с блоками, номерами и ценами.

import { supabase } from '@/lib/supabase'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import type {
  LoadedProposal,
  PublicVariant,
  PublicDay,
  GalleryItem,
  TravellersSummary,
} from './types'

const CHILD_TITLES = new Set(['Miss', 'Mstr', 'Chd', 'Inf'])

// возраст из date_of_birth (ДД/ММ/ГГГГ текстом, как везде в проекте)
function ageFromDob(dob: string | null): number | null {
  if (!dob) return null
  const m = dob.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  let birth: Date | null = null
  if (m) birth = new Date(+m[3], +m[2] - 1, +m[1])
  else {
    const d = new Date(dob)
    if (!isNaN(d.getTime())) birth = d
  }
  if (!birth) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const md = now.getMonth() - birth.getMonth()
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age--
  if (age < 0 || age > 120) return null
  return age
}

// Сводка путешественников по запросу предложения (сервер, service-role — travellers это ПДн)
async function loadTravellers(requestId: string | null | undefined): Promise<TravellersSummary | null> {
  if (!requestId) return null
  const admin = createSupabaseAdmin()
  const { data: req } = await admin.from('requests').select('traveller_ids').eq('id', requestId).single()
  const ids: string[] = Array.isArray(req?.traveller_ids) ? req!.traveller_ids : []
  if (ids.length === 0) return null

  const { data: trav } = await admin.from('travellers').select('title, date_of_birth').in('id', ids)
  if (!trav || trav.length === 0) return null

  let adults = 0
  let children = 0
  const childAges: number[] = []
  for (const t of trav) {
    const isChild = CHILD_TITLES.has((t.title as string) || '')
    if (isChild) {
      children++
      const age = ageFromDob(t.date_of_birth as string | null)
      if (age != null) childAges.push(age)
    } else {
      adults++
    }
  }
  childAges.sort((a, b) => b - a)
  return { adults, children, childAges }
}

const DAYS_SELECT = `
  id, day_number, date, title_ru, title_en, intro_text_ru, intro_text_en, variant_id,
  day_blocks (
    id, sort_order, time, custom_note_ru, custom_note_en,
    room_type_ru, room_type_en, from_ru, from_en, to_ru, to_en,
    selected_rooms, price, guests,
    content_blocks (
      id, type, title_ru, title_en, subtitle_ru, subtitle_en, description_ru, description_en,
      image_url, images, location, link_url, tags, rooms
    )
  )
`

// Сортируем блоки внутри дня по sort_order
function sortDays(days: unknown[]): PublicDay[] {
  return (days as PublicDay[]).map((d) => ({
    ...d,
    day_blocks: [...(d.day_blocks ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }))
}

function normalizeGallery(raw: unknown): GalleryItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((g: Record<string, unknown>) => ({
    id: String(g?.id ?? Math.random().toString(36).slice(2, 10)),
    image_url: String(g?.image_url ?? ''),
    caption_ru: String(g?.caption_ru ?? ''),
    caption_en: String(g?.caption_en ?? ''),
  }))
}

export async function loadProposal(slug: string): Promise<LoadedProposal | null> {
  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !proposal) return null

  const { data: company } = proposal.company_id
    ? await supabase
        .from('companies')
        .select('name, logo_url, accent_color, contact_email, contact_phone, website_url, footer_note')
        .eq('id', proposal.company_id)
        .single()
    : { data: null }

  const { data: variantsRaw } = await supabase
    .from('proposal_variants')
    .select('*')
    .eq('proposal_id', proposal.id)
    .order('sort_order', { ascending: true })

  let variants: PublicVariant[] = []

  if (variantsRaw && variantsRaw.length > 0) {
    const ids = variantsRaw.map((v) => v.id)
    const { data: daysRaw } = await supabase
      .from('days')
      .select(DAYS_SELECT)
      .in('variant_id', ids)
      .order('day_number', { ascending: true })

    const all = sortDays(daysRaw ?? [])
    variants = variantsRaw.map((v) => ({
      ...(v as Omit<PublicVariant, 'gallery' | 'days'>),
      gallery: normalizeGallery((v as { gallery?: unknown }).gallery),
      days: all.filter((d) => d.variant_id === v.id),
    }))
  } else {
    // Фолбэк: старое предложение без вариантов — собираем один «Маршрут 1»
    // из полей самого предложения, дни берём по proposal_id.
    const { data: daysRaw } = await supabase
      .from('days')
      .select(DAYS_SELECT)
      .eq('proposal_id', proposal.id)
      .order('day_number', { ascending: true })

    variants = [
      {
        id: `legacy-${proposal.id}`,
        proposal_id: proposal.id,
        sort_order: 0,
        name_ru: 'Маршрут 1',
        name_en: 'Route 1',
        subtitle_ru: null,
        subtitle_en: null,
        overview_ru: null,
        overview_en: null,
        is_selected: true,
        total_price: proposal.total_price ?? null,
        payment_terms_ru: proposal.payment_terms_ru ?? null,
        payment_terms_en: proposal.payment_terms_en ?? null,
        cancellation_policy_ru: proposal.cancellation_policy_ru ?? null,
        cancellation_policy_en: proposal.cancellation_policy_en ?? null,
        cost_includes_ru: proposal.cost_includes_ru ?? null,
        cost_includes_en: proposal.cost_includes_en ?? null,
        cost_excludes_ru: proposal.cost_excludes_ru ?? null,
        cost_excludes_en: proposal.cost_excludes_en ?? null,
        cost_notes_ru: proposal.cost_notes_ru ?? null,
        cost_notes_en: proposal.cost_notes_en ?? null,
        gallery: [],
        impressions_text_ru: null,
        impressions_text_en: null,
        divider_image: null,
        days: sortDays(daysRaw ?? []),
      },
    ]
  }

  const travellers = await loadTravellers(proposal.request_id)

  return {
    proposal: proposal as LoadedProposal['proposal'],
    company: (company as LoadedProposal['company']) ?? null,
    variants,
    travellers,
  }
}