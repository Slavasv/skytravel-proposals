'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
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
}

// value хранится в БД; en/ru — подпись
const STATUS_META: Record<string, { en: string; ru: string; color: string }> = {
  new:            { en: 'New Request',         ru: 'Новая заявка',            color: 'var(--admin-accent)' },
  clients_review: { en: 'Client review',       ru: 'На согласовании',          color: 'var(--admin-accent)' },
  preparing:      { en: 'Preparing proposal',  ru: 'Готовим предложение',      color: 'var(--admin-accent)' },
  proposal_sent:  { en: 'Proposal sent',       ru: 'Предложение отправлено',   color: '#C99A3F' },
  revising:       { en: 'Revising proposal',   ru: 'Дорабатываем',             color: '#C99A3F' },
  booking:        { en: 'Booking in progress', ru: 'В процессе бронирования',  color: '#C99A3F' },
  confirmed:      { en: 'Confirmed',           ru: 'Подтверждена',             color: 'var(--admin-success)' },
  cancelled:      { en: 'Cancelled',           ru: 'Отменена',                 color: 'var(--admin-text-muted)' },
}

function RequestItem({ r, showOwner, destination }: { r: RequestRow; showOwner: boolean; destination?: string }) {
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)

  function daysBetween(from: string, to: string): string {
    const a = new Date(from), b = new Date(to)
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return ''
    const diff = Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
    if (diff === 0) return t('same day', 'в тот же день')
    if (diff === 1) return t('1 day', '1 день')
    return t(`${diff} days`, `${diff} дн.`)
  }

  const client = Array.isArray(r.clients) ? r.clients[0] : r.clients
  const ownerEmail = Array.isArray(r.profiles) ? r.profiles[0]?.email : r.profiles?.email
  const meta = STATUS_META[r.status || 'new'] || STATUS_META.new
  const clientName = client?.name || t('No client', 'Без клиента')

  const subParts = [destination].filter(Boolean)
  if (r.trip_start) {
    const start = new Date(r.trip_start)
    if (!isNaN(start.getTime())) {
      const now = new Date(); now.setHours(0, 0, 0, 0)
      const days = Math.round((start.getTime() - now.getTime()) / 86400000)
      let when = ''
      if (days < 0) when = t('past trip', 'поездка в прошлом')
      else if (days === 0) when = t('trip today', 'поездка сегодня')
      else if (days < 31) when = t(`trip in ${days}d`, `поездка через ${days}д`)
      else when = t(`trip in ~${Math.round(days / 30)}mo`, `поездка через ~${Math.round(days / 30)}мес`)
      subParts.push(when)
    }
  }
  if (r.closed_at) subParts.push(t(`closed in ${daysBetween(r.created_at, r.closed_at)}`, `закрыта за ${daysBetween(r.created_at, r.closed_at)}`))
  const subline = subParts.join(' · ')

  function toggleMenu(e: React.MouseEvent) { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen) }
  function handleDuplicate(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); setMenuOpen(false)
    startTransition(async () => { await duplicateRequest(r.id) })
  }
  function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation(); setMenuOpen(false)
    if (!confirm(t('Delete this request?\n\nThis cannot be undone.', 'Удалить эту заявку?\n\nЭто действие необратимо.'))) return
    startTransition(async () => { await deleteRequest(r.id) })
  }

  return (
    <li style={{ position: 'relative', opacity: isPending ? 0.4 : 1, transition: 'opacity 0.15s' }}>
      <Link href={`/admin/requests/${r.id}`} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
        padding: '16px 18px', paddingRight: '56px', border: '1px solid var(--admin-border-card)',
        borderRadius: '8px', background: 'var(--admin-card)', textDecoration: 'none', color: 'inherit',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--admin-text)' }}>{clientName}</span>
            {r.request_code && <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>{r.request_code}</span>}
            <span style={{ fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: meta.color, border: `1px solid ${meta.color}`, borderRadius: '4px', padding: '1px 6px' }}>
              {t(meta.en, meta.ru)}
            </span>
            {r.priority && (
              <span style={{ fontSize: '10px', color: 'var(--admin-text-muted)' }}>{r.priority}</span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subline || t('No details yet', 'Пока нет деталей')}
          </div>
          {showOwner && ownerEmail && (
            <div style={{ fontSize: '12px', color: 'var(--admin-text-faint)', marginTop: '2px' }}>{ownerEmail}</div>
          )}
        </div>
      </Link>

      <button onClick={toggleMenu} disabled={isPending} aria-label={t('Actions', 'Действия')}
        style={{ position: 'absolute', top: '50%', right: '14px', transform: 'translateY(-50%)', background: 'transparent', border: 'none', padding: '6px 10px', cursor: 'pointer', color: 'var(--admin-text-muted)', fontSize: '18px', lineHeight: 1, borderRadius: '6px', fontFamily: 'inherit' }}>
        ⋯
      </button>

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
          <div style={{ position: 'absolute', top: '50%', right: '14px', background: 'var(--admin-input)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '4px', minWidth: '140px', zIndex: 2, boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>
            <button onClick={handleDuplicate}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'inherit', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>{t('Duplicate', 'Дублировать')}</button>
            <button onClick={handleDelete}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--admin-danger)', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(224, 123, 123, 0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>{t('Delete', 'Удалить')}</button>
          </div>
        </>
      )}
    </li>
  )
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 6px 4px 10px', background: 'var(--admin-card)', border: '1px solid var(--admin-border-card)', borderRadius: '999px', fontSize: '12px', color: 'var(--admin-text)' }}>
      {label}
      <button type="button" onClick={onClear}
        style={{ background: 'transparent', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px', fontFamily: 'inherit' }}>
        ×
      </button>
    </span>
  )
}

