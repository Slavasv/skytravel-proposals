import { supabase } from '@/lib/supabase'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { normalizePhotos, photoUrls } from '@/lib/photos'
import type { DestinationData, DSection, DRoom, DPhoto, DCostLine } from './types'

function str(v: unknown): string { return typeof v === 'string' ? v : '' }
function obj(v: unknown): Record<string, unknown> { return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {} }
function arr(v: unknown): unknown[] { return Array.isArray(v) ? v : [] }

function normalizeRooms(raw: unknown): DRoom[] {
  return arr(raw).filter((x) => x && typeof x === 'object').map((x) => {
    const r = x as Record<string, unknown>
    return {
      id: str(r.id) || Math.random().toString(36).slice(2),
      title_ru: str(r.title_ru), title_en: str(r.title_en),
      subtitle_ru: str(r.subtitle_ru), subtitle_en: str(r.subtitle_en),
      images: normalizePhotos(r.images),
    }
  })
}

// image_url + images → единый список фото
function blockPhotos(b: { image_url: string | null; images: unknown } | null): DPhoto[] {
  if (!b) return []
  const head: DPhoto[] = b.image_url ? [{ url: b.image_url, caption_ru: '', caption_en: '' }] : []
  return [...head, ...normalizePhotos(b.images)]
}

const CB_COLS = 'id, type, title_ru, title_en, description_ru, description_en, image_url, images, facts_ru, facts_en, duration_hours, rooms'

