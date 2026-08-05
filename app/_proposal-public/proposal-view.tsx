'use client'

import { useEffect, useMemo, useState } from 'react'
import './proposal.css'
import ProposalOverview from './proposal-overview'
import ProposalItinerary from './proposal-itinerary'
import ProposalAccommodation from './proposal-accommodation'
import ProposalCosts from './proposal-costs'
import ProposalTerms from './proposal-terms'
import SavePdfButton from './save-pdf-button'
import type { LoadedProposal, Lang, PublicVariant } from './types'

/* Секции страницы (без «Авиаперелёт» — добавим отдельным этапом). */
const SECTIONS: { id: string; ru: string; en: string }[] = [
  { id: 'obzor', ru: 'Обзор', en: 'Overview' },
  { id: 'marshrut', ru: 'Маршрут по дням', en: 'Itinerary' },
  { id: 'prozhivanie', ru: 'Проживание', en: 'Accommodation' },
  { id: 'stoimost', ru: 'Стоимость', en: 'Costs' },
  { id: 'usloviya', ru: 'Условия', en: 'Terms' },
]

const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', AED: 'AED ', GBP: '£' , UAH: '₴' }

function fmtPrice(value: number | null | undefined, currency: string): string {
  if (value == null) return ''
  const sym = CURRENCY_SYMBOL[currency] ?? (currency ? currency + ' ' : '')
  // разряды тонким пробелом: 68 400
  const num = Math.round(value).toLocaleString('ru-RU').replace(/ /g, ' ')
  return `${sym}${num}`
}

function pick(lang: Lang, ru: string | null, en: string | null): string {
  return (lang === 'ru' ? ru : en) || ''
}

