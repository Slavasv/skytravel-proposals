'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n-client'
import { createSupabaseBrowser } from '@/lib/supabase-client'

export default function ChangePasswordForm() {
  const t = useT()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (password !== confirm) {
      setError(t('Passwords do not match', 'Пароли не совпадают'))
      return
    }

    if (password.length < 6) {
      setError(t('Password must be at least 6 characters', 'Пароль должен содержать не менее 6 символов'))
      return
    }

    setLoading(true)
    const supabase = createSupabaseBrowser()
    const { error: authError } = await supabase.auth.updateUser({ password })

    if (authError) {
      setError(authError.message)
    } else {
      setSuccess(true)
      setPassword('')
      setConfirm('')
    }
    setLoading(false)
  }

  const inputStyle = {
    padding: '10px 12px',
    fontSize: '14px',
    background: 'var(--admin-card)',
    border: '1px solid var(--admin-border)',
    borderRadius: '6px',
    color: 'var(--admin-text)',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  }

  return (
    <form onSubmit={handleSubmit} style={{
      padding: '20px',
      border: '1px solid var(--admin-border-card)',
      borderRadius: '8px',
      background: 'var(--admin-input)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('New password', 'Новый пароль')}
            required
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}
          >
            {showPassword ? t('Hide', 'Скрыть') : t('Show', 'Показать')}
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={t('Confirm password', 'Подтвердите пароль')}
            required
            style={inputStyle}
          />
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--admin-danger)', fontSize: '13px', marginTop: '10px' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ color: 'var(--admin-success)', fontSize: '13px', marginTop: '10px' }}>
          {t('Password updated successfully.', 'Пароль успешно обновлён.')}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !password || !confirm}
        style={{
          marginTop: '16px',
          padding: '10px 18px',
          fontSize: '13px',
          fontWeight: 500,
          background: 'var(--admin-text-on-dark)',
          color: 'var(--admin-dark-panel)',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading || !password || !confirm ? 0.4 : 1,
          fontFamily: 'inherit',
        }}
      >
        {loading ? t('Saving...', 'Сохранение...') : t('Update password', 'Обновить пароль')}
      </button>
    </form>
  )
}