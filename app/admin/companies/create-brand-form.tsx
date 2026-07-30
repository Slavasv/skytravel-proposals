'use client'

import { useState } from 'react'
import { createBrand } from './actions'
import { useT } from '@/lib/i18n-client'

export default function CreateBrandForm() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createBrand(name, slug, ownerEmail, ownerPassword)
      setName('')
      setSlug('')
      setOwnerEmail('')
      setOwnerPassword('')
      setOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Failed to create brand', 'Ошибка создания бренда'))
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: '14px',
    background: 'var(--admin-card)',
    border: '1px solid var(--admin-border)',
    borderRadius: '6px',
    color: 'var(--admin-text)',
    fontFamily: 'inherit',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--admin-text-muted)',
    marginBottom: '4px',
    display: 'block',
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
          marginBottom: '24px',
        }}
      >
        {t('+ New brand', '+ Новый бренд')}
      </button>
    )
  }

  return (
    <div style={{
      padding: '20px',
      border: '1px solid var(--admin-border-card)',
      borderRadius: '8px',
      background: 'var(--admin-input)',
      marginBottom: '24px',
    }}>
      <h2 style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>
        {t('New brand', 'Новый бренд')}
      </h2>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>{t('Brand name', 'Название бренда')}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="TIGU" required autoFocus style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={labelStyle}>{t('Slug (Latin letters, no spaces)', 'Slug (латиницей, без пробелов)')}</label>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="tigu" required style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          </div>

          <div style={{ height: '1px', background: 'var(--admin-border-card)', margin: '4px 0' }} />
          <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-faint)' }}>
            {t('Brand owner', 'Владелец бренда')}
          </div>

          <div>
            <label style={labelStyle}>{t('Login email', 'Email для входа')}</label>
            <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@tigu.com" required style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={labelStyle}>{t('Password (at least 6 characters)', 'Пароль (от 6 символов)')}</label>
            <input type="text" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder={t('password to hand over to the owner', 'пароль для передачи владельцу')} required style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--admin-danger)', fontSize: '13px', marginTop: '12px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button
            type="submit"
            disabled={loading || !name || !slug || !ownerEmail || !ownerPassword}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 500,
              background: 'var(--admin-text-on-dark)',
              color: 'var(--admin-dark-panel)',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading || !name || !slug || !ownerEmail || !ownerPassword ? 0.4 : 1,
              fontFamily: 'inherit',
            }}
          >
            {loading ? t('Creating…', 'Создание…') : t('Create brand', 'Создать бренд')}
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