export default function RequestsList({
  requests, showOwner, destSummary = {},
}: {
  requests: RequestRow[]
  showOwner: boolean
  destSummary?: Record<string, string>
}) {
  const t = useT()
  const safe = Array.isArray(requests) ? requests : []
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [createdFrom, setCreatedFrom] = useState('')
  const [createdTo, setCreatedTo] = useState('')
  const [tripFrom, setTripFrom] = useState('')
  const [tripTo, setTripTo] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')  // какой контрол показан

  const statusLabel = (v: string) => STATUS_META[v] ? t(STATUS_META[v].en, STATUS_META[v].ru) : v

  // список агентов из загруженных заявок (для фильтра в режиме «Все»)
  const agentOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of safe) {
      if (!r.owner_id) continue
      const email = Array.isArray(r.profiles) ? r.profiles[0]?.email : r.profiles?.email
      if (!map.has(r.owner_id)) map.set(r.owner_id, email || r.owner_id)
    }
    return Array.from(map, ([id, email]) => ({ id, email })).sort((a, b) => a.email.localeCompare(b.email))
  }, [safe])
  const agentLabel = (id: string) => agentOptions.find((a) => a.id === id)?.email || id

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return safe.filter((r) => {
      if (ownerFilter && r.owner_id !== ownerFilter) return false
      if (statusFilter && r.status !== statusFilter) return false
      if (priorityFilter && r.priority !== priorityFilter) return false

      // дата создания в диапазоне
      if (createdFrom || createdTo) {
        const created = new Date(r.created_at)
        if (createdFrom && created < new Date(createdFrom)) return false
        if (createdTo && created > new Date(createdTo + 'T23:59:59')) return false
      }

      // даты поездки пересекаются с фильтром хотя бы одним днём
      if (tripFrom || tripTo) {
        if (!r.trip_start && !r.trip_end) return false
        const rStart = r.trip_start ? new Date(r.trip_start) : new Date(r.trip_end!)
        const rEnd = r.trip_end ? new Date(r.trip_end) : new Date(r.trip_start!)
        const fFrom = tripFrom ? new Date(tripFrom) : null
        const fTo = tripTo ? new Date(tripTo) : null
        if (fFrom && rEnd < fFrom) return false
        if (fTo && rStart > fTo) return false
      }

      if (!q) return true
      const client = Array.isArray(r.clients) ? r.clients[0] : r.clients
      const hay = [client?.name, r.request_code, r.destination, r.details].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [safe, search, statusFilter, priorityFilter, createdFrom, createdTo, tripFrom, tripTo, ownerFilter])

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', fontSize: '14px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '8px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        {/* строка: поиск + кнопка фильтра */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Search by client, destination, details…', 'Поиск по клиенту, направлению, деталям…')} style={{ ...inputStyle, flex: 1, minWidth: '200px' }} />
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} style={{ ...inputStyle, width: '180px' }}>
            <option value="">{t('+ Filter ▾', '+ Фильтр ▾')}</option>
            {showOwner && <option value="agent">{t('Agent', 'Агент')}</option>}
            <option value="status">{t('Status', 'Статус')}</option>
            <option value="priority">{t('Priority', 'Приоритет')}</option>
            <option value="created">{t('Created date', 'Дата создания')}</option>
            <option value="trip">{t('Trip dates', 'Даты поездки')}</option>
          </select>
        </div>

        {/* контрол выбранного типа фильтра */}
        {activeFilter === 'agent' && showOwner && (
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} style={{ ...inputStyle, width: '240px' }}>
            <option value="">{t('All agents', 'Все агенты')}</option>
            {agentOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.email}</option>
            ))}
          </select>
        )}
        {activeFilter === 'status' && (
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: '240px' }}>
            <option value="">{t('All statuses', 'Все статусы')}</option>
            {Object.entries(STATUS_META).map(([value, m]) => (
              <option key={value} value={value}>{t(m.en, m.ru)}</option>
            ))}
          </select>
        )}
        {activeFilter === 'priority' && (
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={{ ...inputStyle, width: '240px' }}>
            <option value="">{t('All priorities', 'Все приоритеты')}</option>
            <option value="Low">{t('Low', 'Низкий')}</option>
            <option value="Medium">{t('Medium', 'Средний')}</option>
            <option value="High">{t('High', 'Высокий')}</option>
          </select>
        )}
        {activeFilter === 'created' && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{t('From', 'С')}</span>
            <input type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} style={{ ...inputStyle, width: '160px' }} />
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{t('To', 'По')}</span>
            <input type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} style={{ ...inputStyle, width: '160px' }} />
          </div>
        )}
        {activeFilter === 'trip' && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{t('From', 'С')}</span>
            <input type="date" value={tripFrom} onChange={(e) => setTripFrom(e.target.value)} style={{ ...inputStyle, width: '160px' }} />
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{t('To', 'По')}</span>
            <input type="date" value={tripTo} onChange={(e) => setTripTo(e.target.value)} style={{ ...inputStyle, width: '160px' }} />
          </div>
        )}

        {/* чипсы активных фильтров */}
        {(ownerFilter || statusFilter || priorityFilter || createdFrom || createdTo || tripFrom || tripTo) && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
            {ownerFilter && (
              <Chip label={`${t('Agent', 'Агент')}: ${agentLabel(ownerFilter)}`} onClear={() => setOwnerFilter('')} />
            )}
            {statusFilter && (
              <Chip label={`${t('Status', 'Статус')}: ${statusLabel(statusFilter)}`} onClear={() => setStatusFilter('')} />
            )}
            {priorityFilter && (
              <Chip label={`${t('Priority', 'Приоритет')}: ${priorityFilter}`} onClear={() => setPriorityFilter('')} />
            )}
            {(createdFrom || createdTo) && (
              <Chip label={`${t('Created', 'Создана')}: ${createdFrom || '…'} — ${createdTo || '…'}`} onClear={() => { setCreatedFrom(''); setCreatedTo('') }} />
            )}
            {(tripFrom || tripTo) && (
              <Chip label={`${t('Trip', 'Поездка')}: ${tripFrom || '…'} — ${tripTo || '…'}`} onClear={() => { setTripFrom(''); setTripTo('') }} />
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
          {safe.length === 0
            ? t('No requests yet. Click + New request to create one.', 'Пока нет заявок. Нажмите «+ Новая заявка», чтобы создать.')
            : t('Nothing matches your filters.', 'Ничего не найдено по фильтрам.')}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((r) => <RequestItem key={r.id} r={r} showOwner={showOwner} destination={destSummary[r.id]} />)}
        </ul>
      )}
    </div>
  )
}