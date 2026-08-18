'use client'

import { useState } from 'react'
import { deleteUser, resetPassword, toggleRole, updateUserName, updateUserEmail } from './actions'
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

const itemStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none',
  border: 'none', color: 'var(--admin-text)', fontSize: '13px', cursor: 'pointer',
  borderRadius: '6px', fontFamily: 'inherit',
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
    if (newName === null) { setMenuOpen(false); return }
    setLoading(true)
    setMenuOpen(false)
    await updateUserName(user.id, newName)
    setLoading(false)
  }

  async function handleChangeEmail() {
    const newEmail = prompt(t('New login email for this user:', 'Новый email-логин пользователя:'), user.email)
    setMenuOpen(false)
    if (newEmail === null || newEmail.trim() === '' || newEmail.trim().toLowerCase() === user.email.toLowerCase()) return
    setLoading(true)
    const res = await updateUserEmail(user.id, newEmail)
    setLoading(false)
    alert(res.ok ? t('Email updated.', 'Email обновлён.') : `${t('Error', 'Ошибка')}: ${res.error || ''}`)
  }

  async function handleResetPassword() {
    const newPassword = prompt(t(`New password for ${user.email}:`, `Новый пароль для ${user.email}:`))
    if (!newPassword) { setMenuOpen(false); return }
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
              minWidth: '200px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}>
              {/* смена роли — только для других (свою роль не трогаем) */}
              {!isSelf && (['manager', 'admin', 'accountant'] as const).filter((r) => r !== user.role).map((r) => (
                <button
                  key={r}
                  onClick={() => handleSetRole(r)}
                  style={itemStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-border-card)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                >
                  {t('Make', 'Назначить')} {r}
                </button>
              ))}

              {/* имя и email — можно и себе */}
              <button
                onClick={handleRename}
                style={itemStyle}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-border-card)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                {t('Rename', 'Переименовать')}
              </button>
              <button
                onClick={handleChangeEmail}
                style={itemStyle}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-border-card)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
              >
                {t('Change email / login', 'Сменить email / логин')}
              </button>

              {/* сброс пароля и удаление — только для других */}
              {!isSelf && (
                <>
                  <button
                    onClick={handleResetPassword}
                    style={itemStyle}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-border-card)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                  >
                    {t('Reset password', 'Сбросить пароль')}
                  </button>
                  <button
                    onClick={handleDelete}
                    style={{ ...itemStyle, color: 'var(--admin-danger)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-border-card)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                  >
                    {t('Delete user', 'Удалить пользователя')}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}