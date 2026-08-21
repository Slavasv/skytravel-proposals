'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useT } from '@/lib/i18n-client'
import {
  createProposalFromRequest, detachProposalFromRequest,
  selectDestination, unselectDestination, approveProposal, unapproveProposal,
  type RequestClientOption, type LinkedProposal, type DestinationOption,
} from '../actions'
import { createBookingFromRequest, type RequestBooking } from '@/app/admin/bookings/actions'
import RequestTravellers from './request-travellers'
import AttachDestination from './attach-destination'
import ClientPicker from '@/app/admin/_components/client-picker'
import RequestDestinations from './request-destinations'
import type { RequestDestination } from '../destinations-actions'

type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

type RequestRow = {
  id: string
  request_code: string | null
  client_id: string | null
  destination: string | null
  details: string | null
  status: string | null
  priority: string | null
  closed_at: string | null
  created_at: string
  cancel_reason: string | null
  cancel_note: string | null
  client_notes: string | null
  agent_notes: string | null
  trip_rating: number | null
  trip_feedback: string | null
  traveller_ids: string[] | null
  trip_start: string | null
  trip_end: string | null
}

// value хранится в БД (не переводим), en/ru — подпись
const STATUSES: { value: string; en: string; ru: string }[] = [
  { value: 'new', en: 'New Request', ru: 'Новая заявка' },
  { value: 'clients_review', en: 'Client review', ru: 'На согласовании у клиента' },
  { value: 'preparing', en: 'Preparing proposal', ru: 'Готовим предложение' },
  { value: 'proposal_sent', en: 'Proposal sent', ru: 'Предложение отправлено' },
  { value: 'revising', en: 'Revising proposal', ru: 'Дорабатываем предложение' },
  { value: 'booking', en: 'Booking in progress', ru: 'В процессе бронирования' },
  { value: 'confirmed', en: 'Confirmed', ru: 'Подтверждена' },
  { value: 'cancelled', en: 'Cancelled', ru: 'Отменена' },
]

const PRIORITIES = ['Low', 'Medium', 'High']
const CLOSING = ['confirmed', 'cancelled']

