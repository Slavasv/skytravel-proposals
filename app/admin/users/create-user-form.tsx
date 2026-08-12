'use client'

import { useState } from 'react'
import { createUser } from './actions'
import { useT } from '@/lib/i18n-client'

export default function CreateUserForm() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'manager' | 'admin' | 'accountant'>('manager')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createUser(email, password, role, name)
      setName('')
      setEmail('')
      setPassword('')
      setRole('manager')
      setOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Error creating user', 'Ошибка при создании пользователя'))
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: '10px 18px',
          fontSize: '13px',
          fontWeight: 500,
          letterSpacing: '0.03em',
          background: 'var(--admin-text-on-dark)',
          color: 'var(--admin-dark-panel)',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {t('+ New user', '+ Новый пользователь')}
      </button>
    )
  }

  return (
    <div style={{
      padding: '20px',
      border: '1px solid var(--admin-border-card)',
      borderRadius: '8px',
      background: 'var(--admin-input)',
    }}>
      <h2 style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>
        {t('New user', 'Новый пользователь')}
      </h2>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('Name (e.g. Sergey M.)', 'Имя (напр. Сергей М.)')}
            autoFocus
            style={{
              padding: '10px 12px',
              fontSize: '14px',
              background: 'var(--admin-card)',
              border: '1px solid var(--admin-border)',
              borderRadius: '6px',
              color: 'var(--admin-text)',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('Email', 'Email')}
            required
            style={{
              padding: '10px 12px',
              fontSize: '14px',
              background: 'var(--admin-card)',
              border: '1px solid var(--admin-border)',
              borderRadius: '6px',
              color: 'var(--admin-text)',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('Password', 'Пароль')}
            required
            style={{
              padding: '10px 12px',
              fontSize: '14px',
              background: 'var(--admin-card)',
              border: '1px solid var(--admin-border)',
              borderRadius: '6px',
              color: 'var(--admin-text)',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'manager' | 'admin' | 'accountant')}
            style={{
              padding: '10px 12px',
              fontSize: '14px',
              background: 'var(--admin-card)',
              border: '1px solid var(--admin-border)',
              borderRadius: '6px',
              color: 'var(--admin-text)',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          >
            <option value="manager">{t('Manager', 'Менеджер')}</option>
            <option value="admin">{t('Admin', 'Администратор')}</option>
            <option value="accountant">{t('Accountant', 'Бухгалтер')}</option>
          </select>
        </div>

        {error && (
          <div style={{ color: 'var(--admin-danger)', fontSize: '13px', marginTop: '10px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 500,
              background: 'var(--admin-text-on-dark)',
              color: 'var(--admin-dark-panel)',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading || !email || !password ? 0.4 : 1,
              fontFamily: 'inherit',
            }}
          >
            {loading ? t('Creating...', 'Создание...') : t('Create user', 'Создать пользователя')}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setError('') }}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              background: 'none',
              color: 'var(--admin-text-muted)',
              border: '1px solid var(--admin-border)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t('Cancel', 'Отмена')}
          </button>
        </div>
      </form>
    </div>
  )
}