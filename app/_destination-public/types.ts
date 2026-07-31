// Общие типы публичной страницы НАПРАВЛЕНИЯ (RU + EN).
// Направление = proposal с kind='destination' + destination_sections + content_blocks + стоимость.

export type Lang = 'ru' | 'en'

export type DPhoto = { url: string; caption_ru: string; caption_en: string }

export type DRoom = {
  id: string
  title_ru: string
  title_en: string
  subtitle_ru: string // сюда кладётся метраж «80 кв.м., кинг/твин»
  subtitle_en: string
  images: DPhoto[]
}

// Резолвленная секция для рендера (discriminated union по type)
export type DSection =
  | { kind: 'route'; id: string; title_ru: string; title_en: string; stops: { date_ru: string; date_en: string; title_ru: string; title_en: string; desc_ru: string; desc_en: string }[] }
  | { kind: 'city'; id: string; title_ru: string; title_en: string; subtitle_ru: string; subtitle_en: string; name_ru: string; name_en: string; description_ru: string; description_en: string; facts_ru: string; facts_en: string; photos: DPhoto[] }
  | { kind: 'activities'; id: string; title_ru: string; title_en: string; items: { id: string; title_ru: string; title_en: string; description_ru: string; description_en: string; duration_hours: number | null; photo: string | null }[] }
  | { kind: 'hotel'; id: string; title_ru: string; title_en: string; name_ru: string; name_en: string; description_ru: string; description_en: string; activities_ru: string; activities_en: string; photos: DPhoto[]; rooms: DRoom[] }
  | { kind: 'gallery'; id: string; title_ru: string; title_en: string; images: DPhoto[] }
  | { kind: 'inspiration'; id: string; title_ru: string; title_en: string; images: DPhoto[]; overview_ru: string; overview_en: string; impressions_ru: string; impressions_en: string; divider_image: string | null }
  | { kind: 'sample_day'; id: string; title_ru: string; title_en: string; imageLeft: string | null; imageRight: string | null; items: { time: string; text_ru: string; text_en: string }[] }

export type DCostLine = { id: string; category: 'hotel' | 'transfer' | 'activity'; label_ru: string; label_en: string; details_ru: string; details_en: string; price: string }

export type DestinationData = {
  slug: string
  trip_title_ru: string | null
  trip_title_en: string | null
  tagline_ru: string | null
  tagline_en: string | null
  season_ru: string | null
  season_en: string | null
  intro_text_ru: string | null
  intro_text_en: string | null
  cover_image_url: string | null
  currency: string
  cost_lines: DCostLine[]
  cost_includes_ru: string | null
  cost_includes_en: string | null
  cost_excludes_ru: string | null
  cost_excludes_en: string | null
  cost_notes_ru: string | null
  cost_notes_en: string | null
  total_price: number | null
  price_from: boolean
  proposalId: string
  sections: DSection[]
  company: { name: string | null; logo_url: string | null; accent_color: string | null; contact_email: string | null } | null
}
