'use client'

import { useState } from 'react'
import { deleteUser, resetPassword, toggleRole, updateUserName } from './actions'
import { useT } from '@/lib/i18n-client'

type User = {
  id: string
  email: string
  name: string
  role: string
  created_at: string
  last_sign_in: string | null
  proposal_count: number
}

export default function UserRow({ user, currentUserId }: { user: User; currentUserId: string }) {
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isSelf = user.id === currentUserId

  async function handleSetRole(role: 'manager' | 'admin' | 'accountant') {
    setLoading(true)
    setMenuOpen(false)
    await toggleRole(user.id, role)
    setLoading(false)
  }

  async function handleRename() {
    const newName = prompt(t('Name for this user:', 'Имя сотрудника:'), user.name || '')
    if (newName === null) return
    setLoading(true)
    setMenuOpen(false)
    await updateUserName(user.id, newName)
    setLoading(false)
  }

  async function handleResetPassword() {
    const newPassword = prompt(t(`New password for ${user.email}:`, `Новый пароль для ${user.email}:`))
    if (!newPassword) return
    setLoading(true)
    setMenuOpen(false)
    await resetPassword(user.id, newPassword)
    setLoading(false)
    alert(t('Password updated.', 'Пароль обновлён.'))
  }

  async function handleDelete() {
    if (!confirm(t(`Delete user ${user.email}? This cannot be undone.`, `Удалить пользователя ${user.email}? Это действие необратимо.`))) return
    setLoading(true)
    setMenuOpen(false)
    await deleteUser(user.id)
  }

  const formatDate = (str: string) =>
    new Date(str).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      border: '1px solid var(--admin-border-card)',
      borderRadius: '8px',
      background: 'var(--admin-input)',
      opacity: loading ? 0.5 : 1,
      transition: 'opacity 0.15s',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', color: 'var(--admin-text)' }}>{user.name || user.email}</span>
          {isSelf && (
            <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', letterSpacing: '0.06em' }}>{t('you', 'вы')}</span>
          )}
        </div>
        {user.name && (
          <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{user.email}</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '11px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: user.role === 'admin' ? 'var(--admin-accent)' : 'var(--admin-text-muted)',
          }}>
            {user.role}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--admin-text-faint)' }}>
            · {user.proposal_count} {user.proposal_count === 1 ? t('proposal', 'предложение') : t('proposals', 'предложений')}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--admin-text-faint)' }}>
            · {t('joined', 'создан')} {formatDate(user.created_at)}
          </span>
          {user.last_sign_in && (
            <span style={{ fontSize: '11px', color: 'var(--admin-text-faint)' }}>
              · {t('last login', 'последний вход')} {formatDate(user.last_sign_in)}
            </span>
          )}
        </div>
      </div>

      {!isSelf && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--admin-text-muted)',
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: '16px',
              fontFamily: 'inherit',
            }}
          >
            ⋯
          </button>

          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
              <div style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                zIndex: 20,
                background: 'var(--admin-input)',
                border: '1px solid var(--admin-border)',
                borderRadius: '8px',
                padding: '4px',
                minWidth: '180px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}>
                {(['manager', 'admin', 'accountant'] as const).filter((r) => r !== user.role).map((r) => (
                  <button
                    key={r}
                    onClick={() => handleSetRole(r)}
                    style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--admin-text)', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', fontFamily: 'inherit' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-border-card)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                  >
                    {t('Make', 'Назначить')} {r}
                  </button>
                ))}
                <button
                  onClick={handleRename}
                  style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--admin-text)', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', fontFamily: 'inherit' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-border-card)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                >
                  {t('Rename', 'Переименовать')}
                </button>
                <button
                  onClick={handleResetPassword}
                  style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--admin-text)', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', fontFamily: 'inherit' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-border-card)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                >
                  {t('Reset password', 'Сбросить пароль')}
                </button>
                <button
                  onClick={handleDelete}
                  style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--admin-danger)', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', fontFamily: 'inherit' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-border-card)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                >
                  {t('Delete user', 'Удалить пользователя')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}