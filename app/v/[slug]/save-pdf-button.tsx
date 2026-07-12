'use client'

import { useState } from 'react'

export default function SavePdfButton({ slug, bgUrl }: { slug: string; bgUrl?: string }) {
  const [busy, setBusy] = useState(false)

  async function handleSave() {
    if (busy) return
    setBusy(true)
    try {
      const bgParam = bgUrl ? `&bg=${encodeURIComponent(bgUrl)}` : ''
      const res = await fetch(`/api/pdf?slug=${encodeURIComponent(slug)}`)
      if (!res.ok) throw new Error('PDF request failed')

      // Имя файла берём из заголовка ответа (сервер собрал красивое имя)
      let fileName = `${slug || 'voucher'}.pdf`
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
      alert('Could not generate PDF. Please try again.')
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
        {busy ? 'Generating…' : '↓ Save PDF'}
      </button>
    </div>
  )
}