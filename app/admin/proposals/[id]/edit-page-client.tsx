'use client'

import { useState } from 'react'
import ProposalForm from './proposal-form'
import ProposalActions from './proposal-actions'
import DaysSection from './days-section'
import { DaysProvider } from './days-context'
import type { ProposalClientOption } from '../../actions'
import VariantSwitcher, { type VariantBrief } from './variant-switcher'
import type { VariantFull } from './variant-actions'

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
  payment_terms_ru: string | null
  payment_terms_en: string | null
  cancellation_policy_ru: string | null
  cancellation_policy_en: string | null
  cost_currency: string | null
  cost_includes_ru: string | null
  cost_includes_en: string | null
  cost_excludes_ru: string | null
  cost_excludes_en: string | null
  cost_notes_ru: string | null
  cost_notes_en: string | null
  client_id: string | null
  layout: string | null
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
  rooms?: unknown
}

export type DayBlock = {
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
  room_ids: string[] | null
  activities_ru: string | null
  activities_en: string | null
  selected_rooms: { uid: string; room_id: string; guests: number; price: number | null; meal?: string | null }[] | null
  price: number | null
  guests: number | null
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

export default function EditPageClient({
  proposal, days, clients = [], variants = [], activeVariantId = null, activeVariant = null,
}: {
  proposal: Proposal
  days: Day[]
  clients?: ProposalClientOption[]
  variants?: VariantBrief[]
  activeVariantId?: string | null
  activeVariant?: VariantFull | null
}) {
  const [lang, setLang] = useState<Lang>('ru')

  return (
    <DaysProvider
      key={activeVariantId ?? 'no-variant'}
      proposalId={proposal.id}
      variantId={activeVariantId}
      initialDays={days}
      tripStart={proposal.start_date ?? null}
      tripEnd={proposal.end_date ?? null}
    >
      <ProposalForm
        proposal={proposal}
        lang={lang}
        onLangChange={setLang}
        clients={clients}
        activeVariant={activeVariant}
        actions={<ProposalActions slug={proposal.slug} />}
        variantSwitcher={
          <VariantSwitcher
            proposalId={proposal.id}
            variants={variants}
            activeVariantId={activeVariantId}
            lang={lang}
          />
        }
        itinerary={<DaysSection proposalId={proposal.id} lang={lang} />}
      />
    </DaysProvider>
  )
}