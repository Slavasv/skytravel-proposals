'use client'

import { useState } from 'react'
import { createBrand } from './actions'

export default function CreateBrandForm() {
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
      setError(err instanceof Error ? err.message : 'Ошибка создания бренда')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: '14px',
    background: '#0f0f0f',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#E5E2DA',
    fontFamily: 'inherit',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#888780',
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
          background: '#FAF8F4',
          color: '#2C2C2A',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: '24px',
        }}
      >
        + Новый бренд
      </button>
    )
  }

  return (
    <div style={{
      padding: '20px',
      border: '1px solid #2A2A28',
      borderRadius: '8px',
      background: '#1a1a1a',
      marginBottom: '24px',
    }}>
      <h2 style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 16px', color: '#E5E2DA' }}>
        Новый бренд
      </h2>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Название бренда</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="TIGU" required autoFocus style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={labelStyle}>Slug (латиницей, без пробелов)</label>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="tigu" required style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          </div>

          <div style={{ height: '1px', background: '#2A2A28', margin: '4px 0' }} />
          <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#555' }}>
            Владелец бренда
          </div>

          <div>
            <label style={labelStyle}>Email для входа</label>
            <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@tigu.com" required style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={labelStyle}>Пароль (от 6 символов)</label>
            <input type="text" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="пароль для передачи владельцу" required style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          </div>
        </div>

        {error && (
          <div style={{ color: '#E07B7B', fontSize: '13px', marginTop: '12px' }}>
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
              background: '#FAF8F4',
              color: '#2C2C2A',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading || !name || !slug || !ownerEmail || !ownerPassword ? 0.4 : 1,
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Создание...' : 'Создать бренд'}
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setError('') }}
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              background: 'none',
              color: '#888780',
              border: '1px solid #333',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}