'use client'

import { useState } from 'react'
import type { PublicDay, Lang } from './types'

function pick(lang: Lang, ru: string | null, en: string | null): string {
  return (lang === 'ru' ? ru : en) || ''
}

function daysWord(n: number, lang: Lang): string {
  if (lang !== 'ru') return n === 1 ? 'day' : 'days'
  const d = n % 10, dd = n % 100
  return dd > 10 && dd < 20 ? 'дней' : d === 1 ? 'день' : d >= 2 && d <= 4 ? 'дня' : 'дней'
}

function fmtDayDate(s: string | null, lang: Lang): string {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  const str = d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  })
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export default function ProposalItinerary({
  days,
  variantLabel,
  lang,
}: {
  days: PublicDay[]
  variantLabel: string | null
  lang: Lang
}) {
  const ordered = [...days].sort((a, b) => a.day_number - b.day_number)
  const [open, setOpen] = useState<Set<string>>(() => (ordered[0] ? new Set([ordered[0].id]) : new Set()))

  if (ordered.length === 0) return null

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="tp-container">
      <div className="tp-itin__head">
        <span className="tp-label">
          {lang === 'ru' ? 'ПРОГРАММА' : 'PROGRAMME'}{variantLabel ? ` · ${variantLabel}` : ''}
        </span>
        <span className="tp-label">
          {ordered.length} {daysWord(ordered.length, lang)}
        </span>
      </div>

      <div className="tp-itin__list">
        {ordered.map((day) => {
          const isOpen = open.has(day.id)
          const blocks = day.day_blocks ?? []
          const titles = blocks
            .map((b) => pick(lang, b.content_blocks?.title_ru ?? null, b.content_blocks?.title_en ?? null))
            .filter(Boolean)
          const dayTitle = pick(lang, day.title_ru, day.title_en)
          const intro = pick(lang, day.intro_text_ru, day.intro_text_en)

          return (
            <div className="tp-day" data-open={isOpen} key={day.id}>
              <button type="button" className="tp-day__row" onClick={() => toggle(day.id)}>
                <span className="tp-day__num">
                  <span className="tp-day__n">{String(day.day_number).padStart(2, '0')}</span>
                  {day.date && <span className="tp-day__date">{fmtDayDate(day.date, lang)}</span>}
                </span>
                <span className="tp-day__head">
                  {dayTitle && <span className="tp-day__title">{dayTitle}</span>}
                  {titles.length > 0 && <span className="tp-day__sub">{titles.join(' · ')}</span>}
                </span>
                <span className="tp-day__toggle" aria-hidden="true">{isOpen ? '×' : '+'}</span>
              </button>

              {isOpen && (
                <div className="tp-day__body">
                  {intro && <p className="tp-day__intro">{intro}</p>}
                  {blocks.map((b) => {
                    const bt = pick(lang, b.content_blocks?.title_ru ?? null, b.content_blocks?.title_en ?? null)
                    const bd = pick(lang, b.content_blocks?.description_ru ?? null, b.content_blocks?.description_en ?? null)
                    const note = pick(lang, b.custom_note_ru, b.custom_note_en)
                    return (
                      <div className="tp-block" key={b.id}>
                        <div className="tp-block__time">{b.time || ''}</div>
                        <div className="tp-block__body">
                          {bt && <div className="tp-block__title">{bt}</div>}
                          {bd && <p className="tp-block__desc">{bd}</p>}
                          {note && <p className="tp-block__note">{note}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}