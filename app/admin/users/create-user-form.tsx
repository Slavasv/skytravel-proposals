'use client'

import { useState } from 'react'
import { createUser } from './actions'

export default function CreateUserForm() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'manager' | 'admin'>('manager')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createUser(email, password, role)
      setEmail('')
      setPassword('')
      setRole('manager')
      setOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating user')
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
          background: '#FAF8F4',
          color: '#2C2C2A',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        + New user
      </button>
    )
  }

  return (
    <div style={{
      padding: '20px',
      border: '1px solid #2A2A28',
      borderRadius: '8px',
      background: '#1a1a1a',
    }}>
      <h2 style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 16px', color: '#E5E2DA' }}>
        New user
      </h2>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoFocus
            style={{
              padding: '10px 12px',
              fontSize: '14px',
              background: '#0f0f0f',
              border: '1px solid #333',
              borderRadius: '6px',
              color: '#E5E2DA',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            style={{
              padding: '10px 12px',
              fontSize: '14px',
              background: '#0f0f0f',
              border: '1px solid #333',
              borderRadius: '6px',
              color: '#E5E2DA',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'manager' | 'admin')}
            style={{
              padding: '10px 12px',
              fontSize: '14px',
              background: '#0f0f0f',
              border: '1px solid #333',
              borderRadius: '6px',
              color: '#E5E2DA',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          >
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {error && (
          <div style={{ color: '#E07B7B', fontSize: '13px', marginTop: '10px' }}>
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
              background: '#FAF8F4',
              color: '#2C2C2A',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading || !email || !password ? 0.4 : 1,
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Creating...' : 'Create user'}
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
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}