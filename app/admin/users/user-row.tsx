'use client'

import { useState, useRef } from 'react'
import { deleteUser, resetPassword, toggleRole, updateUserName, updateUserEmail, updateUserMsEmail } from './actions'
import { useT } from '@/lib/i18n-client'

type User = {
  id: string
  email: string
  name: string
  role: string
  ms_email: string
  created_at: string
  last_sign_in: string | null
  proposal_count: number
}

export default function UserRow({ user, currentUserId }: { user: User; currentUserId: string }) {
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [loading, setLoading] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  const isSelf = user.id === currentUserId

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setMenuPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 160) })
    setMenuOpen(true)
  }

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

  async function handleMsEmail() {
    const newMs = prompt(t('Microsoft email (for Planner sync, not a login):', 'Microsoft email (для синхронизации Planner, не логин):'), user.ms_email || '')
    setMenuOpen(false)
    if (newMs === null) return
    setLoading(true)
    const res = await updateUserMsEmail(user.id, newMs)
    setLoading(false)
    if (!res.ok) alert(`${t('Error', 'Ошибка')}: ${res.error || ''}`)
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
    <tr style={{ opacity: loading ? 0.5 : 1 }}>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="adm-cell-strong">{user.name || user.email}</span>
          {isSelf && (
            <span className="adm-cell-faint" style={{ fontSize: '11px', letterSpacing: '0.06em' }}>{t('you', 'вы')}</span>
          )}
        </div>
        {user.name && <div className="adm-cell-code">{user.email}</div>}
        {user.ms_email && <div className="adm-cell-code">MS: {user.ms_email}</div>}
      </td>
      <td><span className="adm-pill adm-tone-info">{user.role}</span></td>
      <td className="adm-cell-muted" style={{ whiteSpace: 'nowrap' }}>
        {user.proposal_count} {user.proposal_count === 1 ? t('proposal', 'предложение') : t('proposals', 'предложений')}
      </td>
      <td className="adm-cell-muted" style={{ whiteSpace: 'nowrap' }}>{formatDate(user.created_at)}</td>
      <td className="adm-cell-muted" style={{ whiteSpace: 'nowrap' }}>
        {user.last_sign_in ? formatDate(user.last_sign_in) : '—'}
      </td>
      <td className="adm-right">
        <button ref={btnRef} className="adm-dots" disabled={loading} aria-label="Actions"
          onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}>⋯</button>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div className="adm-menu" style={{ top: menuPos.top, left: menuPos.left }}>
              {/* смена роли — только для других (свою роль не трогаем) */}
              {!isSelf && (['manager', 'admin', 'accountant'] as const).filter((r) => r !== user.role).map((r) => (
                <button key={r} className="adm-menu-item" onClick={() => handleSetRole(r)}>
                  {t('Make', 'Назначить')} {r}
                </button>
              ))}

              {/* имя и email — можно и себе */}
              <button className="adm-menu-item" onClick={handleRename}>{t('Rename', 'Переименовать')}</button>
              <button className="adm-menu-item" onClick={handleChangeEmail}>{t('Change email / login', 'Сменить email / логин')}</button>
              <button className="adm-menu-item" onClick={handleMsEmail}>{t('Microsoft email (sync)', 'Microsoft email (синхронизация)')}</button>

              {/* сброс пароля и удаление — только для других */}
              {!isSelf && (
                <>
                  <button className="adm-menu-item" onClick={handleResetPassword}>{t('Reset password', 'Сбросить пароль')}</button>
                  <button className="adm-menu-item danger" onClick={handleDelete}>{t('Delete user', 'Удалить пользователя')}</button>
                </>
              )}
            </div>
          </>
        )}
      </td>
    </tr>
  )
}
