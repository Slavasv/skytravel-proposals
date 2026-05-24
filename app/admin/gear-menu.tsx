'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-client'

type Props = {
  email: string
  isAdmin: boolean
}

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  padding: '8px 12px',
  fontSize: '13px',
  color: '#E5E2DA',
  textDecoration: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  width: '100%',
  textAlign: 'left' as const,
  fontFamily: 'inherit',
}

export default function GearMenu({ email, isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function onHover(e: React.MouseEvent<HTMLElement>) {
    e.currentTarget.style.background = '#2A2A28'
  }
  function onLeave(e: React.MouseEvent<HTMLElement>) {
    e.currentTarget.style.background = 'none'
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="Settings"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: open ? '#E5E2DA' : '#888780',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#E5E2DA' }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.color = '#888780' }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fillRule="evenodd" clipRule="evenodd" d="M6.5 1a.5.5 0 0 0-.491.404l-.24 1.32a5.2 5.2 0 0 0-.928.537l-1.27-.423a.5.5 0 0 0-.588.224l-1.5 2.598a.5.5 0 0 0 .104.632l1.02.883a5.3 5.3 0 0 0 0 1.65l-1.02.883a.5.5 0 0 0-.104.632l1.5 2.598a.5.5 0 0 0 .588.224l1.27-.423c.291.205.602.383.928.537l.24 1.32A.5.5 0 0 0 6.5 15h3a.5.5 0 0 0 .491-.404l.24-1.32c.326-.154.637-.332.928-.537l1.27.423a.5.5 0 0 0 .588-.224l1.5-2.598a.5.5 0 0 0-.104-.632l-1.02-.883a5.3 5.3 0 0 0 0-1.65l1.02-.883a.5.5 0 0 0 .104-.632l-1.5-2.598a.5.5 0 0 0-.588-.224l-1.27.423a5.2 5.2 0 0 0-.928-.537l-.24-1.32A.5.5 0 0 0 9.5 1h-3zm1.5 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" fill="currentColor"/>
        </svg>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
          <div style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            zIndex: 20,
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '10px',
            padding: '6px',
            minWidth: '220px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}>
            <div style={{ padding: '8px 12px', fontSize: '12px', color: '#555' }}>
              {email}
            </div>

            <div style={{ height: '1px', background: '#2A2A28', margin: '4px 0' }} />

            <a
              href="/admin/settings"
              onClick={() => setOpen(false)}
              style={menuItemStyle}
              onMouseEnter={onHover}
              onMouseLeave={onLeave}
            >
              Change password
            </a>

            {isAdmin && (
              <a
                href="/admin/users"
                onClick={() => setOpen(false)}
                style={menuItemStyle}
                onMouseEnter={onHover}
                onMouseLeave={onLeave}
              >
                Users
              </a>
            )}

            <div style={{ height: '1px', background: '#2A2A28', margin: '4px 0' }} />

            <button
              onClick={handleSignOut}
              style={{ ...menuItemStyle, color: '#E07B7B' }}
              onMouseEnter={onHover}
              onMouseLeave={onLeave}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}