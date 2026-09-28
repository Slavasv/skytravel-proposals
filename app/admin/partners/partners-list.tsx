'use client'

import { useState, useMemo, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { deletePartner, duplicatePartner } from './actions'
import { useT } from '@/lib/i18n-client'

export type PartnerRow = {
  id: string
  name: string | null
  service_type: string | null
  destination: string | null
  operator_group: string | null
  updated_at: string
  companies?: { name: string | null } | { name: string | null }[] | null
}

function brandName(companies: PartnerRow['companies']): string {
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

function PartnerRowItem({ p, showBrand, onOpen }: { p: PartnerRow; showBrand: boolean; onOpen: () => void }) {
  const t = useT()
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  const name = p.name || t('Untitled partner', 'Партнёр без названия')
  const serviceType = p.service_type || ''
  const destination = p.destination || ''
  const group = p.operator_group || ''

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 160) })
    setMenuOpen(true)
  }
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  function handleDuplicate(e: React.MouseEvent) {
    e.stopPropagation(); setMenuOpen(false)
    startTransition(async () => { await duplicatePartner(p.id) })
  }
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation(); setMenuOpen(false)
    if (!confirm(t(`Delete partner "${name}"?\n\nThis cannot be undone.`, `Удалить партнёра «${name}»?\n\nЭто действие необратимо.`))) return
    startTransition(async () => { await deletePartner(p.id) })
  }

  return (
    <tr className="adm-row" onClick={onOpen} style={{ opacity: isPending ? 0.4 : 1 }}>
      <td>
        <span className="adm-cell-strong">{name}</span>
      </td>
      {showBrand && (
        <td>
          <span className="adm-pill adm-tone-info">{brandName(p.companies)}</span>
        </td>
      )}
      <td>
        {serviceType
          ? <span className="adm-pill adm-tone-info">{serviceType}</span>
          : <span style={{ color: '#9C988E' }}>—</span>}
      </td>
      <td style={{ color: destination ? undefined : '#9C988E' }}>{destination || '—'}</td>
      <td style={{ color: group ? undefined : '#9C988E' }}>{group || '—'}</td>
      <td className="adm-cell-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.updated_at)}</td>
      <td className="adm-right" onClick={stop}>
        <button ref={btnRef} className="adm-dots" disabled={isPending} aria-label={t('Actions', 'Действия')}
          onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}>⋯</button>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div className="adm-menu" style={{ top: menuPos.top, left: menuPos.left }}>
              <button className="adm-menu-item" onClick={handleDuplicate}>{t('Duplicate', 'Дублировать')}</button>
              <button className="adm-menu-item danger" onClick={handleDelete}>{t('Delete', 'Удалить')}</button>
            </div>
          </>
        )}
      </td>
    </tr>
  )
}

export default function PartnersList({ partners, showBrand = false }: { partners: PartnerRow[]; showBrand?: boolean }) {
  const t = useT()
  const router = useRouter()
  const safe = Array.isArray(partners) ? partners : []
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const types = useMemo(() => {
    const set = new Set<string>()
    safe.forEach((p) => { if (p.service_type) set.add(p.service_type) })
    return Array.from(set).sort()
  }, [safe])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return safe.filter((p) => {
      if (typeFilter && p.service_type !== typeFilter) return false
      if (!q) return true
      const hay = [p.name, p.destination, p.operator_group].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [safe, search, typeFilter])

  return (
    <div>
      <div className="adm-toolbar">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('Search partners…', 'Поиск партнёров…')} className="adm-field adm-field-search" />
        {types.length > 0 && (
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="adm-field">
            <option value="">{t('All types', 'Все типы')}</option>
            {types.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="adm-empty">
          {safe.length === 0 ? t('No partners yet. Click + New partner to create one.', 'Пока нет партнёров. Нажмите + Новый партнёр, чтобы создать.') : t('Nothing matches your filters.', 'Ничего не найдено по вашим фильтрам.')}
        </div>
      ) : (
        <div className="adm-tcard">
          <div className="adm-tscroll">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>{t('Partner', 'Партнёр')}</th>
                  {showBrand && <th>{t('Brand', 'Бренд')}</th>}
                  <th>{t('Type', 'Тип')}</th>
                  <th>{t('Destination', 'Направление')}</th>
                  <th>{t('Group', 'Группа')}</th>
                  <th>{t('Updated', 'Обновлён')}</th>
                  <th> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <PartnerRowItem key={p.id} p={p} showBrand={showBrand}
                    onOpen={() => router.push(`/admin/partners/${p.id}`)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
