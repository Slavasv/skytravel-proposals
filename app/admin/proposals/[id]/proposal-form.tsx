'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { updateProposal, type ProposalClientOption } from '../../actions'
import ClientPicker from '@/app/admin/_components/client-picker'
import type { Lang } from './edit-page-client'
import ImageUploader from '@/app/admin/_components/image-uploader'
import { useIsMobile } from '@/lib/use-is-mobile'
import CostBreakdown from './cost-breakdown'
import VariantTerms from './variant-terms'
import VariantImpressions from './variant-impressions'
import { useDays } from './days-context'
import type { VariantFull } from './variant-actions'
import HotelsSection from './hotels-section'
import type { Day } from './edit-page-client'

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

type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

const CURRENCIES = ['USD', 'EUR', 'AED', 'GBP']
const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'confirmed', label: 'Confirmed' },
]

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

type Props = {
  proposal: Proposal
  lang: Lang
  onLangChange: (lang: Lang) => void
  actions?: React.ReactNode
  itinerary?: React.ReactNode
  variantSwitcher?: React.ReactNode
  activeVariant?: VariantFull | null
  clients?: ProposalClientOption[]
}

export default function ProposalForm({ proposal, lang, onLangChange, actions, itinerary, variantSwitcher, activeVariant, clients = [] }: Props) {
  const { days } = useDays()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pickedClient = searchParams.get('pickedClient')
  const isMobile = useIsMobile()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    slug: proposal.slug,
    client_name_ru: proposal.client_name_ru || '',
    client_name_en: proposal.client_name_en || '',
    trip_title_ru: proposal.trip_title_ru || '',
    trip_title_en: proposal.trip_title_en || '',
    guest_count: proposal.guest_count ?? 1,
    start_date: proposal.start_date || '',
    end_date: proposal.end_date || '',
    status: proposal.status || 'draft',
    total_price: proposal.total_price ?? '',
    currency: proposal.currency || 'USD',
    cover_image_url: proposal.cover_image_url || '',
    intro_text_ru: proposal.intro_text_ru || '',
    intro_text_en: proposal.intro_text_en || '',
    payment_terms_ru: proposal.payment_terms_ru || '',
    payment_terms_en: proposal.payment_terms_en || '',
    cancellation_policy_ru: proposal.cancellation_policy_ru || '',
    cancellation_policy_en: proposal.cancellation_policy_en || '',
    cost_currency: proposal.cost_currency || 'USD',
    cost_includes_ru: proposal.cost_includes_ru || '',
    cost_includes_en: proposal.cost_includes_en || '',
    cost_excludes_ru: proposal.cost_excludes_ru || '',
    cost_excludes_en: proposal.cost_excludes_en || '',
    cost_notes_ru: proposal.cost_notes_ru || '',
    cost_notes_en: proposal.cost_notes_en || '',
    client_id: proposal.client_id || '',
    layout: proposal.layout || 'full',
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
          slug: currentForm.slug,
          client_name_ru: currentForm.client_name_ru || null,
          client_name_en: currentForm.client_name_en || null,
          trip_title_ru: currentForm.trip_title_ru || null,
          trip_title_en: currentForm.trip_title_en || null,
          guest_count: typeof currentForm.guest_count === 'number'
            ? currentForm.guest_count
            : parseInt(String(currentForm.guest_count)) || null,
          start_date: currentForm.start_date || null,
          end_date: currentForm.end_date || null,
          status: currentForm.status,
          currency: currentForm.currency,
          cover_image_url: currentForm.cover_image_url || null,
          intro_text_ru: currentForm.intro_text_ru || null,
          intro_text_en: currentForm.intro_text_en || null,
          payment_terms_ru: currentForm.payment_terms_ru || null,
          payment_terms_en: currentForm.payment_terms_en || null,
          cancellation_policy_ru: currentForm.cancellation_policy_ru || null,
          cancellation_policy_en: currentForm.cancellation_policy_en || null,
          cost_currency: currentForm.cost_currency || null,
          cost_includes_ru: currentForm.cost_includes_ru || null,
          cost_includes_en: currentForm.cost_includes_en || null,
          cost_excludes_ru: currentForm.cost_excludes_ru || null,
          cost_excludes_en: currentForm.cost_excludes_en || null,
          cost_notes_ru: currentForm.cost_notes_ru || null,
          cost_notes_en: currentForm.cost_notes_en || null,
          client_id: currentForm.client_id || null,
          layout: currentForm.layout,
        })
        setSavedAt(new Date())
        setSaveState('saved')
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Save failed')
        setSaveState('error')
      }
    })()

    inFlight.current = promise
    await promise
    if (inFlight.current === promise) {
      inFlight.current = null
    }
  }

  // вернулись из создания клиента → подставляем его
  useEffect(() => {
    if (pickedClient && pickedClient !== form.client_id) {
      set('client_id', pickedClient)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedClient])

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
    }

    saveTimer.current = setTimeout(() => {
      saveNow(form)
    }, 1500)

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

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
    router.push('/admin')
  }

  const clientKey = lang === 'ru' ? 'client_name_ru' : 'client_name_en'
  const titleKey = lang === 'ru' ? 'trip_title_ru' : 'trip_title_en'
  const introKey = lang === 'ru' ? 'intro_text_ru' : 'intro_text_en'
  const paymentKey = lang === 'ru' ? 'payment_terms_ru' : 'payment_terms_en'
  const cancellationKey = lang === 'ru' ? 'cancellation_policy_ru' : 'cancellation_policy_en'
  const includesKey = lang === 'ru' ? 'cost_includes_ru' : 'cost_includes_en'
  const excludesKey = lang === 'ru' ? 'cost_excludes_ru' : 'cost_excludes_en'
  const costNotesKey = lang === 'ru' ? 'cost_notes_ru' : 'cost_notes_en'

  // Подсказки для строк тарифов: блоки из маршрута, сгруппированные по категории.
  // Дубли по названию убираем. transfer/activity маппятся 1:1, остальные типы (city и пр.) игнорируем.
  
  const titlePlaceholder = lang === 'ru'
    ? 'Например: Путешествие в Прованс для семьи Алиевых'
    : 'e.g.: A Provence Journey for the Aliyev Family'
  const introPlaceholder = lang === 'ru'
    ? 'Короткое описание поездки, которое клиент увидит на первой странице'
    : 'A short description of the trip that the client sees on the first page'
  const clientPlaceholder = lang === 'ru'
    ? 'Например: Семья Алиевых'
    : 'e.g.: The Aliyev Family'

  function renderSaveIndicator() {
    if (saveState === 'error') {
      return <span style={{ color: 'var(--admin-danger)' }}>● Error: {errorMsg}</span>
    }
    if (saveState === 'saving') {
      return <span style={{ color: 'var(--admin-accent)' }}>● Saving...</span>
    }
    if (saveState === 'editing') {
      return <span style={{ color: 'var(--admin-text-muted)' }}>● Editing...</span>
    }
    if (saveState === 'saved' && savedAt) {
      return <span style={{ color: 'var(--admin-success)' }}>● Saved at {savedAt.toLocaleTimeString()}</span>
    }
    return <span style={{ color: 'var(--admin-text-muted)' }}>● All changes saved</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Top bar: language switcher + save indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--admin-border-card)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', fontWeight: 500 }}>
            Editing in
          </span>
          <div style={{ display: 'inline-flex', borderRadius: '999px', overflow: 'hidden', border: '1px solid var(--admin-border)' }}>
            <button
              type="button"
              onClick={() => onLangChange('ru')}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                background: lang === 'ru' ? 'var(--admin-text-on-dark)' : 'transparent',
                color: lang === 'ru' ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              RU
            </button>
            <button
              type="button"
              onClick={() => onLangChange('en')}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                background: lang === 'en' ? 'var(--admin-text-on-dark)' : 'transparent',
                color: lang === 'en' ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              EN
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', fontWeight: 500 }}>
              Layout
            </span>
            <div style={{ display: 'inline-flex', borderRadius: '999px', overflow: 'hidden', border: '1px solid var(--admin-border)' }}>
              <button type="button" onClick={() => set('layout', 'full')}
                style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 500, background: form.layout !== 'hotel' ? 'var(--admin-text-on-dark)' : 'transparent', color: form.layout !== 'hotel' ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Full
              </button>
              <button type="button" onClick={() => set('layout', 'hotel')}
                style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 500, background: form.layout === 'hotel' ? 'var(--admin-text-on-dark)' : 'transparent', color: form.layout === 'hotel' ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Hotel
              </button>
            </div>
          </div>
          <div style={{ fontSize: '12px' }}>
            {renderSaveIndicator()}
          </div>
        </div>
      </div>

      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>
          Client & dates <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400, fontSize: '13px' }}>· {lang.toUpperCase()}</span>
        </h2>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>CRM Client</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <ClientPicker
                clients={clients}
                value={form.client_id}
                onChange={(id) => set('client_id', id)}
                returnTo={`/admin/proposals/${proposal.id}`}
              />
            </div>
            {form.client_id && (
              <button
                type="button"
                onClick={() => {
                  const c = clients.find((x) => x.id === form.client_id)
                  if (c?.name) set(clientKey, c.name)
                }}
                title="Fill the client name field from the CRM client"
                style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--admin-accent)', background: 'transparent', border: '1px solid var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                ↓ Use name
              </button>
            )}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>
            Link this proposal to a CRM client to see it in their history.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Client name</label>
            <input
              type="text"
              value={form[clientKey]}
              onChange={(e) => set(clientKey, e.target.value)}
              style={inputStyle}
              placeholder={clientPlaceholder}
            />
          </div>
          <div>
            <label style={labelStyle}>Guests</label>
            <input
              type="number"
              min={1}
              value={form.guest_count}
              onChange={(e) => set('guest_count', parseInt(e.target.value) || 1)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Start date</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => set('start_date', e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>End date</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => set('end_date', e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>
          Trip details <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400, fontSize: '13px' }}>· {lang.toUpperCase()}</span>
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Trip title</label>
            <input
              type="text"
              value={form[titleKey]}
              onChange={(e) => set(titleKey, e.target.value)}
              style={inputStyle}
              placeholder={titlePlaceholder}
            />
          </div>
          <div>
            <ImageUploader
              value={form.cover_image_url}
              onChange={(url) => set('cover_image_url', url)}
              label="Cover image"
              height={240}
            />
          </div>
          <div>
            <label style={labelStyle}>Intro text</label>
            <textarea
              value={form[introKey]}
              onChange={(e) => set(introKey, e.target.value)}
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              placeholder={introPlaceholder}
            />
          </div>
        </div>
      </section>

      {variantSwitcher && (
        <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>Route variants</h2>
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
            Offer the client several full scenarios. Each variant has its own days, costs and terms.
          </p>
          {variantSwitcher}
        </section>
      )}

      {activeVariant && form.layout !== 'hotel' && (
        <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>Impressions</h2>
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
            Gallery, text and a divider photo shown before the itinerary.
          </p>
          <VariantImpressions key={activeVariant.id} variant={activeVariant} lang={lang} />
        </section>
      )}

      {form.layout === 'hotel' ? (
        <HotelsSection proposalId={proposal.id} lang={lang} />
      ) : (
        itinerary
      )}

      

      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>
          Costs <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400, fontSize: '13px' }}>· {lang.toUpperCase()}</span>
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ maxWidth: '200px' }}>
            <label style={labelStyle}>Currency (for this Costs section)</label>
            <select
              value={form.cost_currency}
              onChange={(e) => set('cost_currency', e.target.value)}
              style={inputStyle}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: '8px', paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '4px' }}>
              Price breakdown
            </div>
            <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
              Breakdown by hotels, transfers and activities. Write the price exactly as in the proposal — we don’t recalculate it.
            </p>
            <CostBreakdown lang={lang} currency={form.cost_currency} onTotalChange={(t) => set('total_price', t)} />
          </div>
          {activeVariant && (
            <div style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
              <VariantTerms key={activeVariant.id} variant={activeVariant} lang={lang} />
            </div>
          )}
        </div>
      </section>

      

      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>Total & status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Total price</label>
            <input
              type="number"
              value={form.total_price}
              readOnly
              style={{ ...inputStyle, background: 'var(--admin-card)', color: 'var(--admin-text-muted)', cursor: 'not-allowed' }}
              placeholder="0"
            />
            <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>
              {`Calculated from the Costs section above · ${form.cost_currency}.`}
            </p>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
              style={inputStyle}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>URL</h2>
        <div>
          <label style={labelStyle}>Slug</label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => set('slug', e.target.value)}
            style={inputStyle}
            placeholder="e.g.: aliyev-provence-jul26"
          />
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>
            Public URL: /p/{form.slug} (RU) · /en/p/{form.slug} (EN)
          </p>
        </div>
      </section>

      <div style={{
        display: 'flex',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: '16px',
        paddingTop: '24px',
        borderTop: '1px solid var(--admin-border-card)',
        flexWrap: 'wrap',
        flexDirection: isMobile ? 'column' : 'row',
      }}>
        <div style={{ width: isMobile ? '100%' : 'auto' }}>{actions}</div>
        <button
          onClick={handleDone}
          disabled={saveState === 'saving'}
          style={{
            padding: '12px 24px',
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
            transition: 'background 0.15s',
            width: isMobile ? '100%' : 'auto',
          }}
          onMouseEnter={(e) => {
            if (saveState !== 'saving') e.currentTarget.style.background = '#FFFFFF'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--admin-text-on-dark)'
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}