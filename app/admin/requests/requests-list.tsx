'use client'

import { useState, useMemo, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n-client'
import { deleteRequest, duplicateRequest } from './actions'

export type RequestRow = {
  id: string
  request_code: string | null
  destination: string | null
  details: string | null
  status: string | null
  priority: string | null
  created_at: string
  closed_at: string | null
  trip_start: string | null
  trip_end: string | null
  owner_id: string | null
  clients?: { name: string; client_code: string | null } | { name: string; client_code: string | null }[] | null
  profiles?: { email: string } | { email: string }[] | null
  companies?: { name: string | null } | { name: string | null }[] | null
}

// локальная палитра с усиленным контрастом (глобально поправим отдельно)
const C = {
  text: 'var(--admin-text)',
  muted: '#6F6C64',
  faint: '#9C988E',
  border: '#D8D0C2',
  borderStrong: '#C7BCA8',
  head: '#EAE3D6',
  card: 'var(--admin-card)',
  accent: '#B07B2B',
  rowHover: '#F5EFE4',
}

// tone: цвет фона/границы/текста выпадашки статуса
type Tone = 'work' | 'mid' | 'done' | 'cancel'
const TONE: Record<Tone, { bg: string; border: string; color: string }> = {
  work:   { bg: '#F7EFDD', border: '#E4CF9E', color: '#7A5B12' },
  mid:    { bg: '#FBE9CE', border: '#E9C98D', color: '#8A5A12' },
  done:   { bg: '#E2EFDD', border: '#AFCFA4', color: '#356B2C' },
  cancel: { bg: '#EDE7DC', border: '#D3C9B8', color: '#7A6F66' },
}
const STATUS_META: Record<string, { en: string; ru: string; tone: Tone }> = {
  new:            { en: 'New Request',         ru: 'Новая заявка',            tone: 'work' },
  clients_review: { en: 'Client review',       ru: 'На согласовании',         tone: 'work' },
  preparing:      { en: 'Preparing proposal',  ru: 'Готовим предложение',     tone: 'work' },
  proposal_sent:  { en: 'Proposal sent',       ru: 'Предложение отправлено',  tone: 'mid' },
  revising:       { en: 'Revising proposal',   ru: 'Дорабатываем',            tone: 'mid' },
  booking:        { en: 'Booking in progress', ru: 'В процессе бронирования', tone: 'mid' },
  confirmed:      { en: 'Confirmed',           ru: 'Подтверждена',            tone: 'done' },
  cancelled:      { en: 'Cancelled',           ru: 'Отменена',                tone: 'cancel' },
}
const STATUS_ORDER = ['new', 'clients_review', 'preparing', 'proposal_sent', 'revising', 'booking', 'confirmed', 'cancelled']
// «в работе» = всё, кроме завершённых (confirmed) и отменённых (cancelled)
const ACTIVE_SET = ['new', 'clients_review', 'preparing', 'proposal_sent', 'revising', 'booking']
type Actuality = 'active' | 'confirmed' | 'cancelled' | 'all'

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseISO(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export default function RequestsList({
  requests, showOwner, destSummary = {}, showBrand = false,
}: {
  requests: RequestRow[]
  showOwner: boolean
  destSummary?: Record<string, string>
  showBrand?: boolean
}) {
  const t = useT()
  const router = useRouter()
  const isRu = t('en', 'ru') === 'ru'
  const MONTHS = isRu ? MONTHS_RU : MONTHS_EN

  const safe = Array.isArray(requests) ? requests : []
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'trip_soon' | 'trip_far' | 'created'>('trip_soon')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [tripFrom, setTripFrom] = useState('')
  const [tripTo, setTripTo] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  // по умолчанию показываем только заявки «в работе» (неактуальные скрыты)
  const [actuality, setActuality] = useState<Actuality>('active')
  const [showTripDates, setShowTripDates] = useState(false)

  const effStatus = (r: RequestRow) => overrides[r.id] ?? r.status ?? 'new'

  // набор статусов текущей «актуальности»; null = все
  const bucket: string[] | null =
    actuality === 'active' ? ACTIVE_SET
      : actuality === 'confirmed' ? ['confirmed']
        : actuality === 'cancelled' ? ['cancelled']
          : null
  // в выпадашке конкретного статуса показываем только статусы текущего набора
  const statusOptions = bucket ?? STATUS_ORDER

  const agentOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of safe) {
      if (!r.owner_id) continue
      const email = Array.isArray(r.profiles) ? r.profiles[0]?.email : r.profiles?.email
      if (!map.has(r.owner_id)) map.set(r.owner_id, email || r.owner_id)
    }
    return Array.from(map, ([id, email]) => ({ id, email })).sort((a, b) => a.email.localeCompare(b.email))
  }, [safe])

  // фильтрация
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return safe.filter((r) => {
      if (ownerFilter && r.owner_id !== ownerFilter) return false
      // «актуальность» (по умолчанию — только в работе)
      if (bucket && !bucket.includes(effStatus(r))) return false
      if (statusFilter && effStatus(r) !== statusFilter) return false
      if (priorityFilter && r.priority !== priorityFilter) return false
      if (tripFrom || tripTo) {
        if (!r.trip_start && !r.trip_end) return false
        const rStart = r.trip_start ? new Date(r.trip_start) : new Date(r.trip_end!)
        const rEnd = r.trip_end ? new Date(r.trip_end) : new Date(r.trip_start!)
        if (tripFrom && rEnd < new Date(tripFrom)) return false
        if (tripTo && rStart > new Date(tripTo)) return false
      }
      if (!q) return true
      const client = Array.isArray(r.clients) ? r.clients[0] : r.clients
      const hay = [client?.name, r.request_code, destSummary[r.id], r.destination, r.details].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safe, search, statusFilter, priorityFilter, tripFrom, tripTo, ownerFilter, actuality, overrides, destSummary])

  // сортировка
  const sorted = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    // группа: 0 — предстоящие, 1 — прошедшие, 2 — без даты
    const key = (r: RequestRow) => {
      const s = parseISO(r.trip_start)
      if (!s) return { g: 2, t: 0 }
      return { g: s >= today ? 0 : 1, t: s.getTime() }
    }
    const arr = [...filtered]
    arr.sort((a, b) => {
      if (sort === 'created') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      const ka = key(a), kb = key(b)
      if (ka.g !== kb.g) return ka.g - kb.g
      if (ka.g === 0) return sort === 'trip_far' ? kb.t - ka.t : ka.t - kb.t  // предстоящие
      if (ka.g === 1) return kb.t - ka.t  // прошедшие — свежие выше
      return 0
    })
    return arr
  }, [filtered, sort])

  function changeStatus(id: string, newStatus: string) {
    const prev = overrides[id] ?? safe.find((r) => r.id === id)?.status ?? 'new'
    setOverrides((o) => ({ ...o, [id]: newStatus }))
    fetch(`/api/requests/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    }).then((res) => { if (!res.ok) throw new Error() })
      .catch(() => {
        setOverrides((o) => ({ ...o, [id]: prev }))
        alert(t('Could not change status', 'Не удалось изменить статус'))
      })
  }

  // форматирование дат
  function fmtDay(d: Date) { return `${d.getDate()} ${MONTHS[d.getMonth()]}` }
  function tripRange(r: RequestRow): string {
    const s = parseISO(r.trip_start), e = parseISO(r.trip_end)
    if (!s && !e) return ''
    if (s && e) {
      if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) return `${s.getDate()}–${e.getDate()} ${MONTHS[e.getMonth()]}`
      return `${fmtDay(s)}–${fmtDay(e)}`
    }
    return fmtDay((s || e)!)
  }
  function proximity(r: RequestRow): { text: string; kind: 'soon' | 'past' } | null {
    const s = parseISO(r.trip_start)
    if (!s) return null
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const days = Math.round((s.getTime() - now.getTime()) / 86400000)
    if (days < 0) return { text: t('past trip', 'поездка в прошлом'), kind: 'past' }
    if (days === 0) return { text: t('today', 'сегодня'), kind: 'soon' }
    if (days < 31) return { text: t(`in ${days}d`, `через ${days} дн`), kind: 'soon' }
    return { text: t(`in ~${Math.round(days / 30)}mo`, `через ~${Math.round(days / 30)} мес`), kind: 'soon' }
  }

  const field: React.CSSProperties = {
    padding: '9px 12px', fontSize: '13px', color: C.text, background: 'var(--admin-input)',
    border: `1px solid ${C.borderStrong}`, borderRadius: '8px', fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div>
      {/* toolbar */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px', alignItems: 'center' }}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('Search by client, destination, details…', 'Поиск по клиенту, направлению, деталям…')}
          style={{ ...field, flex: 1, minWidth: '220px' }} />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={field}
          title={t('Sort', 'Сортировка')}>
          <option value="trip_soon">{t('Trip: soonest first', 'Поездка: ближайшие')}</option>
          <option value="trip_far">{t('Trip: latest first', 'Поездка: дальние')}</option>
          <option value="created">{t('Created: newest', 'Создана: новые')}</option>
        </select>

        {/* Актуальность: по умолчанию «В работе» — неактуальные скрыты */}
        <select value={actuality}
          onChange={(e) => { setActuality(e.target.value as Actuality); setStatusFilter('') }}
          style={{ ...field, fontWeight: 600 }} title={t('Actuality', 'Актуальность')}>
          <option value="active">{t('In work', 'В работе')}</option>
          <option value="confirmed">{t('Confirmed', 'Подтверждённые')}</option>
          <option value="cancelled">{t('Cancelled', 'Отменённые')}</option>
          <option value="all">{t('All', 'Все')}</option>
        </select>

        {/* Все фильтры видны и работают одновременно */}
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...field, minWidth: '170px' }}>
          <option value="">{t('Any status', 'Любой статус')}</option>
          {statusOptions.map((v) => <option key={v} value={v}>{t(STATUS_META[v].en, STATUS_META[v].ru)}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={field}>
          <option value="">{t('Any priority', 'Любой приоритет')}</option>
          <option value="Low">{t('Low', 'Низкий')}</option>
          <option value="Medium">{t('Medium', 'Средний')}</option>
          <option value="High">{t('High', 'Высокий')}</option>
        </select>
        {showOwner && (
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} style={{ ...field, minWidth: '160px' }}>
            <option value="">{t('Any agent', 'Любой агент')}</option>
            {agentOptions.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
          </select>
        )}
        <button type="button" onClick={() => setShowTripDates((v) => !v)}
          style={{ ...field, cursor: 'pointer', color: (tripFrom || tripTo) ? C.accent : C.muted, fontWeight: (tripFrom || tripTo) ? 700 : 400 }}>
          {t('Trip dates', 'Даты поездки')} {(tripFrom || tripTo) ? '•' : '▾'}
        </button>
        {showTripDates && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="date" value={tripFrom} onChange={(e) => setTripFrom(e.target.value)} style={field} />
            <span style={{ fontSize: '12px', color: C.muted }}>—</span>
            <input type="date" value={tripTo} onChange={(e) => setTripTo(e.target.value)} style={field} />
          </div>
        )}

        {(ownerFilter || statusFilter || priorityFilter || tripFrom || tripTo || actuality !== 'active') && (
          <button type="button" onClick={() => { setOwnerFilter(''); setStatusFilter(''); setPriorityFilter(''); setTripFrom(''); setTripTo(''); setActuality('active'); setShowTripDates(false) }}
            style={{ ...field, cursor: 'pointer', color: C.muted }}>{t('Clear filters', 'Сбросить фильтры')}</button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: C.muted, border: `1px dashed ${C.borderStrong}`, borderRadius: '10px', fontSize: '14px' }}>
          {safe.length === 0
            ? t('No requests yet. Click + New request to create one.', 'Пока нет заявок. Нажмите «+ Новая заявка», чтобы создать.')
            : t('Nothing matches your filters.', 'Ничего не найдено по фильтрам.')}
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.borderStrong}`, borderRadius: '10px', overflow: 'hidden', background: C.card }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>{t('Client', 'Клиент')}</Th>
                  {showBrand && <Th>{t('Brand', 'Бренд')}</Th>}
                  <Th>{t('Destination', 'Направление')}</Th>
                  <Th>{t('Trip dates', 'Даты поездки')}</Th>
                  {showOwner && <Th>{t('Agent', 'Агент')}</Th>}
                  <Th>{t('Status', 'Статус')}</Th>
                  <Th>{t('Priority', 'Приоритет')}</Th>
                  <Th>{t('Created', 'Создана')}</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <Row
                    key={r.id} r={r} showOwner={showOwner} showBrand={showBrand}
                    destination={destSummary[r.id]}
                    status={effStatus(r)}
                    tripText={tripRange(r)}
                    prox={proximity(r)}
                    createdText={(() => { const d = parseISO(r.created_at); return d ? fmtDay(d) : '' })()}
                    onStatus={changeStatus}
                    onOpen={() => router.push(`/admin/requests/${r.id}`)}
                    isRu={isRu}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )

  function Th({ children }: { children: React.ReactNode }) {
    return (
      <th style={{ background: C.head, textAlign: 'left', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: C.muted, padding: '11px 14px', borderBottom: `1px solid ${C.borderStrong}`, whiteSpace: 'nowrap' }}>
        {children}
      </th>
    )
  }
}

