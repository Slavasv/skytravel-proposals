'use client'

import { useState } from 'react'
import { useIsMobile } from '@/lib/use-is-mobile'
import { useT } from '@/lib/i18n-client'

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
  const t = useT()
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
      window.prompt(t('Copy this link:', 'Скопируйте эту ссылку:'), url)
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
        title={t('Open Russian version in a new tab', 'Открыть русскую версию в новой вкладке')}
      >
        {t('↗ Preview RU', '↗ Просмотр RU')}
      </button>
      <button
        type="button"
        onClick={() => openPreview('en')}
        style={buttonStyle}
        title={t('Open English version in a new tab', 'Открыть английскую версию в новой вкладке')}
      >
        {t('↗ Preview EN', '↗ Просмотр EN')}
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
        {copiedKey === 'ru' ? t('✓ Copied', '✓ Скопировано') : t('Copy RU link', 'Копировать ссылку RU')}
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
        {copiedKey === 'en' ? t('✓ Copied', '✓ Скопировано') : t('Copy EN link', 'Копировать ссылку EN')}
      </button>
    </div>
  )
}