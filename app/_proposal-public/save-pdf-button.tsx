'use client'

import { useState } from 'react'

// Кнопка «Скачать PDF» для публичной страницы пропожуала/дестинейшна.
// Стиль — как у ваучера (app/v/[slug]/save-pdf-button.tsx). Дёргает /api/doc-pdf,
// который через puppeteer рендерит эту же страницу с ?print=1.
export default function SavePdfButton({
  slug,
  kind,
  lang,
}: {
  slug: string
  kind: 'p' | 'd'
  lang: 'ru' | 'en'
}) {
  const [busy, setBusy] = useState(false)

  async function handleSave() {
    if (busy) return
    setBusy(true)
    try {
      const q = new URLSearchParams({ slug, kind, lang })
      const res = await fetch(`/api/doc-pdf?${q.toString()}`)
      if (!res.ok) throw new Error('PDF request failed')

      let fileName = `${slug || 'document'}.pdf`
      const cd = res.headers.get('Content-Disposition') || ''
      const star = cd.match(/filename\*=UTF-8''([^;]+)/i)
      const plain = cd.match(/filename="([^"]+)"/i)
      if (star?.[1]) fileName = decodeURIComponent(star[1])
      else if (plain?.[1]) fileName = decodeURIComponent(plain[1])

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('PDF download failed:', e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="no-print" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 100 }}>
      <button
        type="button"
        onClick={handleSave}
        disabled={busy}
        style={{
          padding: '10px 20px', fontSize: '13px', fontWeight: 500, letterSpacing: '0.03em',
          background: '#2C2C2A', color: '#FAF8F4', border: 'none', borderRadius: '8px',
          cursor: busy ? 'wait' : 'pointer', fontFamily: 'system-ui, sans-serif',
          boxShadow: '0 2px 12px rgba(0,0,0,0.15)', opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? (lang === 'ru' ? 'Готовим…' : 'Generating…') : (lang === 'ru' ? '↓ Сохранить PDF' : '↓ Save PDF')}
      </button>
    </div>
  )
}