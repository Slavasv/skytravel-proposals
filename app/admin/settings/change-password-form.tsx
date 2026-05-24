'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-client'

export default function ChangePasswordForm() {
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
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
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
    background: '#0f0f0f',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#E5E2DA',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  }

  return (
    <form onSubmit={handleSubmit} style={{
      padding: '20px',
      border: '1px solid #2A2A28',
      borderRadius: '8px',
      background: '#1a1a1a',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            required
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888780', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            required
            style={inputStyle}
          />
        </div>
      </div>

      {error && (
        <div style={{ color: '#E07B7B', fontSize: '13px', marginTop: '10px' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ color: '#7AA876', fontSize: '13px', marginTop: '10px' }}>
          Password updated successfully.
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
          background: '#FAF8F4',
          color: '#2C2C2A',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading || !password || !confirm ? 0.4 : 1,
          fontFamily: 'inherit',
        }}
      >
        {loading ? 'Saving...' : 'Update password'}
      </button>
    </form>
  )
}