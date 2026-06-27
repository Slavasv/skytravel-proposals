'use client'

import { useState } from 'react'
import { useIsMobile } from '@/lib/use-is-mobile'

type Props = {
  slug: string
  kind?: 'individual' | 'destination'
}

const buttonStyle: React.CSSProperties = {
  padding: '7px 14px',
  fontSize: '12px',
  fontWeight: 500,
  letterSpacing: '0.03em',
  background: 'transparent',
  color: 'var(--admin-text)',
  border: '1px solid var(--admin-border)',
  borderRadius: '6px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s, color 0.15s',
}

export default function ProposalActions({ slug, kind = 'individual' }: Props) {
  const [copiedKey, setCopiedKey] = useState<'ru' | 'en' | null>(null)
  const isMobile = useIsMobile()

  const base = kind === 'destination' ? 'd' : 'p'

  function getOrigin() {
    if (typeof window === 'undefined') return ''
    return window.location.origin
  }

  function openPreview(lang: 'ru' | 'en') {
    const path = lang === 'ru' ? `/${base}/${slug}` : `/en/${base}/${slug}`
    window.open(path, '_blank', 'noopener,noreferrer')
  }

  async function copyLink(lang: 'ru' | 'en') {
    const path = lang === 'ru' ? `/${base}/${slug}` : `/en/${base}/${slug}`
    const url = `${getOrigin()}${path}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedKey(lang)
      setTimeout(() => setCopiedKey((k) => (k === lang ? null : k)), 1800)
    } catch {
      // Fallback: показать prompt с URL
      window.prompt('Copy this link:', url)
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, auto)',
      gap: '8px',
      width: isMobile ? '100%' : 'auto',
    }}>
      <button
        type="button"
        onClick={() => openPreview('ru')}
        style={buttonStyle}
        title="Open Russian version in a new tab"
      >
        ↗ Preview RU
      </button>
      <button
        type="button"
        onClick={() => openPreview('en')}
        style={buttonStyle}
        title="Open English version in a new tab"
      >
        ↗ Preview EN
      </button>
      <button
        type="button"
        onClick={() => copyLink('ru')}
        style={{
          ...buttonStyle,
          color: copiedKey === 'ru' ? 'var(--admin-success)' : 'var(--admin-text)',
          borderColor: copiedKey === 'ru' ? 'var(--admin-success)' : 'var(--admin-border)',
        }}
      >
        {copiedKey === 'ru' ? '✓ Copied' : 'Copy RU link'}
      </button>
      <button
        type="button"
        onClick={() => copyLink('en')}
        style={{
          ...buttonStyle,
          color: copiedKey === 'en' ? 'var(--admin-success)' : 'var(--admin-text)',
          borderColor: copiedKey === 'en' ? 'var(--admin-success)' : 'var(--admin-border)',
        }}
      >
        {copiedKey === 'en' ? '✓ Copied' : 'Copy EN link'}
      </button>
    </div>
  )
}