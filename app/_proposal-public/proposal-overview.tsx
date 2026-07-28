'use client'

import Carousel from './carousel'
import type { PublicProposal, PublicCompany, PublicVariant, TravellersSummary, Lang } from './types'

function pick(lang: Lang, ru: string | null, en: string | null): string {
  return (lang === 'ru' ? ru : en) || ''
}

function fmtDate(s: string | null, lang: Lang): string {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long' })
}

function daysWord(n: number, lang: Lang): string {
  if (lang !== 'ru') return `${n} ${n === 1 ? 'day' : 'days'}`
  const d = n % 10, dd = n % 100
  const w = dd > 10 && dd < 20 ? 'дней' : d === 1 ? 'день' : d >= 2 && d <= 4 ? 'дня' : 'дней'
  return `${n} ${w}`
}

function guestsWord(n: number, lang: Lang): string {
  if (lang !== 'ru') return `${n} ${n === 1 ? 'guest' : 'guests'}`
  const d = n % 10, dd = n % 100
  const w = dd > 10 && dd < 20 ? 'гостей' : d === 1 ? 'гость' : d >= 2 && d <= 4 ? 'гостя' : 'гостей'
  return `${n} ${w}`
}

function adultsWord(n: number, lang: Lang): string {
  if (lang !== 'ru') return `${n} ${n === 1 ? 'adult' : 'adults'}`
  return `${n} ${n === 1 ? 'взрослый' : 'взрослых'}`
}

function childrenWord(n: number, lang: Lang): string {
  if (lang !== 'ru') return `${n} ${n === 1 ? 'child' : 'children'}`
  const d = n % 10, dd = n % 100
  const w = dd > 10 && dd < 20 ? 'детей' : d === 1 ? 'ребёнок' : d >= 2 && d <= 4 ? 'ребёнка' : 'детей'
  return `${n} ${w}`
}

function travellersText(t: TravellersSummary | null, guestCount: number | null, lang: Lang): string {
  if (!t || (t.adults === 0 && t.children === 0)) {
    return guestCount ? guestsWord(guestCount, lang) : ''
  }
  const parts: string[] = []
  if (t.adults > 0) parts.push(adultsWord(t.adults, lang))
  if (t.children > 0) {
    let c = childrenWord(t.children, lang)
    if (t.childAges.length > 0) c += ` (${t.childAges.join(', ')})`
    parts.push(c)
  }
  return parts.join(' + ')
}

export default function ProposalOverview({
  proposal,
  variant,
  variantLabel,
  travellers,
  lang,
}: {
  proposal: PublicProposal
  company: PublicCompany | null
  variant: PublicVariant
  variantLabel: string | null
  travellers: TravellersSummary | null
  lang: Lang
}) {
  const eyebrow = lang === 'ru' ? 'АВТОРСКИЙ МАРШРУТ' : 'SIGNATURE JOURNEY'
  const title = pick(lang, proposal.trip_title_ru, proposal.trip_title_en)
  const subtitle =
    pick(lang, proposal.intro_text_ru, proposal.intro_text_en) ||
    pick(lang, proposal.tagline_ru, proposal.tagline_en)
  const variantSub = pick(lang, variant.subtitle_ru, variant.subtitle_en)
  const variantOverview = pick(lang, variant.overview_ru, variant.overview_en)
  const impressionsText = pick(lang, variant.impressions_text_ru, variant.impressions_text_en)
  const country = pick(lang, proposal.country_ru, proposal.country_en)
  const gallery = variant.gallery ?? []
  const divider = variant.divider_image

  // длительность: по датам поездки, иначе по числу дней варианта
  let duration = variant.days.length
  if (proposal.start_date && proposal.end_date) {
    const diff = Math.round(
      (new Date(proposal.end_date).getTime() - new Date(proposal.start_date).getTime()) / 86400000
    ) + 1
    if (diff > 0) duration = diff
  }

  const meta: { label: string; value: string }[] = []
  if (proposal.start_date && proposal.end_date) {
    meta.push({
      label: lang === 'ru' ? 'ДАТЫ' : 'DATES',
      value: `${fmtDate(proposal.start_date, lang)} — ${fmtDate(proposal.end_date, lang)}`,
    })
  }
  if (duration > 0) {
    meta.push({ label: lang === 'ru' ? 'ДЛИТЕЛЬНОСТЬ' : 'DURATION', value: daysWord(duration, lang) })
  }
  const travText = travellersText(travellers, proposal.guest_count, lang)
  if (travText) {
    meta.push({ label: lang === 'ru' ? 'ПУТЕШЕСТВЕННИКИ' : 'TRAVELLERS', value: travText })
  }
  if (country) {
    meta.push({ label: lang === 'ru' ? 'СТРАНА' : 'COUNTRY', value: country })
  }

  const hasImpressions = gallery.length > 0 || Boolean(impressionsText)

  return (
    <>
      <div
        className="tp-hero"
        style={proposal.cover_image_url ? { backgroundImage: `url(${proposal.cover_image_url})` } : undefined}
      >
        <div className="tp-hero__inner tp-container">
          <div className="tp-hero__eyebrow">{eyebrow}</div>
          {title && <h1 className="tp-hero__title">{title}</h1>}
          {subtitle && <p className="tp-hero__subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="tp-container">
        {meta.length > 0 && (
          <div className="tp-meta">
            {meta.map((m) => (
              <div className="tp-meta__item" key={m.label}>
                <div className="tp-label">{m.label}</div>
                <div className="tp-meta__value">{m.value}</div>
              </div>
            ))}
          </div>
        )}

        {variantSub && (
          <div className="tp-meta__variant">
            {variantLabel && <span className="tp-label">{variantLabel}</span>}
            <span className="tp-meta__variant-text">{variantSub}</span>
          </div>
        )}

        {/* Овервью варианта — абзац с буквицей */}
        {variantOverview && (
          <div className="tp-overview">
            <p className="tp-overview__text">{variantOverview}</p>
          </div>
        )}

        {/* Впечатления: заголовок + текст + галерея */}
        {hasImpressions && (
          <div className="tp-impressions">
            <h2 className="tp-h2 tp-impressions__title">{lang === 'ru' ? 'Впечатления' : 'Impressions'}</h2>
            {gallery.length > 0 && (
              <Carousel
                slides={gallery.map((g) => ({ url: g.image_url, caption: pick(lang, g.caption_ru, g.caption_en) }))}
              />
            )}
            {impressionsText && <p className="tp-impressions__text">{impressionsText}</p>}
          </div>
        )}
      </div>

      {/* Фото-дивайдер — на всю ширину */}
      {divider && <div className="tp-divider" style={{ backgroundImage: `url(${divider})` }} />}
    </>
  )
}