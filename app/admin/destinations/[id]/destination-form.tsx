'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n-client'
import { updateProposal } from '@/app/admin/actions'
import ImageUploader from '@/app/admin/_components/image-uploader'
import CostLines, { type CostLine } from '@/app/admin/proposals/[id]/cost-lines'
import SectionList from './section-list'
import type { DestinationSection } from './destination-actions'
import ProposalActions from '@/app/admin/proposals/[id]/proposal-actions'

type Lang = 'ru' | 'en'
type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

type Proposal = {
  id: string
  slug: string
  trip_title_ru: string | null
  trip_title_en: string | null
  season_ru: string | null
  season_en: string | null
  tagline_ru: string | null
  tagline_en: string | null
  cover_image_url: string | null
  intro_text_ru: string | null
  intro_text_en: string | null
  cost_currency: string | null
  cost_includes_ru: string | null
  cost_includes_en: string | null
  cost_excludes_ru: string | null
  cost_excludes_en: string | null
  cost_notes_ru: string | null
  cost_notes_en: string | null
  cost_lines: CostLine[] | null
  total_price: number | null
  price_from: boolean | null
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--admin-text-muted)',
  marginBottom: '6px',
  fontWeight: 500,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '14px',
  color: 'var(--admin-text)',
  background: 'var(--admin-input)',
  border: '1px solid var(--admin-border)',
  borderRadius: '6px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'CHF' , 'UAH']