export async function loadDestination(slug: string): Promise<DestinationData | null> {
  const { data: proposal, error } = await supabase
    .from('proposals').select('*').eq('slug', slug).eq('kind', 'destination').single()
  if (error || !proposal) return null

  // company_id из предложения; если пусто — резолвим бренд через владельца/заявку
  // service-role'ом (как ваучер берёт company_id из профиля).
  let companyId: string | null = proposal.company_id ?? null
  if (!companyId) {
    const admin = createSupabaseAdmin()
    if (proposal.owner_id) {
      const { data: owner } = await admin
        .from('profiles').select('company_id').eq('id', proposal.owner_id).single()
      companyId = owner?.company_id ?? null
    }
    if (!companyId && proposal.request_id) {
      const { data: reqRow } = await admin
        .from('requests').select('company_id').eq('id', proposal.request_id).single()
      companyId = reqRow?.company_id ?? null
    }
  }

  const { data: company } = companyId
    ? await supabase.from('companies').select('name, logo_url, accent_color, contact_email, contact_phone, website_url, footer_note, office_address').eq('id', companyId).single()
    : { data: null }

  const { data: sectionsRaw } = await supabase
    .from('destination_sections').select('*').eq('proposal_id', proposal.id).order('sort_order', { ascending: true })
  const secs = sectionsRaw ?? []

  // одиночные блоки (city, hotel)
  const singleIds = secs.filter((s) => (s.type === 'city' && s.city_block_id) || (s.type === 'hotel' && s.hotel_block_id))
    .map((s) => (s.type === 'city' ? s.city_block_id : s.hotel_block_id) as string)
  const blocksById: Record<string, Record<string, unknown>> = {}
  if (singleIds.length > 0) {
    const { data: blocks } = await supabase.from('content_blocks').select(CB_COLS).in('id', singleIds)
    ;(blocks ?? []).forEach((b) => { blocksById[str((b as Record<string, unknown>).id)] = b as Record<string, unknown> })
  }

  // блоки секций activities (через destination_section_blocks)
  const actSectionIds = secs.filter((s) => s.type === 'activities').map((s) => s.id)
  const actBlocks: Record<string, Record<string, unknown>[]> = {}
  if (actSectionIds.length > 0) {
    const { data: links } = await supabase
      .from('destination_section_blocks')
      .select(`section_id, sort_order, content_blocks(${CB_COLS})`)
      .in('section_id', actSectionIds).order('sort_order', { ascending: true })
    ;(links ?? []).forEach((row) => {
      const r = row as Record<string, unknown>
      const sid = str(r.section_id)
      const cb = (Array.isArray(r.content_blocks) ? r.content_blocks[0] : r.content_blocks) as Record<string, unknown> | null
      if (!cb) return
      ;(actBlocks[sid] = actBlocks[sid] ?? []).push(cb)
    })
  }

  const sections: DSection[] = []
  for (const s of secs) {
    const data = obj(s.data)
    if (s.type === 'route') {
      const stops = arr(data.stops).map((x) => { const st = obj(x); return { date_ru: str(st.date_ru), date_en: str(st.date_en), title_ru: str(st.title_ru), title_en: str(st.title_en), desc_ru: str(st.desc_ru), desc_en: str(st.desc_en) } })
      if (stops.length) sections.push({ kind: 'route', id: s.id, title_ru: str(s.title_ru), title_en: str(s.title_en), stops })
    } else if (s.type === 'city') {
      const b = s.city_block_id ? blocksById[s.city_block_id] : null
      if (b) sections.push({ kind: 'city', id: s.id, title_ru: str(s.title_ru), title_en: str(s.title_en), subtitle_ru: str(data.subtitle_ru), subtitle_en: str(data.subtitle_en), name_ru: str(b.title_ru), name_en: str(b.title_en), description_ru: str(b.description_ru), description_en: str(b.description_en), facts_ru: str(b.facts_ru), facts_en: str(b.facts_en), photos: blockPhotos(b as never) })
    } else if (s.type === 'activities') {
      const items = (actBlocks[s.id] ?? []).map((b) => ({ id: str(b.id), title_ru: str(b.title_ru), title_en: str(b.title_en), description_ru: str(b.description_ru), description_en: str(b.description_en), duration_hours: typeof b.duration_hours === 'number' ? b.duration_hours : null, photo: str(b.image_url) || photoUrls(b.images)[0] || null }))
      if (items.length) sections.push({ kind: 'activities', id: s.id, title_ru: str(s.title_ru), title_en: str(s.title_en), items })
    } else if (s.type === 'hotel') {
      const b = s.hotel_block_id ? blocksById[s.hotel_block_id] : null
      if (b) {
        const all = normalizeRooms(b.rooms)
        const roomIds = arr(data.room_ids).map(String)
        const rooms = roomIds.length === 0 ? all : all.filter((r) => roomIds.includes(r.id))
        sections.push({ kind: 'hotel', id: s.id, title_ru: str(s.title_ru), title_en: str(s.title_en), name_ru: str(b.title_ru), name_en: str(b.title_en), description_ru: str(b.description_ru), description_en: str(b.description_en), activities_ru: str(data.activities_ru), activities_en: str(data.activities_en), photos: blockPhotos(b as never), rooms })
      }
    } else if (s.type === 'gallery') {
      const images = normalizePhotos(data.images)
      if (images.length) sections.push({ kind: 'gallery', id: s.id, title_ru: str(s.title_ru), title_en: str(s.title_en), images })
    } else if (s.type === 'inspiration') {
      const images = normalizePhotos(data.images)
      const overview_ru = str(data.overview_ru), overview_en = str(data.overview_en)
      const impressions_ru = str(data.impressions_ru), impressions_en = str(data.impressions_en)
      const divider_image = str(data.divider_image) || null
      if (images.length || overview_ru || overview_en || impressions_ru || impressions_en || divider_image) {
        sections.push({ kind: 'inspiration', id: s.id, title_ru: str(s.title_ru), title_en: str(s.title_en), images, overview_ru, overview_en, impressions_ru, impressions_en, divider_image })
      }
    } else if (s.type === 'sample_day') {
      const items = arr(data.items).map((x) => { const it = obj(x); return { time: str(it.time), text_ru: str(it.text_ru), text_en: str(it.text_en) } }).filter((i) => i.time || i.text_ru || i.text_en)
      if (items.length) sections.push({ kind: 'sample_day', id: s.id, title_ru: str(s.title_ru), title_en: str(s.title_en), imageLeft: str(data.image_left) || null, imageRight: str(data.image_right) || null, items })
    }
  }

  const cost_lines: DCostLine[] = arr(proposal.cost_lines).map((x) => { const l = obj(x); return { id: str(l.id), category: (str(l.category) as DCostLine['category']) || 'activity', label_ru: str(l.label_ru), label_en: str(l.label_en), details_ru: str(l.details_ru), details_en: str(l.details_en), price: str(l.price) } })

  return {
    slug,
    trip_title_ru: proposal.trip_title_ru, trip_title_en: proposal.trip_title_en,
    tagline_ru: proposal.tagline_ru, tagline_en: proposal.tagline_en,
    season_ru: proposal.season_ru, season_en: proposal.season_en,
    intro_text_ru: proposal.intro_text_ru, intro_text_en: proposal.intro_text_en,
    cover_image_url: proposal.cover_image_url,
    currency: proposal.cost_currency || proposal.currency || '',
    cost_lines,
    cost_includes_ru: proposal.cost_includes_ru, cost_includes_en: proposal.cost_includes_en,
    cost_excludes_ru: proposal.cost_excludes_ru, cost_excludes_en: proposal.cost_excludes_en,
    cost_notes_ru: proposal.cost_notes_ru, cost_notes_en: proposal.cost_notes_en,
    total_price: proposal.total_price, price_from: Boolean(proposal.price_from),
    proposalId: proposal.id,
    sections,
    company: (company as DestinationData['company']) ?? null,
  }
}
