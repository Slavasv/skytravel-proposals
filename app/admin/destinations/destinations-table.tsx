'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { tr, type UiLang } from '@/lib/i18n'
import { deleteProposal, duplicateProposal } from '../actions'

export type DestinationRow = {
  id: string
  slug: string
  trip_title_ru: string | null
  trip_title_en: string | null
  country_ru?: string | null
  country_en?: string | null
  status: string | null
  updated_at: string
  owner_email?: string | null
  companies?: { name: string | null } | { name: string | null }[] | null
}

function brandName(companies: DestinationRow['companies']): string {
  const c = Array.isArray(companies) ? companies[0] : companies
  return c?.name || '—'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(s: string | null): string {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

const STATUS_TONE: Record<string, string> = {
  draft: 'low',
  sent: 'info',
  confirmed: 'done',
  published: 'done',
  cancelled: 'cancel',
}

function statusLabel(status: string | null, lang: UiLang): string {
  switch (status) {
    case 'draft': return tr(lang, 'Draft', 'Черновик')
    case 'sent': return tr(lang, 'Sent', 'Отправлено')
    case 'confirmed': return tr(lang, 'Confirmed', 'Подтверждено')
    case 'published': return tr(lang, 'Published', 'Опубликовано')
    case 'cancelled': return tr(lang, 'Cancelled', 'Отменено')
    default: return status || tr(lang, 'Draft', 'Черновик')
  }
}

function DestinationRowItem({ p, showOwner, showBrand, lang, onOpen }: {
  p: DestinationRow
  showOwner: boolean
  showBrand: boolean
  lang: UiLang
  onOpen: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const title = p.trip_title_ru || p.trip_title_en || tr(lang, 'Untitled', 'Без названия')
  const country = tr(lang, p.country_en || '', p.country_ru || '')
  const status = p.status || 'draft'
  const tone = STATUS_TONE[status] || 'work'

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 160) })
    setMenuOpen(true)
  }
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation(); setMenuOpen(false)
    startTransition(async () => { await duplicateProposal(p.id) })
  }
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation(); setMenuOpen(false)
    if (!confirm(tr(lang,
      `Delete destination "${title}"?\n\nThis cannot be undone.`,
      `Удалить направление «${title}»?\n\nЭто действие нельзя отменить.`))) return
    startTransition(async () => { await deleteProposal(p.id) })
  }

  return (
    <tr className="adm-row" onClick={onOpen} style={{ opacity: isPending ? 0.4 : 1 }}>
      <td>
        <span className="adm-cell-strong">{title}</span>
        {p.slug && <div className="adm-cell-code">{p.slug}</div>}
      </td>
      {showBrand && (
        <td>
          <span className="adm-pill adm-tone-info">{brandName(p.companies)}</span>
        </td>
      )}
      <td style={{ color: country ? undefined : '#9C988E' }}>{country || '—'}</td>
      <td>
        <span className={`adm-pill adm-tone-${tone}`}>{statusLabel(p.status, lang)}</span>
      </td>
      {showOwner && <td className="adm-cell-muted">{p.owner_email || '—'}</td>}
      <td className="adm-cell-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.updated_at)}</td>
      <td className="adm-right" onClick={stop}>
        <button ref={btnRef} className="adm-dots" disabled={isPending} aria-label="Actions"
          onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}>⋯</button>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div className="adm-menu" style={{ top: menuPos.top, left: menuPos.left }}>
              <button className="adm-menu-item" onClick={handleDuplicate}>{tr(lang, 'Duplicate', 'Дублировать')}</button>
              <button className="adm-menu-item danger" onClick={handleDelete}>{tr(lang, 'Delete', 'Удалить')}</button>
            </div>
          </>
        )}
      </td>
    </tr>
  )
}

export default function DestinationsTable({ items, showOwner, showBrand = false, lang }: {
  items: DestinationRow[]
  showOwner: boolean
  showBrand?: boolean
  lang: UiLang
}) {
  const router = useRouter()
  const safeItems = Array.isArray(items) ? items : []

  if (safeItems.length === 0) {
    return (
      <div className="adm-empty">
        {tr(lang, 'No destinations yet. Click + New destination to create one.', 'Пока нет направлений. Нажмите + Новое направление, чтобы создать.')}
      </div>
    )
  }

  return (
    <div className="adm-tcard">
      <div className="adm-tscroll">
        <table className="adm-table">
          <thead>
            <tr>
              <th>{tr(lang, 'Destination', 'Направление')}</th>
              {showBrand && <th>{tr(lang, 'Brand', 'Бренд')}</th>}
              <th>{tr(lang, 'Country', 'Страна')}</th>
              <th>{tr(lang, 'Status', 'Статус')}</th>
              {showOwner && <th>{tr(lang, 'Owner', 'Владелец')}</th>}
              <th>{tr(lang, 'Updated', 'Обновлено')}</th>
              <th> </th>
            </tr>
          </thead>
          <tbody>
            {safeItems.map((p) => (
              <DestinationRowItem key={p.id} p={p} showOwner={showOwner} showBrand={showBrand} lang={lang}
                onOpen={() => router.push(`/admin/destinations/${p.id}`)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
