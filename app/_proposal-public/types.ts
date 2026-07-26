// Общие типы публичной страницы предложения (RU + EN).
// Данные грузит load-proposal.ts, отображает proposal-view.tsx.

export type Lang = 'ru' | 'en'

export type SelectedRoom = {
  uid: string
  room_id: string
  guests: number
  price: number | null
  meal?: string | null
}

export type PublicContentBlock = {
  id: string
  type: string // 'hotel' | 'activity' | 'transfer' | 'city'
  title_ru: string | null
  title_en: string | null
  description_ru: string | null
  description_en: string | null
  image_url: string | null
  images: string[] | null
  location: string | null
  tags: string[] | null
  rooms: unknown // jsonb [{id, images, title_ru, title_en, subtitle_ru, subtitle_en}]
}

export type PublicDayBlock = {
  id: string
  sort_order: number
  custom_note_ru: string | null
  custom_note_en: string | null
  room_type_ru: string | null
  room_type_en: string | null
  from_ru: string | null
  from_en: string | null
  to_ru: string | null
  to_en: string | null
  selected_rooms: SelectedRoom[] | null
  price: number | null
  guests: number | null
  content_blocks: PublicContentBlock | null
}

export type PublicDay = {
  id: string
  day_number: number
  date: string | null
  title_ru: string | null
  title_en: string | null
  intro_text_ru: string | null
  intro_text_en: string | null
  variant_id: string | null
  day_blocks: PublicDayBlock[]
}

export type GalleryItem = {
  id: string
  image_url: string
  caption_ru: string
  caption_en: string
}

export type PublicVariant = {
  id: string
  proposal_id: string
  sort_order: number
  name_ru: string | null
  name_en: string | null
  subtitle_ru: string | null
  subtitle_en: string | null
  is_selected: boolean
  total_price: number | null
  payment_terms_ru: string | null
  payment_terms_en: string | null
  cancellation_policy_ru: string | null
  cancellation_policy_en: string | null
  cost_includes_ru: string | null
  cost_includes_en: string | null
  cost_excludes_ru: string | null
  cost_excludes_en: string | null
  cost_notes_ru: string | null
  cost_notes_en: string | null
  gallery: GalleryItem[]
  impressions_text_ru: string | null
  impressions_text_en: string | null
  divider_image: string | null
  days: PublicDay[]
}

export type PublicProposal = {
  id: string
  slug: string
  trip_title_ru: string | null
  trip_title_en: string | null
  client_name_ru: string | null
  client_name_en: string | null
  guest_count: number | null
  start_date: string | null
  end_date: string | null
  cover_image_url: string | null
  intro_text_ru: string | null
  intro_text_en: string | null
  tagline_ru: string | null
  tagline_en: string | null
  season_ru: string | null
  season_en: string | null
  cost_currency: string | null
  currency: string | null
  company_id: string | null
}

export type PublicCompany = {
  name: string | null
  logo_url: string | null
  accent_color: string | null
  contact_email: string | null
  contact_phone: string | null
  website_url: string | null
  footer_note: string | null
}

export type LoadedProposal = {
  proposal: PublicProposal
  company: PublicCompany | null
  variants: PublicVariant[]
}