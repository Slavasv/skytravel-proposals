'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useIsMobile } from '@/lib/use-is-mobile'
import { useT } from '@/lib/i18n-client'
import GearMenu from './gear-menu'

type Props = {
  isAdmin: boolean
  email: string
  companyName: string | null
  isSuperadmin: boolean
  isAccountant?: boolean
}

export default function AdminHeader({ isAdmin, email, companyName, isSuperadmin, isAccountant }: Props) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const t = useT()
const [menuOpen, setMenuOpen] = useState(false)

  // Навигацию сворачиваем в бургер раньше, чем общий mobile (768):
  // пунктов много, на планшетах/узких окнах строка разъезжается.
  const [navCollapsed, setNavCollapsed] = useState(false)
  useEffect(() => {
    const check = () => setNavCollapsed(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const navItems = isSuperadmin
    ? [
        { href: '/admin/companies', label: t('Companies', 'Компании'), matchPrefix: '/admin/companies' },
      ]
    : isAccountant
    ? [
        { href: '/admin/accounting', label: t('Accounting', 'Бухгалтерия'), matchPrefix: '/admin/accounting' },
      ]
    : [
        { href: '/admin/clients', label: t('Clients', 'Клиенты'), matchPrefix: '/admin/clients' },
        { href: '/admin/requests', label: t('Requests', 'Заявки'), matchPrefix: '/admin/requests' },
        { href: '/admin/bookings', label: t('Bookings', 'Брони'), matchPrefix: '/admin/bookings' },
        ...(isAdmin ? [{ href: '/admin/accounting', label: t('Accounting', 'Бухгалтерия'), matchPrefix: '/admin/accounting' }] : []),
        { href: '/admin/partners', label: t('Partners', 'Партнёры'), matchPrefix: '/admin/partners' },
        { href: '/admin', label: t('Proposals', 'Предложения'), matchPrefix: '/admin/proposals' },
        { href: '/admin/destinations', label: t('Destinations', 'Направления'), matchPrefix: '/admin/destinations' },
        { href: '/admin/vouchers', label: t('Vouchers', 'Ваучеры'), matchPrefix: '/admin/vouchers' },
        { href: '/admin/library', label: t('Library', 'Библиотека'), matchPrefix: '/admin/library' },
      ]

  function isActive(item: typeof navItems[number]) {
    if (item.href === '/admin') {
      return pathname === '/admin' || pathname.startsWith('/admin/proposals')
    }
    return pathname.startsWith(item.matchPrefix)
  }

  const linkBase: React.CSSProperties = {
    fontWeight: 500,
    textTransform: 'uppercase',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  }

  return (
    <nav style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isMobile ? '12px 16px' : '20px 40px',
      borderBottom: '1px solid var(--admin-border-card)',
      background: 'var(--admin-card)',
    }}>
      <Link
        href={isSuperadmin ? '/admin/companies' : '/admin'}
        style={{
          fontSize: isMobile ? '10px' : '12px',
          fontWeight: 500,
          letterSpacing: isMobile ? '0.08em' : '0.12em',
          color: 'var(--admin-text)',
          textDecoration: 'none',
          transition: 'opacity 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.75' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
      >
        {isSuperadmin ? 'PLATFORM' : (companyName ?? 'Travel System').toUpperCase()} <span style={{ color: 'var(--admin-text-faint)', margin: isMobile ? '0 4px' : '0 6px' }}>·</span> {isSuperadmin ? 'SUPERADMIN' : 'ADMIN'}
      </Link>

      {navCollapsed ? (
        /* Mobile/tablet: burger + dropdown */
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px',
              width: '32px', height: '32px', padding: '6px',
              background: 'transparent', border: '1px solid var(--admin-border)', borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'block', height: '2px', background: 'var(--admin-text)', borderRadius: '1px' }} />
            <span style={{ display: 'block', height: '2px', background: 'var(--admin-text)', borderRadius: '1px' }} />
            <span style={{ display: 'block', height: '2px', background: 'var(--admin-text)', borderRadius: '1px' }} />
          </button>

          <GearMenu isAdmin={isAdmin} email={email} />

          {menuOpen && (
            <>
              {/* overlay для закрытия по тапу вне меню */}
              <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{
                position: 'absolute', top: '100%', right: isMobile ? '16px' : '40px', marginTop: '8px',
                minWidth: '200px', background: 'var(--admin-card)',
                border: '1px solid var(--admin-border-card)', borderRadius: '10px',
                boxShadow: '0 16px 40px rgba(0,0,0,0.5)', zIndex: 41,
                padding: '6px', display: 'flex', flexDirection: 'column',
              }}>
                {navItems.map((item) => {
                  const active = isActive(item)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      style={{
                        ...linkBase,
                        fontSize: '13px',
                        letterSpacing: '0.04em',
                        padding: '12px 14px',
                        borderRadius: '6px',
                        color: active ? 'var(--admin-text-on-dark)' : 'var(--admin-text-muted)',
                        background: active ? 'var(--admin-input)' : 'transparent',
                      }}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </>
          )}
        </div>
      ) : (
        /* Desktop: inline nav */
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {navItems.map((item) => {
            const active = isActive(item)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...linkBase,
                  fontSize: '13px',
                  letterSpacing: '0.04em',
                  color: active ? 'var(--admin-text-on-dark)' : 'var(--admin-text-muted)',
                  paddingBottom: '2px',
                  marginBottom: '-2px',
                  borderBottom: `2px solid ${active ? 'var(--admin-text-on-dark)' : 'transparent'}`,
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--admin-text)' }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--admin-text-muted)' }}
              >
                {item.label}
              </Link>
            )
          })}

          <GearMenu isAdmin={isAdmin} email={email} />
        </div>
      )}
    </nav>
  )
}