'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase-client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createSupabaseBrowser()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError('Invalid email or password')
      setLoading(false)
    } else {
      router.push(from)
      router.refresh()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: '400px',
        width: '100%',
        padding: '40px 32px',
        border: '1px solid #E5E2DA',
        borderRadius: '12px',
        background: '#fff',
      }}
    >
      <div style={{
        fontSize: '11px',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#888780',
        marginBottom: '10px',
        fontWeight: 500,
      }}>
        Travel System
      </div>
      <h1 style={{
        fontSize: '24px',
        fontWeight: 500,
        margin: '0 0 28px',
        color: '#2C2C2A',
        letterSpacing: '-0.01em',
      }}>
        Administrator access
      </h1>

      <div style={{ marginBottom: '12px' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          autoFocus
          style={{
            width: '100%',
            padding: '13px 14px',
            fontSize: '15px',
            color: '#2C2C2A',
            border: '1px solid #D3D1C7',
            borderRadius: '8px',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            outline: 'none',
            background: '#fff',
          }}
        />
      </div>

      <div style={{ position: 'relative', marginBottom: error ? '8px' : '16px' }}>
        <input
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          style={{
            width: '100%',
            padding: '13px 44px 13px 14px',
            fontSize: '15px',
            color: '#2C2C2A',
            border: '1px solid #D3D1C7',
            borderRadius: '8px',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            outline: 'none',
            background: '#fff',
          }}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            color: '#888780',
            fontSize: '13px',
            fontFamily: 'inherit',
          }}
        >
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>

      {error && (
        <div style={{
          color: '#A32D2D',
          fontSize: '13px',
          marginBottom: '16px',
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !email || !password}
        style={{
          width: '100%',
          padding: '13px',
          fontSize: '14px',
          fontWeight: 500,
          letterSpacing: '0.04em',
          background: '#2C2C2A',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading || !email || !password ? 0.4 : 1,
          fontFamily: 'inherit',
          transition: 'opacity 0.15s',
        }}
      >
        {loading ? 'Verifying...' : 'Enter'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui',
      padding: '20px',
      background: '#FAF8F4',
    }}>
      <Suspense fallback={<div />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}