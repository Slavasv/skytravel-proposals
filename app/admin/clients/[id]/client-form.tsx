'use client'

// стрелка ▶ поворачивается вниз, когда details открыт
const collapseCss = `.cl-collapse[open] .cl-arrow { transform: rotate(90deg); } .cl-collapse summary::-webkit-details-marker { display: none; }`

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n-client'
import {
  updateClient, ensurePrimaryTraveller,
  type Traveller, type ClientRequest,
} from '../actions'
import ClientTravellers from './client-travellers'
import ClientHistory from './client-history'

type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

type Client = {
  id: string
  name: string | null
  client_code: string | null
  client_type: string | null
  client_status: string | null
  lead_source: string | null
  countries: string[] | null
  phone: string | null
  email: string | null
  balance_usd: number | null
  balance_eur: number | null
  notes: string | null
}

const CLIENT_TYPES = [
  { value: 'individual', label: 'Individual', ru: 'Физическое лицо' },
  { value: 'family', label: 'Family', ru: 'Семья' },
  { value: 'company', label: 'Company', ru: 'Компания' },
]

const CLIENT_STATUSES = [
  { value: 'new', label: 'New', ru: 'Новый' },
  { value: 'regular', label: 'Regular', ru: 'Постоянный' },
]

// подсказки источников (можно вписать своё)
const LEAD_SOURCES = [
  'Personal Encounter',
  'Referral',
  'Instagram',
  'Website',
  'Recommendation',
]

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', marginBottom: '6px', fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: '14px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

