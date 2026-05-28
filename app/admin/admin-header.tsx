'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useIsMobile } from '@/lib/use-is-mobile'
import GearMenu from './gear-menu'

type Props = {
  isAdmin: boolean
  email: string
  companyName: string | null
}

export default function AdminHeader({ isAdmin, email, companyName }: Props) {
  const pathname = usePathname()
  const isMobile = useIsMobile()

  const navItems = [
    { href: '/admin', label: 'Proposals', matchPrefix: '/admin/proposals' },
    { href: '/admin/library', label: 'Library', matchPrefix: '/admin/library' },
  ]

  function isActive(item: typeof navItems[number]) {
    if (item.href === '/admin') {
      return pathname === '/admin' || pathname.startsWith('/admin/proposals')
    }
    return pathname.startsWith(item.matchPrefix)
  }

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isMobile ? '12px 16px' : '20px 40px',
      borderBottom: '1px solid #2A2A28',
      background: '#0f0f0f',
    }}>
      <Link
        href="/admin"
        style={{
          fontSize: isMobile ? '10px' : '12px',
          fontWeight: 500,
          letterSpacing: isMobile ? '0.08em' : '0.12em',
          color: '#E5E2DA',
          textDecoration: 'none',
          transition: 'opacity 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.75' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
      >
        {(companyName ?? 'Sky Travel').toUpperCase()} <span style={{ color: '#555', margin: isMobile ? '0 4px' : '0 6px' }}>·</span> ADMIN
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '14px' : '24px' }}>
        {navItems.map((item) => {
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                fontSize: isMobile ? '11px' : '13px',
                fontWeight: 500,
                letterSpacing: isMobile ? '0.02em' : '0.04em',
                textTransform: 'uppercase',
                color: active ? '#FAF8F4' : '#888780',
                textDecoration: 'none',
                paddingBottom: '2px',
                marginBottom: '-2px',
                borderBottom: `2px solid ${active ? '#FAF8F4' : 'transparent'}`,
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.color = '#E5E2DA'
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.color = '#888780'
              }}
            >
              {item.label}
            </Link>
          )
        })}

        <GearMenu isAdmin={isAdmin} email={email} />
      </div>
    </nav>
  )
}