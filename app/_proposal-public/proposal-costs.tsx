'use client'

import { computeCosts } from '@/lib/proposal-costs'
import type { PublicVariant, PublicProposal, Lang } from './types'

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', AED: 'AED ', GBP: '£' , UAH: '₴' }

function fmtPrice(v: number | null | undefined, cur: string): string {
  if (v == null) return ''
  const sym = CURRENCY_SYMBOL[cur] ?? (cur ? cur + ' ' : '')
  return `${sym}${Math.round(v).toLocaleString('ru-RU')}`
}

function pick(lang: Lang, ru: string | null, en: string | null): string {
  return (lang === 'ru' ? ru : en) || ''
}

function guestsWord(n: number, lang: Lang): string {
  if (lang !== 'ru') return `${n} ${n === 1 ? 'guest' : 'guests'}`
  const d = n % 10, dd = n % 100
  const w = dd > 10 && dd < 20 ? 'гостей' : d === 1 ? 'гость' : d >= 2 && d <= 4 ? 'гостя' : 'гостей'
  return `${n} ${w}`
}

export default function ProposalCosts({
  variants,
  activeId,
  onSelect,
  proposal,
  lang,
}: {
  variants: PublicVariant[]
  activeId: string
  onSelect: (id: string) => void
  proposal: PublicProposal
  lang: Lang
}) {
  const active = variants.find((v) => v.id === activeId) ?? variants[0]
  if (!active) return null

  const activeIndex = variants.findIndex((v) => v.id === active.id)
  // при одном варианте «Маршрут» не упоминаем; при нескольких — название варианта
  const variantLabel = variants.length > 1
    ? (pick(lang, active.name_ru, active.name_en) || `${lang === 'ru' ? 'Маршрут' : 'Route'} ${activeIndex + 1}`)
    : null
  const currency = proposal.cost_currency || proposal.currency || 'EUR'
  const costs = computeCosts(active.days, proposal.start_date, proposal.end_date, lang)
  const allIncl = lang === 'ru' ? 'всё включено' : 'all inclusive'

  const cats = [
    { label: lang === 'ru' ? 'Проживание' : 'Accommodation', c: costs.accommodation },
    { label: lang === 'ru' ? 'Экскурсии и активности' : 'Excursions & activities', c: costs.activities },
    { label: lang === 'ru' ? 'Трансферы' : 'Transfers', c: costs.transfers },
  ].filter((x) => x.c.total > 0 || x.c.desc)

  return (
    <div className="tp-container">
      <h2 className="tp-h2 tp-costs__title">{lang === 'ru' ? 'Стоимость' : 'Costs'}</h2>

      {/* карточки-цены вариантов */}
      <div className="tp-costcards">
        {variants.map((v, i) => (
          <button
            key={v.id}
            type="button"
            className="tp-costcard"
            data-active={v.id === active.id}
            onClick={() => onSelect(v.id)}
          >
            {(() => {
              const cardLabel = pick(lang, v.name_ru, v.name_en) ||
                (variants.length > 1 ? `${lang === 'ru' ? 'Маршрут' : 'Route'} ${i + 1}` : '')
              return cardLabel ? <div className="tp-costcard__eyebrow">{cardLabel}</div> : null
            })()}
            <div className="tp-costcard__price">{fmtPrice(v.total_price, currency) || '—'}</div>
            {proposal.guest_count ? (
              <div className="tp-costcard__meta">
                {guestsWord(proposal.guest_count, lang)} · {allIncl}
              </div>
            ) : null}
          </button>
        ))}
      </div>

      {/* структура стоимости активного варианта */}
      {cats.length > 0 && (
        <div className="tp-coststruct">
          <div className="tp-label tp-coststruct__label">
            {lang === 'ru' ? 'СТРУКТУРА СТОИМОСТИ' : 'COST BREAKDOWN'}{variantLabel ? ` · ${variantLabel}` : ''}
          </div>

          {cats.map((cat) => (
            <div className="tp-costgroup" key={cat.label}>
              <div className="tp-costrow tp-costrow--cat">
                <div className="tp-costrow__main">
                  <div className="tp-costrow__name">{cat.label}</div>
                </div>
                <div className="tp-costrow__price">{fmtPrice(cat.c.total, currency)}</div>
              </div>
              {cat.c.items.map((it, i) => (
                <div className="tp-costline" key={i}>
                  <div className="tp-costline__main">
                    <span className="tp-costline__name">{it.label}</span>
                    {it.sub && <span className="tp-costline__sub"> · {it.sub}</span>}
                  </div>
                  {it.price != null && <div className="tp-costline__price">{fmtPrice(it.price, currency)}</div>}
                </div>
              ))}
            </div>
          ))}

          <div className="tp-costtotal">
            <div className="tp-costtotal__label">{lang === 'ru' ? 'ИТОГО' : 'TOTAL'}</div>
            <div className="tp-costtotal__price">{fmtPrice(costs.total, currency)}</div>
          </div>

          {proposal.guest_count ? (
            <p className="tp-costnote">
              {lang === 'ru'
                ? `На ${guestsWord(proposal.guest_count, lang)}. Окончательная цена фиксируется при подписании договора.`
                : `For ${guestsWord(proposal.guest_count, lang)}. The final price is fixed upon signing the contract.`}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}