export default function ClientForm({
  client, travellers, requests = [], returnTo,
}: {
  client: Client
  travellers: Traveller[]
  requests?: ClientRequest[]
  returnTo?: string
}) {
  const t = useT()
  const router = useRouter()
  const [travellerList, setTravellerList] = useState<Traveller[]>(travellers)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: client.name || '',
    client_code: client.client_code || '',
    client_type: client.client_type || 'individual',
    client_status: client.client_status || 'new',
    lead_source: client.lead_source || '',
    countries: (client.countries || []).join(', '),
    phone: client.phone || '',
    email: client.email || '',
    balance_usd: client.balance_usd != null ? String(client.balance_usd) : '0',
    balance_eur: client.balance_eur != null ? String(client.balance_eur) : '0',
    notes: client.notes || '',
  })

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaveState('editing')
  }

  async function saveNow(current: typeof form) {
    setSaveState('saving')
    setErrorMsg(null)
    try {
      await updateClient(client.id, {
        name: current.name,
        client_code: current.client_code || null,
        client_type: current.client_type,
        client_status: current.client_status,
        lead_source: current.lead_source || null,
        // "UAE, Austria" → ['UAE', 'Austria']
        countries: current.countries
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        phone: current.phone || null,
        email: current.email || null,
        balance_usd: current.balance_usd ? parseFloat(current.balance_usd) : 0,
        balance_eur: current.balance_eur ? parseFloat(current.balance_eur) : 0,
        notes: current.notes || null,
      })
      setSavedAt(new Date())
      setSaveState('saved')

      // Для individual-клиента заводим traveller-«себя», если его ещё нет
      if (current.client_type === 'individual' && current.name.trim()) {
        const created = await ensurePrimaryTraveller(client.id)
        if (created) {
          setTravellerList((prev) => (prev.length === 0 ? [created] : prev))
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('Save failed', 'Не удалось сохранить'))
      setSaveState('error')
    }
  }

  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveNow(form), 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  // Сохраняем немедленно (не ждём автосейв) и возвращаемся.
  // Если пришли из ваучера/предложения (returnTo) — вернёмся туда с выбранным клиентом.
  async function handleDone() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (saveState === 'editing' || saveState === 'error') {
      await saveNow(form)
    }
    if (returnTo) {
      const sep = returnTo.includes('?') ? '&' : '?'
      router.push(`${returnTo}${sep}pickedClient=${client.id}`)
    } else {
      router.push('/admin/clients')
    }
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '16px', borderBottom: '1px solid var(--admin-border-card)', fontSize: '12px' }}>
        {renderSaveIndicator()}
      </div>

      {/* ОСНОВНОЕ */}
      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>{t('Client details', 'Данные клиента')}</h2>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <label style={labelStyle}>{t('Name', 'Имя')}</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} style={inputStyle} placeholder="The Pertsev Family" />
          </div>
          <div style={{ width: '140px' }}>
            <label style={labelStyle}>{t('Client code', 'Код клиента')}</label>
            <input type="text" value={form.client_code} onChange={(e) => set('client_code', e.target.value)} style={inputStyle} placeholder="CL-001" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={labelStyle}>{t('Type', 'Тип')}</label>
            <select value={form.client_type} onChange={(e) => set('client_type', e.target.value)} style={inputStyle}>
              {CLIENT_TYPES.map((tx) => <option key={tx.value} value={tx.value}>{t(tx.label, tx.ru)}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={labelStyle}>{t('Status', 'Статус')}</label>
            <select value={form.client_status} onChange={(e) => set('client_status', e.target.value)} style={inputStyle}>
              {CLIENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{t(s.label, s.ru)}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={labelStyle}>{t('Lead source', 'Источник')}</label>
            <input type="text" list="lead-source-options" value={form.lead_source} onChange={(e) => set('lead_source', e.target.value)} style={inputStyle} placeholder={t('Select or type...', 'Выберите или введите...')} />
            <datalist id="lead-source-options">
              {LEAD_SOURCES.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        </div>
      </section>

      {/* КОНТАКТЫ */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>{t('Contacts', 'Контакты')}</h2>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={labelStyle}>{t('Phone', 'Телефон')}</label>
            <input type="text" value={form.phone} onChange={(e) => set('phone', e.target.value)} style={inputStyle} placeholder="+971 50 123 4567" />
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={labelStyle}>{t('Email', 'Email')}</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} style={inputStyle} placeholder="client@example.com" />
          </div>
        </div>
        <div>
          <label style={labelStyle}>{t('Countries', 'Страны')}</label>
          <input type="text" value={form.countries} onChange={(e) => set('countries', e.target.value)} style={inputStyle} placeholder="UAE, Austria" />
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>
            {t('Separate multiple countries with commas.', 'Разделяйте страны запятыми.')}
          </p>
        </div>
      </section>

      {/* ФИНАНСЫ */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>{t('Balance', 'Баланс')}</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
          {t('Manual for now. Will be linked to bookings later.', 'Пока вручную. Позже будет связан с бронированиями.')}
        </p>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={labelStyle}>{t('Balance USD', 'Баланс USD')}</label>
            <input type="number" step="0.01" value={form.balance_usd} onChange={(e) => set('balance_usd', e.target.value)} style={inputStyle} placeholder="0" />
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <label style={labelStyle}>{t('Balance EUR', 'Баланс EUR')}</label>
            <input type="number" step="0.01" value={form.balance_eur} onChange={(e) => set('balance_eur', e.target.value)} style={inputStyle} placeholder="0" />
          </div>
        </div>
      </section>

      {/* TRAVELLERS */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <details className="cl-collapse">
          <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="cl-arrow" style={{ fontSize: '11px', color: 'var(--admin-text-muted)', transition: 'transform 0.15s' }}>▶</span>
            <h2 style={{ fontSize: '15px', fontWeight: 500, margin: 0, color: 'var(--admin-text)' }}>{t('Travellers', 'Путешественники')}</h2>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>· {travellerList.length}</span>
          </summary>
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '10px 0 16px' }}>
            {t('People who actually travel. Drag to reorder. These will be pulled into vouchers automatically.', 'Те, кто действительно путешествует. Перетаскивайте для изменения порядка. Они будут автоматически добавлены в ваучеры.')}
          </p>
          <ClientTravellers clientId={client.id} initialTravellers={travellerList} key={travellerList.length} />
        </details>
      </section>

      <style dangerouslySetInnerHTML={{ __html: collapseCss }} />

      {/* HISTORY */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <details open className="cl-collapse">
          <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="cl-arrow" style={{ fontSize: '11px', color: 'var(--admin-text-muted)', transition: 'transform 0.15s' }}>▶</span>
            <h2 style={{ fontSize: '15px', fontWeight: 500, margin: 0, color: 'var(--admin-text)' }}>{t('History', 'История')}</h2>
          </summary>
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '10px 0 16px' }}>
            {t('Everything linked to this client.', 'Всё, что связано с этим клиентом.')}
          </p>
          <ClientHistory requests={requests} />
        </details>
      </section>

      {/* ЗАМЕТКИ */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 12px', color: 'var(--admin-text)' }}>{t('Notes', 'Заметки')}</h2>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder={t('Any additional notes about this client...', 'Любые дополнительные заметки об этом клиенте...')} />
      </section>

      {/* DONE */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={handleDone}
          disabled={saveState === 'saving'}
          style={{
            padding: '10px 24px', fontSize: '13px', fontWeight: 500, letterSpacing: '0.03em',
            background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)',
            border: 'none', borderRadius: '8px',
            cursor: saveState === 'saving' ? 'wait' : 'pointer', fontFamily: 'inherit',
            opacity: saveState === 'saving' ? 0.6 : 1,
          }}
        >
          {saveState === 'saving' ? t('Saving…', 'Сохранение…') : (returnTo ? t('Done & back', 'Готово и назад') : t('Done', 'Готово'))}
        </button>
      </section>
    </div>
  )
}