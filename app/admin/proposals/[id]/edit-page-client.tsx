'use client'

import { useState } from 'react'
import ProposalForm from './proposal-form'
import ProposalActions from './proposal-actions'
import DaysSection from './days-section'

type Proposal = {
  id: string
  slug: string
  client_name_ru: string | null
  client_name_en: string | null
  trip_title_ru: string | null
  trip_title_en: string | null
  guest_count: number | null
  start_date: string | null
  end_date: string | null
  status: string | null
  total_price: number | null
  currency: string | null
  cover_image_url: string | null
  intro_text_ru: string | null
  intro_text_en: string | null
}

export type ContentBlock = {
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

export type DayBlock = {
  id: string
  sort_order: number
  custom_note_ru: string | null
  custom_note_en: string | null
  content_blocks: ContentBlock
}

export type Day = {
  id: string
  day_number: number
  date: string | null
  title_ru: string | null
  title_en: string | null
  intro_text_ru: string | null
  intro_text_en: string | null
  day_blocks: DayBlock[]
}

export type Lang = 'ru' | 'en'

export default function EditPageClient({ proposal, days }: { proposal: Proposal; days: Day[] }) {
  const [lang, setLang] = useState<Lang>('ru')

  return (
    <ProposalForm
      proposal={proposal}
      lang={lang}
      onLangChange={setLang}
      actions={<ProposalActions slug={proposal.slug} />}
      itinerary={<DaysSection proposalId={proposal.id} days={days} lang={lang} />}
    />
  )
}