export default function ProposalView({ data, lang, print = false }: { data: LoadedProposal; lang: Lang; print?: boolean }) {
  const { proposal, company, variants, travellers } = data
  const currency = proposal.cost_currency || proposal.currency || 'EUR'
  const accent = company?.accent_color || '' // акцент бренда переопределяет --tp-accent

  // отельное предложение — без программы по дням: секцию «Маршрут по дням» не показываем
  const isHotel = proposal.layout === 'hotel'
  const sections = useMemo(
    () => SECTIONS.filter((s) => !(isHotel && s.id === 'marshrut')),
    [isHotel]
  )

  // активный вариант: выбранный клиентом, иначе первый
  const initialId = useMemo(() => {
    const chosen = variants.find((v) => v.is_selected)
    return chosen?.id ?? variants[0]?.id ?? ''
  }, [variants])

  const [activeId, setActiveId] = useState(initialId)
  const [menuOpen, setMenuOpen] = useState(false)
  const [burgerOpen, setBurgerOpen] = useState(false)
  const [activeSection, setActiveSection] = useState(sections[0].id)
  const [solidHeader, setSolidHeader] = useState(false) // прозрачный над hero → плотный при скролле

  const active: PublicVariant | undefined =
    variants.find((v) => v.id === activeId) ?? variants[0]
  const activeIndex = variants.findIndex((v) => v.id === active?.id)
  const brandName = company?.name || 'Travel System'

  // скролл-спай: подсветка активной секции в навигации
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[]
    if (els.length === 0) return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActiveSection(visible[0].target.id)
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: [0, 0.25, 0.5, 1] }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [sections])

  // блокируем скролл body при открытом бургере
  useEffect(() => {
    document.body.style.overflow = burgerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [burgerOpen])

  // хедер: прозрачный над hero, плотный после прокрутки за него
  useEffect(() => {
    const onScroll = () => setSolidHeader(window.scrollY > window.innerHeight * 0.6)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function selectVariant(id: string) {
    setActiveId(id)
    setMenuOpen(false)
    setBurgerOpen(false)
  }

  function goTo(id: string) {
    setBurgerOpen(false)
    setMenuOpen(false)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const variantNum = (v: PublicVariant) => variants.findIndex((x) => x.id === v.id) + 1
  const sectionLabel = (s: (typeof SECTIONS)[number]) => (lang === 'ru' ? s.ru : s.en)
  const daysWord = (n: number) =>
    lang === 'ru'
      ? `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дня' : 'дней'}`
      : `${n} ${n === 1 ? 'day' : 'days'}`

  if (!active) return null

  // единый ярлык варианта: при ОДНОМ варианте не упоминаем «Маршрут» вовсе;
  // при нескольких — показываем НАЗВАНИЕ варианта (фолбэк «Маршрут N», если имя пустое)
  const hasMultiple = variants.length > 1
  const variantLabel: string | null = hasMultiple
    ? (pick(lang, active.name_ru, active.name_en) || `${lang === 'ru' ? 'Маршрут' : 'Route'} ${activeIndex + 1}`)
    : null

  // длительность: по датам поездки, иначе по числу дней варианта (для отельного days = служебный день)
  const durationDays = (() => {
    if (proposal.start_date && proposal.end_date) {
      const diff = Math.round(
        (new Date(proposal.end_date).getTime() - new Date(proposal.start_date).getTime()) / 86400000
      ) + 1
      if (diff > 0) return diff
    }
    return active.days.length
  })()

  return (
    <div
      className="tp-root"
      style={accent ? ({ ['--tp-accent' as string]: accent } as React.CSSProperties) : undefined}
    >
      {!print && <SavePdfButton slug={proposal.slug} kind="p" lang={lang} />}

      {/* ===================== ФИКС-ХЕДЕР ===================== */}
      <header className="tp-header" data-solid={solidHeader}>
        <div className="tp-header__top">
          
            <a href={lang === 'ru' ? `/p/${proposal.slug}` : `/en/p/${proposal.slug}`} className="tp-logo-link" aria-label={brandName}>
            {company?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo_url} alt={brandName} className="tp-logo-img" />
            ) : (
              <span className="tp-logo">{brandName}</span>
            )}
          </a>

          {/* переключатель варианта — только когда вариантов несколько */}
          {hasMultiple && (
            <button
              className="tp-variant-current"
              data-open={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className="tp-variant-current__meta">
                <span className="tp-variant-current__eyebrow">
                  {lang === 'ru' ? 'ВЫБРАННЫЙ МАРШРУТ' : 'SELECTED ROUTE'} · <b>{lang === 'ru' ? 'СМЕНИТЬ' : 'CHANGE'}</b>
                </span>
                <span className="tp-variant-current__name">
                  {pick(lang, active.name_ru, active.name_en) || `${lang === 'ru' ? 'Маршрут' : 'Route'} ${activeIndex + 1}`}
                </span>
                {pick(lang, active.subtitle_ru, active.subtitle_en) && (
                  <span className="tp-variant-current__sub">{pick(lang, active.subtitle_ru, active.subtitle_en)}</span>
                )}
              </span>
              <Chevron />
            </button>
          )}

          <button className="tp-burger-btn" aria-label="Menu" onClick={() => setBurgerOpen(true)}>
            <BurgerIcon />
          </button>
        </div>

        {/* навигация по секциям */}
        <nav className="tp-nav">
          <div className="tp-nav__inner">
            {sections.map((s) => (
              <button
                key={s.id}
                className="tp-nav__link"
                data-active={activeSection === s.id}
                onClick={() => goTo(s.id)}
              >
                {sectionLabel(s)}
              </button>
            ))}
          </div>
        </nav>

        {/* выпадашка смены варианта из хедера */}
        {menuOpen && hasMultiple && (
          <div className="tp-variant-menu">
            <div className="tp-variant-menu__inner">
              {variants.map((v) => (
                <button
                  key={v.id}
                  className="tp-variant-opt"
                  data-active={v.id === active.id}
                  onClick={() => selectVariant(v.id)}
                >
                  <div className="tp-variant-opt__eyebrow">
                    {lang === 'ru' ? 'МАРШРУТ' : 'ROUTE'} № {variantNum(v)}
                  </div>
                  <div className="tp-variant-opt__name">
                    {pick(lang, v.name_ru, v.name_en) || `${lang === 'ru' ? 'Маршрут' : 'Route'} ${variantNum(v)}`}
                  </div>
                  {v.total_price != null && (
                    <div className="tp-variant-opt__price">{fmtPrice(v.total_price, currency)}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* закрытие выпадашки кликом мимо */}
      {menuOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 48 }}
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ===================== СЕКЦИИ ===================== */}
      <main className="tp-main">
        {sections.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className={s.id === 'obzor' ? 'tp-section tp-section--flush' : 'tp-section'}
          >
            {s.id === 'obzor' ? (
              <ProposalOverview
                proposal={proposal}
                company={company}
                variant={active}
                variantLabel={variantLabel}
                travellers={travellers}
                lang={lang}
              />
            ) : s.id === 'marshrut' ? (
              <ProposalItinerary
                key={active.id}
                days={active.days}
                variantLabel={variantLabel}
                lang={lang}
                forceOpen={print}
              />
            ) : s.id === 'prozhivanie' ? (
              <ProposalAccommodation
                key={active.id}
                variant={active}
                variantLabel={variantLabel}
                tripStart={proposal.start_date}
                tripEnd={proposal.end_date}
                lang={lang}
              />
            ) : s.id === 'stoimost' ? (
              <ProposalCosts
                variants={variants}
                activeId={active.id}
                onSelect={selectVariant}
                proposal={proposal}
                lang={lang}
              />
            ) : s.id === 'usloviya' ? (
              <ProposalTerms
                key={active.id}
                variant={active}
                variantLabel={variantLabel}
                proposal={proposal}
                lang={lang}
              />
            ) : (
              <div className="tp-container">
                <div className="tp-placeholder">
                  <span className="tp-placeholder__title">{sectionLabel(s)}</span>
                </div>
              </div>
            )}
          </section>
        ))}
      </main>

      {/* ===================== ФУТЕР (цвет бренда, как в ваучере) ===================== */}
      <footer className="tp-footer">
        <div className="tp-footer__line">
          <span className="tp-footer__star">✦</span>{'  '}
          {[
            company?.footer_note || brandName,
            company?.contact_email,
            company?.contact_phone,
            company?.website_url?.replace(/^https?:\/\//, ''),
          ].filter(Boolean).join('  ·  ')}
          {'  '}<span className="tp-footer__star">✦</span>
        </div>
        {company?.office_address && (
          <div className="tp-footer__addr">{company.office_address}</div>
        )}
      </footer>

      {/* ===================== БУРГЕР (СОДЕРЖАНИЕ) ===================== */}
      <div className="tp-overlay" data-open={burgerOpen} onClick={() => setBurgerOpen(false)} />
      <aside className="tp-drawer" data-open={burgerOpen}>
        <div className="tp-drawer__head">
          <span className="tp-label">{lang === 'ru' ? 'СОДЕРЖАНИЕ' : 'CONTENTS'}</span>
          <button className="tp-drawer__close" aria-label="Close" onClick={() => setBurgerOpen(false)}>
            ✕
          </button>
        </div>

        <div className="tp-drawer__active">
          {hasMultiple && (
            <>
              <span className="tp-label">{lang === 'ru' ? 'АКТИВНЫЙ МАРШРУТ' : 'ACTIVE ROUTE'}</span>
              <div className="tp-drawer__active-name">
                № {activeIndex + 1} — {pick(lang, active.name_ru, active.name_en)}
              </div>
            </>
          )}
          <div className="tp-drawer__active-meta">
            {active.total_price != null && <>{fmtPrice(active.total_price, currency)} · </>}
            {daysWord(durationDays)}
          </div>
        </div>

        <nav className="tp-drawer__nav">
          {sections.map((s, i) => (
            <button
              key={s.id}
              className="tp-drawer__link"
              data-active={activeSection === s.id}
              onClick={() => goTo(s.id)}
            >
              <span className="tp-drawer__num">{String(i + 1).padStart(2, '0')}</span>
              <span>{sectionLabel(s)}</span>
              <span className="tp-drawer__dot" />
            </button>
          ))}
        </nav>

        {hasMultiple && (
          <div className="tp-switch">
            <div className="tp-label tp-switch__label">{lang === 'ru' ? 'СМЕНИТЬ МАРШРУТ' : 'CHANGE ROUTE'}</div>
            <div className="tp-switch__btns">
              {variants.map((v) => (
                <button
                  key={v.id}
                  className="tp-switch-btn"
                  data-active={v.id === active.id}
                  onClick={() => selectVariant(v.id)}
                >
                  № {variantNum(v)}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

function Chevron() {
  return (
    <svg className="tp-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BurgerIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <path d="M4 8h18M4 13h18M4 18h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}