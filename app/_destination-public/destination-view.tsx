'use client'

import { useEffect, useMemo, useState } from 'react'
import '../_proposal-public/proposal.css'
import './destination.css'
import Carousel from '../_proposal-public/carousel'
import { notifyDestinationInterest } from './destination-lead-actions'
import type { DestinationData, DSection, DPhoto, Lang } from './types'

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', AED: 'AED ', GBP: '£' }

function fmtPrice(value: number | null | undefined, currency: string): string {
  if (value == null) return ''
  const sym = CURRENCY_SYMBOL[currency] ?? (currency ? currency + ' ' : '')
  const num = Math.round(value).toLocaleString('ru-RU').replace(/ /g, ' ')
  return `${sym}${num}`
}

function slides(photos: DPhoto[], lang: Lang) {
  return photos.map((p) => ({ url: p.url, caption: (lang === 'ru' ? p.caption_ru : p.caption_en) || '' }))
}

// разбить многострочный текст в буллеты
function bullets(text: string | null): string[] {
  return (text || '').split('\n').map((l) => l.trim()).filter(Boolean)
}

export default function DestinationView({ data, lang }: { data: DestinationData; lang: Lang }) {
  const t = <T,>(ru: T, en: T): T => (lang === 'ru' ? ru : en)
  const pick = (ru: string | null, en: string | null) => (lang === 'ru' ? ru : en) || ''

  const brandName = data.company?.name || 'Sky Travel'
  const accent = data.company?.accent_color || ''
  const currency = data.currency || ''

  // есть ли блок стоимости
  const hasCosts =
    data.cost_lines.length > 0 ||
    !!pick(data.cost_includes_ru, data.cost_includes_en) ||
    !!pick(data.cost_excludes_ru, data.cost_excludes_en) ||
    !!pick(data.cost_notes_ru, data.cost_notes_en) ||
    data.total_price != null

  // навигация: секции по порядку + «Стоимость»
  const nav = useMemo(() => {
    const secLabel = (s: DSection): string => {
      const title = pick(s.title_ru, s.title_en)
      if (title) return title
      switch (s.kind) {
        case 'route': return t('Маршрут', 'Route')
        case 'city': return pick(s.name_ru, s.name_en) || t('Город', 'City')
        case 'activities': return t('Активности', 'Experiences')
        case 'hotel': return t('Отели', 'Hotels')
        case 'gallery': return t('Галерея', 'Gallery')
        case 'sample_day': return t('День', 'A day')
      }
    }
    const items = data.sections.map((s) => ({ id: s.id, label: secLabel(s) }))
    if (hasCosts) items.push({ id: 'dp-costs', label: t('Стоимость', 'Pricing') })
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.sections, hasCosts, lang])

  const [burgerOpen, setBurgerOpen] = useState(false)
  const [activeSection, setActiveSection] = useState(nav[0]?.id ?? '')
  const [solidHeader, setSolidHeader] = useState(false)

  // скролл-спай
  useEffect(() => {
    const els = nav.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[]
    if (els.length === 0) return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActiveSection(visible[0].target.id)
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: [0, 0.25, 0.5, 1] }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [nav])

  useEffect(() => {
    document.body.style.overflow = burgerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [burgerOpen])

  useEffect(() => {
    const onScroll = () => setSolidHeader(window.scrollY > window.innerHeight * 0.6)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function goTo(id: string) {
    setBurgerOpen(false)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const heroTitle = pick(data.trip_title_ru, data.trip_title_en)
  const heroSub = pick(data.tagline_ru, data.tagline_en)
  const heroBadge = pick(data.season_ru, data.season_en)
  const intro = pick(data.intro_text_ru, data.intro_text_en)

  return (
    <div className="tp-root" style={accent ? ({ ['--tp-accent' as string]: accent } as React.CSSProperties) : undefined}>
      {/* ===== ХЕДЕР ===== */}
      <header className="tp-header" data-solid={solidHeader}>
        <div className="tp-header__top">
          <a href={lang === 'ru' ? `/d/${data.slug}` : `/en/d/${data.slug}`} className="tp-logo-link" aria-label={brandName}>
            {data.company?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.company.logo_url} alt={brandName} className="tp-logo-img" />
            ) : (
              <span className="tp-logo">{brandName}</span>
            )}
          </a>
          <span style={{ flex: 1 }} />
          <button className="tp-burger-btn" aria-label="Menu" onClick={() => setBurgerOpen(true)}>
            <BurgerIcon />
          </button>
        </div>
        <nav className="tp-nav">
          <div className="tp-nav__inner">
            {nav.map((n) => (
              <button key={n.id} className="tp-nav__link" data-active={activeSection === n.id} onClick={() => goTo(n.id)}>
                {n.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* ===== HERO ===== */}
      <section
        className="tp-hero tp-section--flush"
        style={data.cover_image_url ? { backgroundImage: `url(${data.cover_image_url})` } : undefined}
      >
        <div className="tp-hero__inner tp-container">
          <div className="tp-hero__eyebrow">{brandName}</div>
          {heroTitle && <h1 className="tp-hero__title">{heroTitle}</h1>}
          {heroSub && <p className="tp-hero__subtitle">{heroSub}</p>}
          {heroBadge && <div className="tp-hero__eyebrow" style={{ marginTop: 24, marginBottom: 0 }}>{heroBadge}</div>}
        </div>
      </section>

      {/* ===== ИНТРО ===== */}
      {intro && (
        <section className="tp-section">
          <div className="tp-container"><p className="dp-intro">{intro}</p></div>
        </section>
      )}

      {/* ===== СЕКЦИИ ===== */}
      {data.sections.map((s) => (
        <section key={s.id} id={s.id} className="tp-section">
          <div className="tp-container">{renderSection(s, lang, pick, t)}</div>
        </section>
      ))}

      {/* ===== СТОИМОСТЬ ===== */}
      {hasCosts && (
        <section id="dp-costs" className="tp-section">
          <div className="tp-container">
            <div className="dp-price-head">
              <h2 className="tp-h2">{t('Стоимость', 'Pricing')}</h2>
              {data.total_price != null && (
                <span className="dp-price-head__big">
                  {data.price_from ? `${t('от', 'from')} ` : ''}{fmtPrice(data.total_price, currency)}
                </span>
              )}
            </div>

            {data.cost_lines.length > 0 && (
              <div className="dp-costlist">
                {([
                  { key: 'hotel', title: t('Проживание', 'Accommodation') },
                  { key: 'transfer', title: t('Трансферы', 'Transfers') },
                  { key: 'activity', title: t('Активности', 'Experiences') },
                ] as const).map((cat) => {
                  const rows = data.cost_lines.filter((l) => l.category === cat.key)
                  if (rows.length === 0) return null
                  return (
                    <div key={cat.key} className="dp-costcat">
                      <div className="tp-label dp-costcat__label">{cat.title}</div>
                      {rows.map((line) => (
                        <div key={line.id} className="dp-costrow">
                          <div>
                            <div className="dp-costrow__name">{pick(line.label_ru, line.label_en) || '—'}</div>
                            {pick(line.details_ru, line.details_en) && (
                              <div className="dp-costrow__desc">{pick(line.details_ru, line.details_en)}</div>
                            )}
                          </div>
                          {line.price && <div className="dp-costrow__price">{line.price} {currency}</div>}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}

            {(pick(data.cost_includes_ru, data.cost_includes_en) || pick(data.cost_excludes_ru, data.cost_excludes_en)) && (
              <div className="dp-incl">
                {pick(data.cost_includes_ru, data.cost_includes_en) && (
                  <div>
                    <h4>{t('Стоимость включает', 'The price includes')}</h4>
                    <ul>{bullets(pick(data.cost_includes_ru, data.cost_includes_en)).map((li, i) => <li key={i}>{li}</li>)}</ul>
                  </div>
                )}
                {pick(data.cost_excludes_ru, data.cost_excludes_en) && (
                  <div>
                    <h4>{t('Не включает', 'Not included')}</h4>
                    <ul>{bullets(pick(data.cost_excludes_ru, data.cost_excludes_en)).map((li, i) => <li key={i}>{li}</li>)}</ul>
                  </div>
                )}
              </div>
            )}

            {pick(data.cost_notes_ru, data.cost_notes_en) && (
              <p className="dp-costnote">{pick(data.cost_notes_ru, data.cost_notes_en)}</p>
            )}
          </div>
        </section>
      )}

      {/* ===== CTA ===== */}
      <CtaBlock proposalId={data.proposalId} slug={data.slug} t={t} />

      <div className="dp-footer">
        {brandName}{data.company?.contact_email ? ` · ${data.company.contact_email}` : ''}
      </div>

      {/* ===== БУРГЕР ===== */}
      <div className="tp-overlay" data-open={burgerOpen} onClick={() => setBurgerOpen(false)} />
      <aside className="tp-drawer" data-open={burgerOpen}>
        <div className="tp-drawer__head">
          <span className="tp-label">{t('СОДЕРЖАНИЕ', 'CONTENTS')}</span>
          <button className="tp-drawer__close" aria-label="Close" onClick={() => setBurgerOpen(false)}>✕</button>
        </div>
        <nav className="tp-drawer__nav">
          {nav.map((n, i) => (
            <button key={n.id} className="tp-drawer__link" data-active={activeSection === n.id} onClick={() => goTo(n.id)}>
              <span className="tp-drawer__num">{String(i + 1).padStart(2, '0')}</span>
              <span>{n.label}</span>
              <span className="tp-drawer__dot" />
            </button>
          ))}
        </nav>
      </aside>
    </div>
  )
}

/* ---------- рендер одной секции ---------- */
function renderSection(
  s: DSection,
  lang: Lang,
  pick: (ru: string | null, en: string | null) => string,
  t: <T,>(ru: T, en: T) => T
) {
  const title = pick(s.title_ru, s.title_en)
  const Eyebrow = ({ text }: { text: string }) => <span className="tp-label dp-eyebrow">{text}</span>

  if (s.kind === 'route') {
    return (
      <>
        <Eyebrow text={t('Программа', 'Programme')} />
        <h2 className="tp-h2">{title || t('Маршрут путешествия', 'Travel route')}</h2>
        <div className="dp-itin">
          {s.stops.map((st, i) => (
            <div key={i} className="dp-itin__day">
              {pick(st.date_ru, st.date_en) && <div className="dp-itin__date">{pick(st.date_ru, st.date_en)}</div>}
              {pick(st.title_ru, st.title_en) && <div className="dp-itin__title">{pick(st.title_ru, st.title_en)}</div>}
              {pick(st.desc_ru, st.desc_en) && <div className="dp-itin__desc">{pick(st.desc_ru, st.desc_en)}</div>}
            </div>
          ))}
        </div>
      </>
    )
  }

  if (s.kind === 'city') {
    const subtitle = pick(s.subtitle_ru, s.subtitle_en)
    const facts = bullets(pick(s.facts_ru, s.facts_en))
    const desc = pick(s.description_ru, s.description_en)
    return (
      <>
        <Eyebrow text={title || t('Город', 'City')} />
        <h2 className="tp-h2">{pick(s.name_ru, s.name_en) || title}</h2>
        {subtitle && <p className="dp-sub-italic">{subtitle}</p>}
        <div className={`dp-city${facts.length && !desc ? ' dp-city--top' : ''}`}>
          <div>
            {desc && <p className="dp-city__text">{desc}</p>}
            {facts.length > 0 && <ul className="dp-facts">{facts.map((f, i) => <li key={i}>{f}</li>)}</ul>}
          </div>
          {s.photos.length > 0 && <Carousel slides={slides(s.photos, lang)} aspect="4 / 3" />}
        </div>
      </>
    )
  }

  if (s.kind === 'activities') {
    return (
      <>
        <Eyebrow text={title || t('Что посетить', 'What to see')} />
        <h2 className="tp-h2">{title || t('Активности', 'Experiences')}</h2>
        <div className="dp-acts">
          {s.items.map((a) => (
            <div key={a.id} className="dp-act">
              {a.photo && (
                <div className="dp-act__media">
                  <Carousel slides={[{ url: a.photo, caption: '' }]} aspect="3 / 2" />
                </div>
              )}
              <h4 className="dp-act__title">{pick(a.title_ru, a.title_en)}</h4>
              {pick(a.description_ru, a.description_en) && <p className="dp-act__desc">{pick(a.description_ru, a.description_en)}</p>}
              {a.duration_hours != null && <div className="dp-act__dur">⏱ {a.duration_hours} {t('ч', 'h')}</div>}
            </div>
          ))}
        </div>
      </>
    )
  }

  if (s.kind === 'hotel') {
    const desc = pick(s.description_ru, s.description_en)
    const acts = bullets(pick(s.activities_ru, s.activities_en))
    return (
      <>
        <Eyebrow text={title || t('Отель', 'Hotel')} />
        <div className="dp-hotels">
          <div className="dp-hotel">
            <h3 className="dp-hotel__name">{pick(s.name_ru, s.name_en)}</h3>
            <div className="dp-hotel__grid">
              {s.photos.length > 0 && <Carousel slides={slides(s.photos, lang)} aspect="3 / 2" />}
              {desc && <div className="dp-hotel__desc">{desc}</div>}
            </div>
            {s.rooms.length > 0 && (
              <div className="dp-rooms">
                {s.rooms.map((r) => (
                  <div key={r.id} className="dp-room">
                    <h4 className="dp-room__name">{pick(r.title_ru, r.title_en)}</h4>
                    {pick(r.subtitle_ru, r.subtitle_en) && <div className="dp-room__size">{pick(r.subtitle_ru, r.subtitle_en)}</div>}
                    {r.images.length > 0 && <Carousel slides={slides(r.images, lang)} aspect="16 / 10" />}
                  </div>
                ))}
              </div>
            )}
            {acts.length > 0 && (
              <div style={{ marginTop: 44 }}>
                <span className="tp-label dp-eyebrow">{t('Активности в отеле', 'Hotel experiences')}</span>
                <div className="dp-actlist">{acts.map((a, i) => <div key={i}>{a}</div>)}</div>
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  if (s.kind === 'gallery') {
    const pattern = ['dp-gal__cell--big', '', 'dp-gal__cell--tall', '', 'dp-gal__cell--wide', '']
    return (
      <>
        {title && <Eyebrow text={t('Галерея', 'Gallery')} />}
        {title && <h2 className="tp-h2">{title}</h2>}
        <div className="dp-gal">
          {s.images.map((img, i) => (
            <div key={i} className={`dp-gal__cell ${pattern[i % pattern.length]}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={(lang === 'ru' ? img.caption_ru : img.caption_en) || ''} />
            </div>
          ))}
        </div>
      </>
    )
  }

  if (s.kind === 'sample_day') {
    return (
      <>
        <Eyebrow text={t('Ритм', 'Rhythm')} />
        <h2 className="tp-h2">{title || t('Обычный день', 'A typical day')}</h2>
        <div className="dp-day">
          {s.imageLeft ? <div className="dp-day__side" style={{ backgroundImage: `url(${s.imageLeft})` }} /> : <div className="dp-day__side" />}
          <div className="dp-day__mid">
            {s.items.map((it, i) => (
              <div key={i} className="dp-day__it">
                {it.time && <div className="dp-day__t">{it.time}</div>}
                {pick(it.text_ru, it.text_en) && <div className="dp-day__x">{pick(it.text_ru, it.text_en)}</div>}
              </div>
            ))}
          </div>
          {s.imageRight ? <div className="dp-day__side" style={{ backgroundImage: `url(${s.imageRight})` }} /> : <div className="dp-day__side" />}
        </div>
      </>
    )
  }

  return null
}

/* ---------- CTA: одна кнопка, как в предложении (уведомляет менеджера) ---------- */
function CtaBlock({
  proposalId, slug, t,
}: {
  proposalId: string
  slug: string
  t: <T,>(ru: T, en: T) => T
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function handleClick() {
    if (state === 'sending' || state === 'sent') return
    setState('sending')
    try {
      const res = await notifyDestinationInterest({ proposalId, slug })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <section className="dp-cta">
      <div className="dp-cta__in">
        <h2 className="dp-cta__title">{t('Понравилось направление?', 'Like this destination?')}</h2>
        <p className="dp-cta__lead">
          {t('Нажмите — и мы соберём это путешествие под ваши даты, состав и пожелания.',
            'Click — and we will craft this trip around your dates, party and wishes.')}
        </p>
        <button className="tp-btn" type="button" onClick={handleClick} disabled={state === 'sending' || state === 'sent'}>
          {state === 'sent'
            ? t('ЗАЯВКА ОТПРАВЛЕНА ✓', 'REQUEST SENT ✓')
            : state === 'sending'
              ? t('ОТПРАВКА…', 'SENDING…')
              : t('ХОЧУ ТАКОЕ ПУТЕШЕСТВИЕ', 'I WANT A TRIP LIKE THIS')}
        </button>
        <p className="dp-cta__note">
          {state === 'error'
            ? t('Не удалось отправить — свяжитесь с менеджером напрямую.',
                'Could not send — please contact your manager directly.')
            : t('Менеджеру придёт уведомление, и он свяжется с вами.',
                'Your manager will be notified and will get in touch.')}
        </p>
      </div>
    </section>
  )
}

function BurgerIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <path d="M4 8h18M4 13h18M4 18h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