export default function DestinationForm({ proposal, sections }: { proposal: Proposal; sections: DestinationSection[] }) {
  const router = useRouter()
  const t = useT()
  const [lang, setLang] = useState<Lang>('ru')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    trip_title_ru: proposal.trip_title_ru || '',
    trip_title_en: proposal.trip_title_en || '',
    season_ru: proposal.season_ru || '',
    season_en: proposal.season_en || '',
    tagline_ru: proposal.tagline_ru || '',
    tagline_en: proposal.tagline_en || '',
    cover_image_url: proposal.cover_image_url || '',
    intro_text_ru: proposal.intro_text_ru || '',
    intro_text_en: proposal.intro_text_en || '',
    cost_currency: proposal.cost_currency || 'USD',
    cost_includes_ru: proposal.cost_includes_ru || '',
    cost_includes_en: proposal.cost_includes_en || '',
    cost_excludes_ru: proposal.cost_excludes_ru || '',
    cost_excludes_en: proposal.cost_excludes_en || '',
    cost_notes_ru: proposal.cost_notes_ru || '',
    cost_notes_en: proposal.cost_notes_en || '',
    cost_lines: (proposal.cost_lines ?? []) as CostLine[],
    total_price: proposal.total_price?.toString() ?? '',
    price_from: proposal.price_from ?? true,
  })

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialMount = useRef(true)
  const inFlight = useRef<Promise<void> | null>(null)

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaveState('editing')
  }

  async function saveNow(currentForm: typeof form) {
    setSaveState('saving')
    setErrorMsg(null)
    const promise = (async () => {
      try {
        await updateProposal(proposal.id, {
          trip_title_ru: currentForm.trip_title_ru || null,
          trip_title_en: currentForm.trip_title_en || null,
          season_ru: currentForm.season_ru || null,
          season_en: currentForm.season_en || null,
          tagline_ru: currentForm.tagline_ru || null,
          tagline_en: currentForm.tagline_en || null,
          cover_image_url: currentForm.cover_image_url || null,
          intro_text_ru: currentForm.intro_text_ru || null,
          intro_text_en: currentForm.intro_text_en || null,
          cost_currency: currentForm.cost_currency || null,
          cost_includes_ru: currentForm.cost_includes_ru || null,
          cost_includes_en: currentForm.cost_includes_en || null,
          cost_excludes_ru: currentForm.cost_excludes_ru || null,
          cost_excludes_en: currentForm.cost_excludes_en || null,
          cost_notes_ru: currentForm.cost_notes_ru || null,
          cost_notes_en: currentForm.cost_notes_en || null,
          cost_lines: currentForm.cost_lines,
          total_price: (() => {
            const cleaned = String(currentForm.total_price).replace(/[^\d.]/g, '')
            return cleaned === '' ? null : Number(cleaned)
          })(),
          price_from: currentForm.price_from,
        })
        setSavedAt(new Date())
        setSaveState('saved')
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : t('Save failed', 'Ошибка сохранения'))
        setSaveState('error')
      }
    })()
    inFlight.current = promise
    await promise
    if (inFlight.current === promise) inFlight.current = null
  }

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { saveNow(form) }, 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  const titleKey = lang === 'ru' ? 'trip_title_ru' : 'trip_title_en'
  const seasonKey = lang === 'ru' ? 'season_ru' : 'season_en'
  const taglineKey = lang === 'ru' ? 'tagline_ru' : 'tagline_en'
  const introKey = lang === 'ru' ? 'intro_text_ru' : 'intro_text_en'
  const includesKey = lang === 'ru' ? 'cost_includes_ru' : 'cost_includes_en'
  const excludesKey = lang === 'ru' ? 'cost_excludes_ru' : 'cost_excludes_en'
  const notesKey = lang === 'ru' ? 'cost_notes_ru' : 'cost_notes_en'

  async function handleDone() {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    if (saveState === 'editing' || saveState === 'error') {
      await saveNow(form)
    }
    if (inFlight.current) {
      await inFlight.current
    }
    router.push('/admin/destinations')
  }

  function renderSaveIndicator() {
    if (saveState === 'error') return <span style={{ color: 'var(--admin-danger)' }}>● {t('Error', 'Ошибка')}: {errorMsg}</span>
    if (saveState === 'saving') return <span style={{ color: 'var(--admin-accent)' }}>● {t('Saving...', 'Сохранение...')}</span>
    if (saveState === 'editing') return <span style={{ color: 'var(--admin-text-muted)' }}>● {t('Editing...', 'Редактирование...')}</span>
    if (saveState === 'saved' && savedAt) return <span style={{ color: 'var(--admin-success)' }}>● {t('Saved at', 'Сохранено в')} {savedAt.toLocaleTimeString()}</span>
    return <span style={{ color: 'var(--admin-text-muted)' }}>● {t('All changes saved', 'Все изменения сохранены')}</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top bar: language + save */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--admin-border-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', fontWeight: 500 }}>{t('Editing in', 'Редактирование на')}</span>
          <div style={{ display: 'inline-flex', borderRadius: '999px', overflow: 'hidden', border: '1px solid var(--admin-border)' }}>
            {(['ru', 'en'] as const).map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)}
                style={{
                  padding: '6px 14px', fontSize: '13px', fontWeight: 500,
                  background: lang === l ? 'var(--admin-text-on-dark)' : 'transparent',
                  color: lang === l ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: '12px' }}>{renderSaveIndicator()}</div>
      </div>

      {/* COVER */}
      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>
          {t('Cover', 'Обложка')} <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400, fontSize: '13px' }}>· {lang.toUpperCase()}</span>
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>{t('Destination title', 'Название направления')}</label>
            <input type="text" value={form[titleKey]} onChange={(e) => set(titleKey, e.target.value)} style={inputStyle} placeholder={lang === 'ru' ? 'Например: Африка, Кения' : 'e.g.: Africa, Kenya'} />
          </div>
          <div>
            <label style={labelStyle}>{t('Season', 'Сезон')}</label>
            <input type="text" value={form[seasonKey]} onChange={(e) => set(seasonKey, e.target.value)} style={inputStyle} placeholder={lang === 'ru' ? 'Например: Октябрь 2026 · Май–Июнь · Круглый год' : 'e.g.: October 2026 · May–June · Year-round'} />
          </div>
          <div>
            <label style={labelStyle}>{t('Tagline', 'Слоган')}</label>
            <input type="text" value={form[taglineKey]} onChange={(e) => set(taglineKey, e.target.value)} style={inputStyle} placeholder={lang === 'ru' ? 'Слоган бренда' : 'For people who celebrate life'} />
          </div>
          <div>
            <ImageUploader value={form.cover_image_url} onChange={(url) => set('cover_image_url', url)} label={t('Cover image', 'Изображение обложки')} height={200} />
          </div>
          <div>
            <label style={labelStyle}>{t('Intro text', 'Вступительный текст')}</label>
            <textarea value={form[introKey]} onChange={(e) => set(introKey, e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder={lang === 'ru' ? 'Вводный текст о направлении...' : 'Intro text about the destination...'} />
          </div>
        </div>
      </section>

      {/* SECTIONS */}
      <div style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <SectionList proposalId={proposal.id} initialSections={sections} lang={lang} />
      </div>

      {/* COSTS (last — filled last) */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>{t('Costs', 'Стоимость')}</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>{t('Pricing for this destination. Required.', 'Стоимость этого направления. Обязательно.')}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>{t('Currency', 'Валюта')}</label>
              <select value={form.cost_currency} onChange={(e) => set('cost_currency', e.target.value)} style={inputStyle}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>{t('Total price', 'Итоговая цена')}</label>
              <input type="text" value={form.total_price} onChange={(e) => set('total_price', e.target.value)} style={inputStyle} placeholder="42870" />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--admin-text)' }}>
            <input type="checkbox" checked={form.price_from} onChange={(e) => set('price_from', e.target.checked)} />
            {t('Show price as "from X"', 'Показывать цену как «от X»')}
          </label>

          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '4px' }}>{t('Price breakdown', 'Детализация стоимости')}</div>
            <CostLines lines={form.cost_lines} lang={lang} onChange={(lines) => set('cost_lines', lines)} />
          </div>

          <div>
            <label style={labelStyle}>{t('This cost includes', 'В стоимость входит')} · {lang.toUpperCase()}</label>
            <textarea value={form[includesKey]} onChange={(e) => set(includesKey, e.target.value)} rows={5} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder={'e.g.:\nAirport transfers\n2 nights at Four Seasons'} />
            <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>{t('One item per line.', 'По одному пункту на строку.')}</p>
          </div>
          <div>
            <label style={labelStyle}>{t('This cost does not include', 'В стоимость не входит')} · {lang.toUpperCase()}</label>
            <textarea value={form[excludesKey]} onChange={(e) => set(excludesKey, e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder={'e.g.:\nInternational flights\nVisas'} />
            <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>{t('One item per line.', 'По одному пункту на строку.')}</p>
          </div>
          <div>
            <label style={labelStyle}>{t('Notes', 'Примечания')} · {lang.toUpperCase()}</label>
            <textarea value={form[notesKey]} onChange={(e) => set(notesKey, e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder={'e.g.:\nKenya requires an ETA prior to travel'} />
            <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>{t('One item per line.', 'По одному пункту на строку.')}</p>
          </div>
        </div>
      </section>

      {/* Preview / share + Done */}
      <div style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <ProposalActions slug={proposal.slug} kind="destination" />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleDone}
            disabled={saveState === 'saving'}
            style={{
              padding: '10px 24px',
              fontSize: '13px',
              fontWeight: 500,
              letterSpacing: '0.03em',
              background: 'var(--admin-text-on-dark)',
              color: 'var(--admin-dark-panel)',
              border: 'none',
              borderRadius: '8px',
              cursor: saveState === 'saving' ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              opacity: saveState === 'saving' ? 0.6 : 1,
            }}
          >
            {t('Done', 'Готово')}
          </button>
        </div>
      </div>
    </div>
  )
}