'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n-client'
import GearMenu from './gear-menu'
import TaskBell from './_components/task-bell'
import { setBrandFilter } from '@/lib/brand-filter-actions'

type BrandLite = { id: string; name: string }

type Props = {
  isAdmin: boolean
  email: string
  companyName: string | null
  isSuperadmin: boolean
  isAccountant?: boolean
  brands?: BrandLite[]
  activeBrandId?: string | null
}

type Item = { href: string; label: string; matchPrefix: string; icon: IconName }

type IconName =
  | 'clients' | 'requests' | 'bookings' | 'tasks' | 'accounting'
  | 'partners' | 'proposals' | 'destinations' | 'vouchers' | 'birthdays'
  | 'library' | 'companies' | 'offers' | 'simple'

function Icon({ name }: { name: IconName }) {
  const p: Record<IconName, string> = {
    requests: 'M4 6h16M4 12h16M4 18h10',
    proposals: 'M6 2h9l5 5v15H6zM15 2v5h5',
    bookings: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7',
    vouchers: 'M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4zM9 6v12',
    tasks: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    accounting: 'M3 6h18v12H3zM3 10h18M7 15h4',
    clients: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-4 4-6 8-6s8 2 8 6',
    partners: 'M3 21V7l9-4 9 4v14M9 21v-6h6v6',
    destinations: 'M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    birthdays: 'M4 21v-7h16v7zM6 14v-3a6 6 0 0 1 12 0v3M12 8V4',
    library: 'M4 4h16v16H4zM9 4v16M15 4v16',
    companies: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    offers: 'M4 5h16v5H4zM4 14h16v5H4zM8 7.5h.01M8 16.5h.01',
    simple: 'M7 3h10a1 1 0 0 1 1 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 0 1 1-1zM9 8h6M9 12h6',
  }
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={p[name]} />
    </svg>
  )
}

