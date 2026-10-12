'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { deleteUser, resetPassword, toggleRole, updateUserName, updateUserEmail, updateUserMsEmail, setBrandAccess } from './actions'
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

type BrandLite = { id: string; name: string }

export default function UserRow({ user, currentUserId, brands = [], assignedBrands = [] }: {
  user: User
  currentUserId: string
  brands?: BrandLite[]
  assignedBrands?: string[]
}) {
  const t = useT()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [loading, setLoading] = useState(false)
  const [brandsOpen, setBrandsOpen] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set(assignedBrands))
  const btnRef = useRef<HTMLButtonElement>(null)

  const isSelf = user.id === currentUserId
  const multiBrand = brands.length > 1

  async function saveBrands() {
    setLoading(true); setBrandsOpen(false)
    const res = await setBrandAccess(user.id, Array.from(sel))
    setLoading(false)
    if (!res.ok) alert(`${t('Error', 'Ошибка')}: ${res.error || ''}`)
    else router.refresh()
  }

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
              {multiBrand && (
                <button className="adm-menu-item" onClick={() => { setMenuOpen(false); setSel(new Set(assignedBrands)); setBrandsOpen(true) }}>
                  {t('Brand access', 'Доступ к брендам')}
                </button>
              )}

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

      {brandsOpen && (
        <td style={{ position: 'fixed', inset: 0, zIndex: 50, padding: 0 }}>
          <div onClick={() => setBrandsOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(380px, 92vw)', background: 'var(--admin-card)', border: '1px solid var(--admin-border-card)', borderRadius: '12px', padding: '18px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600 }}>{t('Brand access', 'Доступ к брендам')}</h3>
            <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--admin-text-muted)' }}>{user.name || user.email}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {brands.map((b) => {
                const on = sel.has(b.id)
                return (
                  <button key={b.id} type="button"
                    onClick={() => setSel((s) => { const n = new Set(s); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n })}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 11px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', border: `1px solid ${on ? 'var(--admin-accent)' : 'var(--admin-border-card)'}`, background: on ? 'var(--admin-hover)' : 'transparent' }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '5px', flex: 'none', border: `1.6px solid ${on ? 'var(--admin-accent)' : 'var(--admin-text-faint)'}`, background: on ? 'var(--admin-accent)' : 'transparent', color: '#20242c', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
                    <span style={{ fontSize: '13.5px', color: 'var(--admin-text)' }}>{b.name}</span>
                  </button>
                )
              })}
            </div>
            <p style={{ margin: '12px 0 0', fontSize: '11px', color: 'var(--admin-text-faint)' }}>
              {t('The user’s home brand always stays on.', 'Основной бренд сотрудника всегда остаётся включённым.')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" onClick={() => setBrandsOpen(false)} style={{ padding: '9px 14px', fontSize: '13px', background: 'transparent', border: '1px solid var(--admin-border)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--admin-text-muted)' }}>{t('Cancel', 'Отмена')}</button>
              <button type="button" onClick={saveBrands} style={{ padding: '9px 16px', fontSize: '13px', fontWeight: 600, background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>{t('Save', 'Сохранить')}</button>
            </div>
          </div>
        </td>
      )}
    </tr>
  )
}