const CANCEL_REASONS: { value: string; en: string; ru: string }[] = [
  { value: 'Too expensive', en: 'Too expensive', ru: 'Слишком дорого' },
  { value: 'Chose another agency', en: 'Chose another agency', ru: 'Выбрали другое агентство' },
  { value: 'Changed travel plans', en: 'Changed travel plans', ru: 'Изменились планы на поездку' },
  { value: 'Dates / hotel did not fit', en: 'Dates / hotel did not fit', ru: 'Не подошли даты / отель' },
  { value: 'No response from client', en: 'No response from client', ru: 'Клиент не отвечает' },
  { value: 'Other', en: 'Other', ru: 'Другое' },
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

export default function RequestForm({
  request, clients, destinations, linked = [], availableDestinations = [], bookings = [],
}: {
  request: RequestRow
  clients: RequestClientOption[]
  destinations: RequestDestination[]
  linked?: LinkedProposal[]
  availableDestinations?: DestinationOption[]
  bookings?: RequestBooking[]
}) {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pickedClient = searchParams.get('pickedClient')

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [closedAt, setClosedAt] = useState<string | null>(request.closed_at)

  const [form, setForm] = useState({
    client_id: request.client_id || '',
    destination: request.destination || '',
    details: request.details || '',
    status: request.status || 'new',
    priority: request.priority || '',
    cancel_reason: request.cancel_reason || '',
    cancel_note: request.cancel_note || '',
    client_notes: request.client_notes || '',
    agent_notes: request.agent_notes || '',
    trip_rating: request.trip_rating ?? 0,
    trip_feedback: request.trip_feedback || '',
    trip_start: request.trip_start || '',
    trip_end: request.trip_end || '',
  })

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)

  const priorityLabel = (p: string) =>
    p === 'Low' ? t('Low', 'Низкий') : p === 'Medium' ? t('Medium', 'Средний') : p === 'High' ? t('High', 'Высокий') : p

  function daysBetween(from: string, to: string): string {
    const a = new Date(from), b = new Date(to)
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return ''
    const diff = Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
    if (diff === 0) return t('closed same day', 'закрыта в тот же день')
    if (diff === 1) return t('closed in 1 day', 'закрыта за 1 день')
    return t(`closed in ${diff} days`, `закрыта за ${diff} дн.`)
  }

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaveState('editing')
  }

  async function saveNow(current: typeof form) {
    setSaveState('saving')
    setErrorMsg(null)
    try {
      // сохраняем через обычный API-роут (стабильный URL /api/requests/[id]),
      // а НЕ через серверный экшен — у экшенов зашифрованные ID расходятся между
      // сборками при деплое и дают «Server Action not found». У роута URL постоянный.
      const res = await fetch(`/api/requests/${request.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: current.client_id || null,
          destination: current.destination || null,
          details: current.details || null,
          status: current.status,
          priority: current.priority || null,
          cancel_reason: current.status === 'cancelled' ? (current.cancel_reason || null) : null,
          cancel_note: current.status === 'cancelled' ? (current.cancel_note || null) : null,
          client_notes: current.client_notes || null,
          agent_notes: current.agent_notes || null,
          trip_rating: current.trip_rating > 0 ? current.trip_rating : null,
          trip_feedback: current.trip_feedback || null,
          trip_start: current.trip_start || null,
          trip_end: current.trip_end || null,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      if (CLOSING.includes(current.status)) {
        setClosedAt((prev) => prev || new Date().toISOString())
      } else {
        setClosedAt(null)
      }
      setSavedAt(new Date())
      setSaveState('saved')
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

  useEffect(() => {
    if (pickedClient && pickedClient !== form.client_id) {
      set('client_id', pickedClient)
      // убираем pickedClient из URL сразу после применения,
      // иначе при рефреше/повторном падении автосейва эффект
      // будет бесконечно пытаться применить его заново
      const url = new URL(window.location.href)
      url.searchParams.delete('pickedClient')
      router.replace(`${url.pathname}${url.search}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedClient])

  function renderSaveIndicator() {
    if (saveState === 'error') return <span style={{ color: 'var(--admin-danger)' }}>● {t('Error', 'Ошибка')}: {errorMsg}</span>
    if (saveState === 'saving') return <span style={{ color: 'var(--admin-accent)' }}>● {t('Saving...', 'Сохранение...')}</span>
    if (saveState === 'editing') return <span style={{ color: 'var(--admin-text-muted)' }}>● {t('Editing...', 'Редактирование...')}</span>
    if (saveState === 'saved' && savedAt) return <span style={{ color: 'var(--admin-success)' }}>● {t('Saved at', 'Сохранено в')} {savedAt.toLocaleTimeString()}</span>
    return <span style={{ color: 'var(--admin-text-muted)' }}>● {t('All changes saved', 'Все изменения сохранены')}</span>
  }

  async function handleDone() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (saveState === 'editing' || saveState === 'error') await saveNow(form)
    router.push('/admin/requests')
  }

  const isConfirmed = form.status === 'confirmed'
  // бронь заводим уже на этапе бронирования, не дожидаясь Confirmed
  const hasApprovedProposal = linked.some((p) => p.kind !== 'destination' && p.status === 'confirmed')
  const canBook = form.status === 'booking' || form.status === 'confirmed' || hasApprovedProposal

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--admin-border-card)', fontSize: '12px' }}>
        <span style={{ color: 'var(--admin-text-muted)' }}>
          {t('Created', 'Создана')} {new Date(request.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          {closedAt && (
            <span style={{ color: 'var(--admin-success)' }}> · {daysBetween(request.created_at, closedAt)}</span>
          )}
        </span>
        {renderSaveIndicator()}
      </div>

      <section>
        <label style={labelStyle}>{t('Client', 'Клиент')}</label>
        <ClientPicker
          clients={clients}
          value={form.client_id}
          onChange={(id) => set('client_id', id)}
          returnTo={`/admin/requests/${request.id}`}
        />
      </section>

      <section style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>{t('Status', 'Статус')}</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)} style={inputStyle}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{t(s.en, s.ru)}</option>)}
          </select>
        </div>
        <div style={{ width: '140px' }}>
          <label style={labelStyle}>{t('Priority', 'Приоритет')}</label>
          <select value={form.priority} onChange={(e) => set('priority', e.target.value)} style={inputStyle}>
            <option value="">—</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{priorityLabel(p)}</option>)}
          </select>
        </div>
      </section>


      {/* КТО ЕДЕТ */}
      <section>
        <label style={labelStyle}>{t('Travellers', 'Путешественники')}</label>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 10px' }}>
          {t("Who's going on this trip. You can change this later at any stage.",
            'Кто едет в эту поездку. Состав можно изменить позже на любом этапе.')}
        </p>
        <RequestTravellers
          requestId={request.id}
          clientId={form.client_id}
          initialIds={request.traveller_ids ?? []}
          tripStart={form.trip_start}
          tripEnd={form.trip_end}
        />
      </section>

      {/* ДАТЫ ПОЕЗДКИ */}
      <section>
        <label style={labelStyle}>{t('Trip dates', 'Даты поездки')}</label>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 10px' }}>
          {t("When the client wants to travel. Approximate is fine — estimate if they're not sure.",
            'Когда клиент хочет поехать. Ориентировочно тоже подойдёт — прикиньте, если он не уверен.')}
        </p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ width: '170px' }}>
            <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', display: 'block', marginBottom: '4px' }}>{t('From', 'С')}</span>
            <input type="date" value={form.trip_start} onChange={(e) => set('trip_start', e.target.value)} style={inputStyle} />
          </div>
          <div style={{ width: '170px' }}>
            <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', display: 'block', marginBottom: '4px' }}>{t('To', 'По')}</span>
            <input type="date" value={form.trip_end} onChange={(e) => set('trip_end', e.target.value)} style={inputStyle} />
          </div>
          {(() => {
            if (!form.trip_start) return null
            const start = new Date(form.trip_start)
            if (isNaN(start.getTime())) return null
            const now = new Date()
            now.setHours(0, 0, 0, 0)
            const days = Math.round((start.getTime() - now.getTime()) / 86400000)
            let label = ''
            if (days < 0) label = t('in the past', 'в прошлом')
            else if (days === 0) label = t('today', 'сегодня')
            else if (days < 31) label = t(`in ${days} ${days === 1 ? 'day' : 'days'}`, `через ${days} дн.`)
            else {
              const months = Math.round(days / 30)
              label = t(`in ~${months} ${months === 1 ? 'month' : 'months'}`, `через ~${months} мес.`)
            }
            return (
              <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', paddingBottom: '10px' }}>
                {t('Trip', 'Поездка')} {label}
              </span>
            )
          })()}
        </div>
      </section>

      {/* НАПРАВЛЕНИЯ */}
      <section>
        <label style={labelStyle}>{t('Destinations', 'Направления')}</label>
        <RequestDestinations requestId={request.id} initial={destinations} />
      </section>

      <section>
        <label style={labelStyle}>{t('Request details', 'Детали заявки')}</label>
        <textarea value={form.details} onChange={(e) => set('details', e.target.value)} rows={8} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder={t('Dates, hotels, transfers, special requirements, budget...', 'Даты, отели, трансферы, особые пожелания, бюджет...')} />
      </section>

      {/* ПРИЧИНА ОТМЕНЫ — только для cancelled */}
      {form.status === 'cancelled' && (
        <section style={{ padding: '16px', border: '1px solid var(--admin-danger)', borderRadius: '10px' }}>
          <label style={labelStyle}>{t('Why was it cancelled?', 'Почему отменена?')}</label>
          <select value={form.cancel_reason} onChange={(e) => set('cancel_reason', e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }}>
            <option value="">{t('— Select a reason —', '— Выберите причину —')}</option>
            {CANCEL_REASONS.map((r) => <option key={r.value} value={r.value}>{t(r.en, r.ru)}</option>)}
          </select>
          <textarea value={form.cancel_note} onChange={(e) => set('cancel_note', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder={t('Details (optional)', 'Детали (необязательно)')} />
        </section>
      )}

      {/* NEXT STEP — дестинейшены и предложения */}
      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
        <label style={labelStyle}>{t('Next step', 'Следующий шаг')}</label>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: linked.length > 0 ? '14px' : '0' }}>
          <AttachDestination
            requestId={request.id}
            options={availableDestinations}
            attachedIds={linked.filter((p) => p.kind === 'destination').map((p) => p.id)}
          />
          <form action={createProposalFromRequest.bind(null, request.id)}>
            <button type="submit"
              style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
              {t('+ Create proposal', '+ Создать предложение')}
            </button>
          </form>
        </div>

        {linked.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...linked].sort((a, b) => {
              const aDest = a.kind === 'destination' ? 0 : 1
              const bDest = b.kind === 'destination' ? 0 : 1
              return aDest - bDest
            }).map((p, idx, arr) => {
              const prevWasDest = idx > 0 && arr[idx - 1].kind === 'destination'
              const isFirstProposal = p.kind !== 'destination' && prevWasDest
              const isDest = p.kind === 'destination'
              const title = p.trip_title_ru || p.trip_title_en || (isDest ? t('Untitled destination', 'Направление без названия') : t('Untitled proposal', 'Предложение без названия'))
              const href = isDest ? `/admin/destinations/${p.id}` : `/admin/proposals/${p.id}`
              return (
                <a key={p.id} href={href}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: p.is_selected ? '1px solid var(--admin-success)' : '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-card)', textDecoration: 'none', color: 'inherit', marginTop: isFirstProposal ? '16px' : '0', borderTop: isFirstProposal ? '1px solid var(--admin-border-card)' : undefined, paddingTop: isFirstProposal ? '20px' : '12px' }}>
                  <span style={{ fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border-card)', borderRadius: '4px', padding: '2px 6px', flexShrink: 0 }}>
                    {isDest ? t('Destination', 'Направление') : t('Proposal', 'Предложение')}
                  </span>
                  <span style={{ fontSize: '14px', color: 'var(--admin-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {title}
                  </span>
                  {p.last_viewed_at && (
                    <span style={{ fontSize: '11px', color: 'var(--admin-success)', flexShrink: 0 }}>● {t('opened', 'открыто')}</span>
                  )}
                  {isDest ? (
                    p.is_selected ? (
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); unselectDestination(request.id, p.id) }} title={t('Client changed their mind', 'Клиент передумал')} style={{ background: 'var(--admin-success)', border: 'none', color: 'var(--admin-dark-panel)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', padding: '3px 9px', flexShrink: 0, fontFamily: 'inherit', fontWeight: 500 }}>✓ {t('Chosen', 'Выбрано')}</button>
                    ) : (
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); selectDestination(request.id, p.id) }} title={t('Client picked this destination', 'Клиент выбрал это направление')} style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-text-muted)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', padding: '3px 9px', flexShrink: 0, fontFamily: 'inherit' }}>{t('Client picked', 'Клиент выбрал')}</button>
                    )
                  ) : null}
                  {!isDest && (
                    p.status === 'confirmed' ? (
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); unapproveProposal(request.id, p.id) }} title={t('Undo approval', 'Отменить подтверждение')} style={{ background: 'var(--admin-success)', border: 'none', color: 'var(--admin-dark-panel)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', padding: '3px 9px', flexShrink: 0, fontFamily: 'inherit', fontWeight: 500 }}>✓ {t('Approved', 'Подтверждено')}</button>
                    ) : (
                      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); approveProposal(request.id, p.id) }} title={t('Client approved — data can go to a booking', 'Клиент согласовал — данные можно передать в бронь')} style={{ background: 'transparent', border: '1px solid var(--admin-accent)', color: 'var(--admin-accent)', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', padding: '3px 9px', flexShrink: 0, fontFamily: 'inherit' }}>{t('Approve', 'Согласовать')}</button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      if (!confirm(t('Unlink from this request?', 'Отвязать от этой заявки?'))) return
                      detachProposalFromRequest(request.id, p.id)
                    }}
                    title={t('Unlink', 'Отвязать')}
                    style={{ background: 'transparent', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', fontSize: '15px', lineHeight: 1, padding: '0 2px', flexShrink: 0, fontFamily: 'inherit' }}>
                    ×
                  </button>
                </a>
              )
            })}
          </div>
        )}
      </section>

      {/* ЗАМЕТКИ */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={labelStyle}>{t('Client notes & revisions', 'Заметки клиента и правки')}</label>
          <textarea value={form.client_notes} onChange={(e) => set('client_notes', e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder={t('What the client asked to change, their reactions, preferences...', 'Что клиент просил изменить, его реакции, предпочтения...')} />
        </div>
        <div>
          <label style={labelStyle}>{t('Agent notes (internal)', 'Заметки агента (внутренние)')}</label>
          <textarea value={form.agent_notes} onChange={(e) => set('agent_notes', e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder={t('Your own notes — not shown to the client', 'Ваши заметки — клиент их не видит')} />
        </div>
      </section>

      {/* ФИДБЕК ПОСЛЕ ПОЕЗДКИ — для подтверждённых */}
      {form.status === 'confirmed' && (
        <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
          <label style={labelStyle}>{t('After the trip', 'После поездки')}</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{t('Rating:', 'Оценка:')}</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => set('trip_rating', form.trip_rating === n ? 0 : n)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '2px', color: n <= form.trip_rating ? 'var(--admin-accent)' : 'var(--admin-text-faint)' }}>
                ★
              </button>
            ))}
            {form.trip_rating > 0 && <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{form.trip_rating}/5</span>}
          </div>
          <textarea value={form.trip_feedback} onChange={(e) => set('trip_feedback', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} placeholder={t('How did the trip go? What did the client say?', 'Как прошла поездка? Что сказал клиент?')} />
        </section>
      )}

      {canBook && (
        <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
          <label style={labelStyle}>{t('Booking', 'Бронь')}</label>
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 12px' }}>
            {t('Record what you actually booked — hotels, transfers, partners and pricing.',
              'Зафиксируйте, что вы реально забронировали — отели, трансферы, партнёры и цены.')}
          </p>
          {bookings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {bookings.map((b) => {
                const totals = (b.booking_services ?? []).reduce((acc, s) => {
                  const cur = s.currency || 'EUR'
                  acc[cur] = (acc[cur] ?? 0) + ((s.gross ?? 0) - (s.net ?? 0))
                  return acc
                }, {} as Record<string, number>)
                const commission = Object.entries(totals)
                  .filter(([, v]) => v !== 0)
                  .map(([cur, v]) => `${v.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${cur}`)
                  .join(' · ')
                const dates = [b.start_date, b.end_date].filter(Boolean).join(' → ')
                const statusColor = b.status === 'confirmed' ? 'var(--admin-success)'
                  : b.status === 'cancelled' ? 'var(--admin-danger)' : 'var(--admin-text-muted)'
                return (
                  <a key={b.id} href={`/admin/bookings/${b.id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-card)', textDecoration: 'none', color: 'inherit', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--admin-text)' }}>
                      {b.booking_code || 'Booking'}
                    </span>
                    <span style={{ fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: statusColor, border: `1px solid ${statusColor}`, borderRadius: '4px', padding: '1px 6px' }}>
                      {b.status || 'draft'}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[b.destination, dates].filter(Boolean).join(' · ')}
                    </span>
                    {commission && (
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-success)', flexShrink: 0 }}>
                        {commission}
                      </span>
                    )}
                  </a>
                )
              })}
            </div>
          )}

          <form action={createBookingFromRequest.bind(null, request.id)}>
            <button type="submit"
              style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
              {t('+ Create booking', '+ Создать бронь')}
            </button>
          </form>
        </section>
      )}

      <section style={{ paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={handleDone} disabled={saveState === 'saving'}
          style={{ padding: '10px 24px', fontSize: '13px', fontWeight: 500, letterSpacing: '0.03em', background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '8px', cursor: saveState === 'saving' ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: saveState === 'saving' ? 0.6 : 1 }}>
          {saveState === 'saving' ? t('Saving…', 'Сохранение…') : t('Done', 'Готово')}
        </button>
      </section>
    </div>
  )
}