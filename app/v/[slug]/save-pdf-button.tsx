'use client'

import { useState } from 'react'

export default function SavePdfButton({ slug }: { slug: string }) {
  const [busy, setBusy] = useState(false)

  async function handleSave() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/v/${slug}/pdf`)
      if (!res.ok) throw new Error('PDF request failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${slug || 'voucher'}.pdf`
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