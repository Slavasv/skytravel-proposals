'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateVoucherSlug } from './voucher-actions'

// живая чистка слага (дублирует серверную для мгновенного отклика)
function cleanSlugLive(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

const btn: React.CSSProperties = {
  padding: '8px 14px', fontSize: '12px', fontWeight: 500, letterSpacing: '0.03em',
  background: 'transparent', color: 'var(--admin-text)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', marginBottom: '6px', fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: '14px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

export default function VoucherActions({ voucherId, initialSlug }: { voucherId: string; initialSlug: string }) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [slug, setSlug] = useState(initialSlug)
  const [savedSlug, setSavedSlug] = useState(initialSlug)
  const [slugState, setSlugState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [slugError, setSlugError] = useState('')
  const [copied, setCopied] = useState(false)

  const origin = mounted ? window.location.origin : ''
  const url = `${origin}/v/${savedSlug}`
  const displayUrl = mounted ? url : `/v/${savedSlug}`

  async function saveSlug() {
    if (slug === savedSlug) return
    setSlugState('saving')
    setSlugError('')
    const res = await updateVoucherSlug(voucherId, slug)
    if (res.ok && res.slug) {
      setSavedSlug(res.slug)
      setSlug(res.slug)
      setSlugState('saved')
      setTimeout(() => setSlugState('idle'), 1500)
    } else {
      setSlugError(res.error || 'Failed to save')
      setSlugState('error')
    }
  }

  function openPreview() {
    window.open(`/v/${savedSlug}`, '_blank', 'noopener,noreferrer')
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Слаг */}
      <div>
        <label style={labelStyle}>Link address</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(cleanSlugLive(e.target.value))}
            onBlur={saveSlug}
            style={inputStyle}
            placeholder="pertsev-family"
          />
          {slugState === 'saving' && <span style={{ fontSize: '12px', color: 'var(--admin-accent)', whiteSpace: 'nowrap' }}>Saving…</span>}
          {slugState === 'saved' && <span style={{ fontSize: '12px', color: 'var(--admin-success)', whiteSpace: 'nowrap' }}>✓ Saved</span>}
        </div>
        {slugState === 'error' && <div style={{ fontSize: '12px', color: 'var(--admin-danger)', marginTop: '6px' }}>{slugError}</div>}
        <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '6px' }}>Client link: {displayUrl}</div>
      </div>

      {/* Кнопки */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={openPreview} style={btn} title="Open the voucher in a new tab">↗ Preview</button>
        <button
          type="button"
          onClick={copyLink}
          style={{ ...btn, color: copied ? 'var(--admin-success)' : 'var(--admin-text)', borderColor: copied ? 'var(--admin-success)' : 'var(--admin-border)' }}
        >
          {copied ? '✓ Copied' : 'Copy link'}
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => router.push('/admin/vouchers')}
          style={{
            padding: '10px 24px', fontSize: '13px', fontWeight: 500, letterSpacing: '0.03em',
            background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Done
        </button>
      </div>
    </div>
  )
}