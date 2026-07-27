'use client'

import { useState } from 'react'
import { notifyClientChoice } from './booking-actions'
import type { PublicVariant, PublicProposal, Lang } from './types'

function pick(lang: Lang, ru: string | null, en: string | null): string {
  return (lang === 'ru' ? ru : en) || ''
}

function lines(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean)
}

// «период — правило» → две колонки; если разделителя нет — одна
function splitCancel(line: string): [string, string] {
  const m = line.match(/^(.*?)\s[—–-]\s(.+)$/)
  if (m) return [m[1].trim(), m[2].trim()]
  return [line, '']
}

export default function ProposalTerms({
  variant,
  variantNumber,
  proposal,
  lang,
}: {
  variant: PublicVariant
  variantNumber: number
  proposal: PublicProposal
  lang: Lang
}) {
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  async function handleBook() {
    if (sendState === 'sending' || sendState === 'sent') return
    setSendState('sending')
    try {
      const res = await notifyClientChoice({ proposalId: proposal.id, variantId: variant.id, slug: proposal.slug })
      setSendState(res.ok ? 'sent' : 'error')
    } catch {
      setSendState('error')
    }
  }

  const payment = lines(pick(lang, variant.payment_terms_ru, variant.payment_terms_en))
  const cancellation = lines(pick(lang, variant.cancellation_policy_ru, variant.cancellation_policy_en))
  const includes = lines(pick(lang, variant.cost_includes_ru, variant.cost_includes_en))
  const excludes = lines(pick(lang, variant.cost_excludes_ru, variant.cost_excludes_en))
  const notes = lines(pick(lang, variant.cost_notes_ru, variant.cost_notes_en))

  const hasAnything =
    payment.length || cancellation.length || includes.length || excludes.length || notes.length
  if (!hasAnything) return null

  const routeLabel = `${lang === 'ru' ? 'Маршрут' : 'Route'} № ${variantNumber}`
  const ctaText = `${lang === 'ru' ? 'ЗАБРОНИРОВАТЬ' : 'BOOK'} · ${routeLabel.toUpperCase()}`

  return (
    <div className="tp-container">
      <div className="tp-itin__head">
        <span className="tp-label">{lang === 'ru' ? 'УСЛОВИЯ БРОНИРОВАНИЯ' : 'BOOKING TERMS'}</span>
      </div>

      {(payment.length > 0 || cancellation.length > 0) && (
        <div className="tp-terms__cols">
          {payment.length > 0 && (
            <div className="tp-terms__col">
              <div className="tp-label tp-terms__collabel">{lang === 'ru' ? 'ОПЛАТА' : 'PAYMENT'}</div>
              <ol className="tp-pay">
                {payment.map((line, i) => (
                  <li className="tp-pay__item" key={i}>
                    <span className="tp-pay__num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="tp-pay__text">{line}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {cancellation.length > 0 && (
            <div className="tp-terms__col">
              <div className="tp-label tp-terms__collabel">{lang === 'ru' ? 'ОТМЕНА И ИЗМЕНЕНИЯ' : 'CANCELLATION & CHANGES'}</div>
              <div className="tp-cancel">
                {cancellation.map((line, i) => {
                  const [period, rule] = splitCancel(line)
                  return (
                    <div className="tp-cancel__row" key={i}>
                      <span className="tp-cancel__period">{period}</span>
                      {rule && <span className="tp-cancel__rule">{rule}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {(includes.length > 0 || excludes.length > 0) && (
        <div className="tp-terms__cols tp-terms__cols--incl">
          {includes.length > 0 && (
            <div className="tp-terms__col">
              <div className="tp-label tp-terms__collabel">{lang === 'ru' ? 'ВКЛЮЧЕНО В СТОИМОСТЬ' : 'INCLUDED'}</div>
              <ul className="tp-incl">
                {includes.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </div>
          )}
          {excludes.length > 0 && (
            <div className="tp-terms__col">
              <div className="tp-label tp-terms__collabel">{lang === 'ru' ? 'НЕ ВКЛЮЧЕНО' : 'NOT INCLUDED'}</div>
              <ul className="tp-incl">
                {excludes.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {notes.length > 0 && (
        <div className="tp-terms__notes">
          <div className="tp-label tp-terms__collabel">{lang === 'ru' ? 'ПРИМЕЧАНИЯ' : 'NOTES'}</div>
          <ul className="tp-incl">
            {notes.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      )}

      <div className="tp-terms__cta">
        <button
          type="button"
          className="tp-btn"
          onClick={handleBook}
          disabled={sendState === 'sending' || sendState === 'sent'}
        >
          {sendState === 'sent'
            ? (lang === 'ru' ? 'ЗАЯВКА ОТПРАВЛЕНА ✓' : 'REQUEST SENT ✓')
            : sendState === 'sending'
              ? (lang === 'ru' ? 'ОТПРАВКА…' : 'SENDING…')
              : ctaText}
        </button>
        <p className="tp-terms__cta-note">
          {sendState === 'error'
            ? (lang === 'ru'
                ? 'Не удалось отправить письмо — свяжитесь с менеджером напрямую. Ваш выбор мы всё равно отметили.'
                : 'Could not send the email — please contact your manager directly.')
            : lang === 'ru'
              ? 'Готовы подтвердить маршрут? Нажмите — уведомим менеджера о вашем выборе.'
              : 'Ready to confirm the route? Click — we’ll notify your manager of your choice.'}
        </p>
      </div>
    </div>
  )
}