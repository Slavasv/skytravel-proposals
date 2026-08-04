'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-client'
import { useLang, useT } from '@/lib/i18n-client'
import { setUiLanguage } from './settings/language-actions'
import type { UiLang } from '@/lib/i18n'

type Props = {
  email: string
  isAdmin: boolean
}

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  padding: '8px 12px',
  fontSize: '13px',
  color: 'var(--admin-text)',
  textDecoration: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  width: '100%',
  textAlign: 'left' as const,
  fontFamily: 'inherit',
}

const LANGS: { value: UiLang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
]

export default function GearMenu({ email, isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const t = useT()
  const currentLang = useLang()
  const [lang, setLang] = useState<UiLang>(currentLang)
  const [savingLang, setSavingLang] = useState(false)

  async function handleSignOut() {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function chooseLang(next: UiLang) {
    if (next === lang || savingLang) return
    setLang(next)
    setSavingLang(true)
    const res = await setUiLanguage(next)
    if (!res.ok) setLang(currentLang)
    router.refresh() // перерисовать layout на новом языке
    setSavingLang(false)
  }

  function onHover(e: React.MouseEvent<HTMLElement>) {
    e.currentTarget.style.background = 'var(--admin-border-card)'
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
          color: open ? 'var(--admin-text)' : 'var(--admin-text-muted)',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--admin-text)' }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.color = 'var(--admin-text-muted)' }}
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
            background: 'var(--admin-input)',
            border: '1px solid var(--admin-border)',
            borderRadius: '10px',
            padding: '6px',
            minWidth: '220px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          }}>
            <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--admin-text-faint)' }}>
              {email}
            </div>

            <div style={{ height: '1px', background: 'var(--admin-border-card)', margin: '4px 0' }} />

            {/* Переключатель языка интерфейса */}
            <div style={{ padding: '8px 12px' }}>
              <div style={{ fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--admin-text-faint)', marginBottom: '8px' }}>
                {t('Language', 'Язык')}
              </div>
              <div style={{ display: 'flex', border: '1px solid var(--admin-border)', borderRadius: '8px', overflow: 'hidden' }}>
                {LANGS.map((opt) => {
                  const active = opt.value === lang
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => chooseLang(opt.value)}
                      disabled={savingLang}
                      style={{
                        flex: 1,
                        padding: '7px 10px',
                        fontSize: '12px',
                        fontFamily: 'inherit',
                        cursor: savingLang ? 'wait' : 'pointer',
                        border: 'none',
                        background: active ? 'var(--admin-text-on-dark)' : 'transparent',
                        color: active ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)',
                        fontWeight: active ? 600 : 400,
                        transition: 'background 0.15s, color 0.15s',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ height: '1px', background: 'var(--admin-border-card)', margin: '4px 0' }} />

            <Link
              href="/admin/settings"
              onClick={() => setOpen(false)}
              style={menuItemStyle}
              onMouseEnter={onHover}
              onMouseLeave={onLeave}
            >
              {t('Settings', 'Настройки')}
            </Link>

            {isAdmin && (
              <Link
                href="/admin/users"
                onClick={() => setOpen(false)}
                style={menuItemStyle}
                onMouseEnter={onHover}
                onMouseLeave={onLeave}
              >
                {t('Users', 'Пользователи')}
              </Link>
            )}

            <div style={{ height: '1px', background: 'var(--admin-border-card)', margin: '4px 0' }} />

            <button
              onClick={handleSignOut}
              style={{ ...menuItemStyle, color: 'var(--admin-danger)' }}
              onMouseEnter={onHover}
              onMouseLeave={onLeave}
            >
              {t('Sign out', 'Выйти')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}