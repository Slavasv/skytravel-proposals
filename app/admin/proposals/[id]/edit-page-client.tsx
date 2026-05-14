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

type Day = {
  id: string
  day_number: number
  date: string | null
  title_ru: string | null
  title_en: string | null
  intro_text_ru: string | null
  intro_text_en: string | null
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