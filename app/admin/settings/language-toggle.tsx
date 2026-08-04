'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setUiLanguage } from './language-actions'
import type { UiLang } from '@/lib/i18n'

// Названия языков показываем на самих языках — так принято у переключателей.
const OPTIONS: { value: UiLang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
]

export default function LanguageToggle({ current }: { current: UiLang }) {
  const [lang, setLang] = useState<UiLang>(current)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function choose(next: UiLang) {
    if (next === lang || saving) return
    setLang(next)
    setSaving(true)
    const res = await setUiLanguage(next)
    if (!res.ok) setLang(current) // откат при ошибке
    router.refresh() // перерисовать layout на новом языке
    setSaving(false)
  }

  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--admin-border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '32px' }}>
      {OPTIONS.map((opt) => {
        const active = opt.value === lang
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => choose(opt.value)}
            disabled={saving}
            style={{
              padding: '9px 20px',
              fontSize: '13px',
              fontFamily: 'inherit',
              cursor: saving ? 'wait' : 'pointer',
              border: 'none',
              background: active ? 'var(--admin-text-on-dark)' : 'transparent',
              color: active ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)',
              fontWeight: active ? 600 : 400,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
