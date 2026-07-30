'use client'

import { useState, useEffect, useRef } from 'react'
import { updateVariant, type VariantFull } from './variant-actions'
import type { Lang } from './edit-page-client'
import { useT } from '@/lib/i18n-client'

export default function VariantTerms({ variant, lang }: { variant: VariantFull; lang: Lang }) {
  const t = useT()
  const includesKey = lang === 'ru' ? 'cost_includes_ru' : 'cost_includes_en'
  const excludesKey = lang === 'ru' ? 'cost_excludes_ru' : 'cost_excludes_en'
  const notesKey = lang === 'ru' ? 'cost_notes_ru' : 'cost_notes_en'
  const paymentKey = lang === 'ru' ? 'payment_terms_ru' : 'payment_terms_en'
  const cancellationKey = lang === 'ru' ? 'cancellation_policy_ru' : 'cancellation_policy_en'

  const [form, setForm] = useState({
    cost_includes_ru: variant.cost_includes_ru || '',
    cost_includes_en: variant.cost_includes_en || '',
    cost_excludes_ru: variant.cost_excludes_ru || '',
    cost_excludes_en: variant.cost_excludes_en || '',
    cost_notes_ru: variant.cost_notes_ru || '',
    cost_notes_en: variant.cost_notes_en || '',
    payment_terms_ru: variant.payment_terms_ru || '',
    payment_terms_en: variant.payment_terms_en || '',
    cancellation_policy_ru: variant.cancellation_policy_ru || '',
    cancellation_policy_en: variant.cancellation_policy_en || '',
  })

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      updateVariant(variant.id, {
        cost_includes_ru: form.cost_includes_ru || null,
        cost_includes_en: form.cost_includes_en || null,
        cost_excludes_ru: form.cost_excludes_ru || null,
        cost_excludes_en: form.cost_excludes_en || null,
        cost_notes_ru: form.cost_notes_ru || null,
        cost_notes_en: form.cost_notes_en || null,
        payment_terms_ru: form.payment_terms_ru || null,
        payment_terms_en: form.payment_terms_en || null,
        cancellation_policy_ru: form.cancellation_policy_ru || null,
        cancellation_policy_en: form.cancellation_policy_en || null,
      }).catch(() => {})
    }, 1000)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '14px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '13px', fontWeight: 500, color: 'var(--admin-text)', display: 'block', marginBottom: '6px',
  }
  const hint: React.CSSProperties = { fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <label style={labelStyle}>{t('This cost includes', 'В стоимость входит')}</label>
        <textarea value={form[includesKey]} onChange={(e) => set(includesKey, e.target.value)} rows={6}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          placeholder={t('e.g.:\nAirport transfers\n2 nights at Four Seasons — Villa, All Inclusive', 'напр.:\nТрансферы из аэропорта\n2 ночи в Four Seasons — вилла, всё включено')} />
        <p style={hint}>{t('One item per line.', 'По одному пункту в строке.')}</p>
      </div>
      <div>
        <label style={labelStyle}>{t('This cost does not include', 'В стоимость не входит')}</label>
        <textarea value={form[excludesKey]} onChange={(e) => set(excludesKey, e.target.value)} rows={5}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          placeholder={t('e.g.:\nInternational flights\nVisas\nPersonal insurance', 'напр.:\nМеждународные перелёты\nВизы\nЛичная страховка')} />
        <p style={hint}>{t('One item per line.', 'По одному пункту в строке.')}</p>
      </div>
      <div>
        <label style={labelStyle}>{t('Notes', 'Примечания')}</label>
        <textarea value={form[notesKey]} onChange={(e) => set(notesKey, e.target.value)} rows={4}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          placeholder={t('e.g.:\nKenya requires an ETA prior to travel\nBaggage strictly 15kg in soft bags', 'напр.:\nДля Кении требуется ETA до поездки\nБагаж строго 15 кг в мягких сумках')} />
        <p style={hint}>{t('One item per line.', 'По одному пункту в строке.')}</p>
      </div>

      <div style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>
          {t('Terms & Conditions', 'Условия и положения')} <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400, fontSize: '13px' }}>· {lang.toUpperCase()}</span>
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>{t('Payment terms', 'Условия оплаты')}</label>
            <textarea value={form[paymentKey]} onChange={(e) => set(paymentKey, e.target.value)} rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              placeholder={t('e.g.:\n30% — Upon Confirmation\n70% — 45 days before arrival', 'напр.:\n30% — при подтверждении\n70% — за 45 дней до прибытия')} />
            <p style={hint}>{t('One item per line.', 'По одному пункту в строке.')}</p>
          </div>
          <div>
            <label style={labelStyle}>{t('Cancellation policy', 'Политика отмены')}</label>
            <textarea value={form[cancellationKey]} onChange={(e) => set(cancellationKey, e.target.value)} rows={6}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              placeholder={t('e.g.:\nMore than 120 days before arrival — the 20% deposit is refunded...\nLess than 30 days — 100% is forfeited', 'напр.:\nБолее чем за 120 дней до прибытия — депозит 20% возвращается...\nМенее чем за 30 дней — удерживается 100%')} />
            <p style={hint}>{t('One item per line.', 'По одному пункту в строке.')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}