export default function AdminSidebar({ isAdmin, email, companyName, isSuperadmin, isAccountant, brands = [], activeBrandId = null }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useT()
  const [drawer, setDrawer] = useState(false)
  const [, startTransition] = useTransition()

  function changeBrand(value: string) {
    startTransition(async () => { await setBrandFilter(value); router.refresh() })
  }

  const brandSwitcher = brands.length > 1 ? (
    <div style={{ padding: '0 6px 12px' }}>
      <div style={{ fontSize: '9.5px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--admin-sidebar-muted)', margin: '0 6px 5px', fontWeight: 600 }}>
        {t('Brand', 'Бренд')}
      </div>
      <select
        value={activeBrandId ?? 'all'}
        onChange={(e) => changeBrand(e.target.value)}
        style={{
          width: '100%', padding: '9px 30px 9px 11px', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
          background: '#332E27', color: '#F5EFE4', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '8px', outline: 'none',
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 3l3 3 3-3' fill='none' stroke='%23C9A24B' stroke-width='1.5'/></svg>")`,
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center',
        }}
      >
        <option value="all" style={{ background: '#26221D', color: '#F5EFE4' }}>{t('All brands', 'Все бренды')}</option>
        {brands.map((b) => <option key={b.id} value={b.id} style={{ background: '#26221D', color: '#F5EFE4' }}>{b.name}</option>)}
      </select>
    </div>
  ) : null

  const items: Item[] = isSuperadmin
    ? [{ href: '/admin/companies', label: t('Companies', 'Компании'), matchPrefix: '/admin/companies', icon: 'companies' }]
    : isAccountant
      ? [{ href: '/admin/accounting', label: t('Accounting', 'Бухгалтерия'), matchPrefix: '/admin/accounting', icon: 'accounting' }]
      : [
          { href: '/admin/tasks', label: t('Tasks', 'Задачи'), matchPrefix: '/admin/tasks', icon: 'tasks' },
          { href: '/admin/requests', label: t('Requests', 'Заявки'), matchPrefix: '/admin/requests', icon: 'requests' },
          { href: '/admin', label: t('Proposals', 'Предложения'), matchPrefix: '/admin/proposals', icon: 'proposals' },
          { href: '/admin/destinations', label: t('Destinations', 'Направления'), matchPrefix: '/admin/destinations', icon: 'destinations' },
          { href: '/admin/bookings', label: t('Bookings', 'Брони'), matchPrefix: '/admin/bookings', icon: 'bookings' },
          { href: '/admin/vouchers', label: t('Vouchers', 'Ваучеры'), matchPrefix: '/admin/vouchers', icon: 'vouchers' },
          { href: '/admin/offers', label: t('Offers', 'Офферы'), matchPrefix: '/admin/offers', icon: 'offers' },
          { href: '/admin/simple', label: t('Simple', 'Симпл'), matchPrefix: '/admin/simple', icon: 'simple' },
          ...(isAdmin ? [{ href: '/admin/accounting', label: t('Accounting', 'Бухгалтерия'), matchPrefix: '/admin/accounting', icon: 'accounting' as IconName }] : []),
          { href: '/admin/clients', label: t('Clients', 'Клиенты'), matchPrefix: '/admin/clients', icon: 'clients' },
          { href: '/admin/partners', label: t('Partners', 'Партнёры'), matchPrefix: '/admin/partners', icon: 'partners' },
          { href: '/admin/library', label: t('Library', 'Библиотека'), matchPrefix: '/admin/library', icon: 'library' },
          { href: '/admin/birthdays', label: t('Birthdays', 'Дни рождения'), matchPrefix: '/admin/birthdays', icon: 'birthdays' },
        ]

  function isActive(item: Item) {
    if (item.href === '/admin') return pathname === '/admin' || pathname.startsWith('/admin/proposals')
    return pathname.startsWith(item.matchPrefix)
  }

  const brand = isSuperadmin ? 'Platform' : (companyName ?? 'Travel System')
  const brandSub = isSuperadmin ? 'Superadmin' : 'Travel System'

  function navList(onClick?: () => void) {
    return (
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {items.map((item) => {
          const active = isActive(item)
          return (
            <Link key={item.href} href={item.href} onClick={onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 12px', borderRadius: '8px',
                textDecoration: 'none', fontSize: '13.5px', fontWeight: 500, position: 'relative',
                color: active ? '#F5EFE4' : 'var(--admin-sidebar-text)',
                background: active ? 'rgba(255,255,255,0.09)' : 'transparent',
              }}>
              <span style={{ color: active ? 'var(--admin-gold-soft)' : '#B8AF9F', display: 'flex' }}><Icon name={item.icon} /></span>
              {item.label}
              {active && <span style={{ position: 'absolute', left: '-14px', top: '8px', bottom: '8px', width: '3px', borderRadius: '0 3px 3px 0', background: 'var(--admin-gold-soft)' }} />}
            </Link>
          )
        })}
      </nav>
    )
  }

  const brandBlock = (
    <Link href={isSuperadmin ? '/admin/companies' : '/admin'} style={{ textDecoration: 'none', display: 'block', padding: '6px 12px 2px' }}>
      <div style={{ fontSize: '20px', fontWeight: 700, color: '#F5EFE4', letterSpacing: '0.01em', lineHeight: 1.1 }}>{brand}</div>
      <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--admin-sidebar-muted)', fontWeight: 500, marginTop: '3px' }}>{brandSub}</div>
    </Link>
  )

  return (
    <>
      {/* ДЕСКТОП: боковое меню */}
      <aside className="admin-sidebar-desktop" style={{
        width: '230px', flex: 'none', background: 'var(--admin-sidebar)', color: 'var(--admin-sidebar-text)',
        flexDirection: 'column', padding: '20px 14px', position: 'sticky', top: 0, height: '100vh',
      }}>
        {brandBlock}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 6px 14px' }}>
          {!isSuperadmin && !isAccountant && <TaskBell align="left" />}
          <GearMenu isAdmin={isAdmin} email={email} align="left" />
        </div>
        {brandSwitcher}
        {navList()}
        <div style={{ marginTop: 'auto', padding: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '12px', color: '#E4DCCD', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {email}
        </div>
      </aside>

      {/* МОБИЛКА: верхняя панель + выезжающий drawer */}
      <div className="admin-topbar" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30, height: '52px',
        alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '0 14px',
        background: 'var(--admin-sidebar)', color: '#F5EFE4',
      }}>
        <button type="button" aria-label="Menu" onClick={() => setDrawer(true)}
          style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '34px', height: '34px', padding: '7px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '7px', cursor: 'pointer' }}>
          <span style={{ height: '2px', background: '#F5EFE4', borderRadius: '1px' }} />
          <span style={{ height: '2px', background: '#F5EFE4', borderRadius: '1px' }} />
          <span style={{ height: '2px', background: '#F5EFE4', borderRadius: '1px' }} />
        </button>
        <span style={{ fontSize: '15px', fontWeight: 700 }}>{brand}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {!isSuperadmin && !isAccountant && <TaskBell />}
          <GearMenu isAdmin={isAdmin} email={email} />
        </div>
      </div>

      {drawer && (
        <>
          <div onClick={() => setDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 45 }} />
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: '250px', zIndex: 46, background: 'var(--admin-sidebar)', color: 'var(--admin-sidebar-text)', padding: '20px 14px', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '4px 0 24px rgba(0,0,0,0.4)' }}>
            {brandBlock}
            <div style={{ height: '10px' }} />
            {brandSwitcher}
            {navList(() => setDrawer(false))}
          </div>
        </>
      )}
    </>
  )
}
