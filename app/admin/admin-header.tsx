'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useIsMobile } from '@/lib/use-is-mobile'
import GearMenu from './gear-menu'

type Props = {
  isAdmin: boolean
  email: string
  companyName: string | null
  isSuperadmin: boolean
}

export default function AdminHeader({ isAdmin, email, companyName, isSuperadmin }: Props) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems = isSuperadmin
    ? [
        { href: '/admin/companies', label: 'Компании', matchPrefix: '/admin/companies' },
      ]
    : [
        { href: '/admin/clients', label: 'Clients', matchPrefix: '/admin/clients' },
        { href: '/admin/requests', label: 'Requests', matchPrefix: '/admin/requests' },
        { href: '/admin/partners', label: 'Partners', matchPrefix: '/admin/partners' },
        { href: '/admin', label: 'Proposals', matchPrefix: '/admin/proposals' },
        { href: '/admin/destinations', label: 'Destinations', matchPrefix: '/admin/destinations' },
        { href: '/admin/vouchers', label: 'Vouchers', matchPrefix: '/admin/vouchers' },
        { href: '/admin/library', label: 'Library', matchPrefix: '/admin/library' },
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
        {isSuperadmin ? 'PLATFORM' : (companyName ?? 'Sky Travel').toUpperCase()} <span style={{ color: 'var(--admin-text-faint)', margin: isMobile ? '0 4px' : '0 6px' }}>·</span> {isSuperadmin ? 'SUPERADMIN' : 'ADMIN'}
      </Link>

      {isMobile ? (
        /* Mobile: burger + dropdown */
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
                position: 'absolute', top: '100%', right: '16px', marginTop: '8px',
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