const PRIO_STYLE: Record<string, { bg: string; color: string }> = {
  High: { bg: '#F6E2DF', color: '#B24A42' },
  Medium: { bg: '#F7EDD8', color: '#8A5A12' },
  Low: { bg: '#ECE6DA', color: '#6F6C64' },
}
const PRIO_LABEL: Record<string, { en: string; ru: string }> = {
  High: { en: 'High', ru: 'Высокий' },
  Medium: { en: 'Medium', ru: 'Средний' },
  Low: { en: 'Low', ru: 'Низкий' },
}

function Row({
  r, showOwner, showBrand, destination, status, tripText, prox, createdText, onStatus, onOpen,
}: {
  r: RequestRow
  showOwner: boolean
  showBrand: boolean
  destination?: string
  status: string
  tripText: string
  prox: { text: string; kind: 'soon' | 'past' } | null
  createdText: string
  onStatus: (id: string, s: string) => void
  onOpen: () => void
  isRu: boolean
}) {
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 150) })
    setMenuOpen(true)
  }

  const client = Array.isArray(r.clients) ? r.clients[0] : r.clients
  const ownerEmail = Array.isArray(r.profiles) ? r.profiles[0]?.email : r.profiles?.email
  const tone = TONE[STATUS_META[status]?.tone ?? 'work']

  const td: React.CSSProperties = { padding: '11px 14px', borderBottom: `1px solid ${C.border}`, fontSize: '13.5px', color: C.text, verticalAlign: 'middle' }
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <tr onClick={onOpen}
      style={{ cursor: 'pointer', opacity: isPending ? 0.4 : (status === 'cancelled' ? 0.72 : 1), transition: 'opacity 0.15s', background: 'transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.rowHover }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
      <td style={td}>
        <div style={{ fontWeight: 600, color: C.text }}>{client?.name || t('No client', 'Без клиента')}</div>
        {r.request_code && <div style={{ fontSize: '11px', color: C.faint, marginTop: '2px' }}>{r.request_code}</div>}
      </td>
      {showBrand && <td style={{ ...td, color: C.muted, fontSize: '12.5px', whiteSpace: 'nowrap' }}>{(Array.isArray(r.companies) ? r.companies[0] : r.companies)?.name || '—'}</td>}
      <td style={{ ...td, color: destination ? C.text : C.faint }}>{destination || '—'}</td>
      <td style={td}>
        {tripText ? (
          <>
            <span style={{ fontWeight: 600 }}>{tripText}</span>
            {prox && <span style={{ display: 'block', marginTop: '2px', fontSize: '11px', fontWeight: prox.kind === 'soon' ? 700 : 400, color: prox.kind === 'soon' ? C.accent : C.faint }}>{prox.text}</span>}
          </>
        ) : <span style={{ color: C.faint }}>{t('no dates', 'даты не заданы')}</span>}
      </td>
      {showOwner && <td style={{ ...td, fontSize: '12px', color: C.muted }}>{ownerEmail || '—'}</td>}
      <td style={td} onClick={stop}>
        <select value={status} onChange={(e) => onStatus(r.id, e.target.value)}
          style={{
            appearance: 'none', WebkitAppearance: 'none', fontFamily: 'inherit', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.02em', textTransform: 'uppercase', borderRadius: '6px', padding: '6px 22px 6px 9px',
            cursor: 'pointer', background: tone.bg, color: tone.color, border: `1px solid ${tone.border}`,
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 3l3 3 3-3' fill='none' stroke='%23888' stroke-width='1.4'/></svg>")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center',
          }}>
          {STATUS_ORDER.map((v) => <option key={v} value={v} style={{ color: '#2C2C2A', background: '#fff', textTransform: 'none' }}>{t(STATUS_META[v].en, STATUS_META[v].ru)}</option>)}
        </select>
      </td>
      <td style={td}>
        {r.priority && PRIO_STYLE[r.priority] ? (
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', ...PRIO_STYLE[r.priority] }}>
            {t(PRIO_LABEL[r.priority].en, PRIO_LABEL[r.priority].ru)}
          </span>
        ) : <span style={{ color: C.faint }}>—</span>}
      </td>
      <td style={{ ...td, color: C.muted, fontSize: '12.5px', whiteSpace: 'nowrap' }}>{createdText}</td>
      <td style={{ ...td, textAlign: 'right' }} onClick={stop}>
        <button ref={btnRef} onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())} disabled={isPending} aria-label={t('Actions', 'Действия')}
          style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: '18px', lineHeight: 1, cursor: 'pointer', padding: '2px 8px', borderRadius: '6px', fontFamily: 'inherit' }}>⋯</button>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: '150px', background: 'var(--admin-input)', border: `1px solid ${C.borderStrong}`, borderRadius: '8px', padding: '4px', zIndex: 41, boxShadow: '0 6px 20px rgba(0,0,0,0.25)' }}>
              <button onClick={() => { setMenuOpen(false); startTransition(async () => { await duplicateRequest(r.id) }) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: C.text, fontSize: '13px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.rowHover }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>{t('Duplicate', 'Дублировать')}</button>
              <button onClick={() => { setMenuOpen(false); if (confirm(t('Delete this request?\n\nThis cannot be undone.', 'Удалить эту заявку?\n\nЭто действие необратимо.'))) startTransition(async () => { await deleteRequest(r.id) }) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--admin-danger)', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(178,74,66,0.1)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>{t('Delete', 'Удалить')}</button>
            </div>
          </>
        )}
      </td>
    </tr>
  )
}
