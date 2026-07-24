'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
export type PickerPartner = {
  id: string
  name: string
  service_type: string | null
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: '13px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '4px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

export default function PartnerPicker({
  partners, value, onChange, preferType, returnTo,
}: {
  partners: PickerPartner[]
  value: string
  onChange: (partnerId: string) => void
  preferType?: string | null   // тип услуги — такие партнёры идут первыми
  returnTo?: string            // куда вернуться после создания партнёра
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  const selected = partners.find((p) => p.id === value) || null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? partners.filter((p) => `${p.name} ${p.service_type || ''}`.toLowerCase().includes(q))
      : partners
    // подходящие по типу — наверх
    return [...list].sort((a, b) => {
      if (preferType) {
        const am = a.service_type === preferType ? 0 : 1
        const bm = b.service_type === preferType ? 0 : 1
        if (am !== bm) return am - bm
      }
      return a.name.localeCompare(b.name)
    })
  }, [partners, query, preferType])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function pick(id: string) {
    onChange(id); setOpen(false); setQuery('')
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ ...inputStyle, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
        <span style={{ color: selected ? 'var(--admin-text)' : 'var(--admin-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.name : '— none —'}
        </span>
        <span style={{ color: 'var(--admin-text-muted)', fontSize: '10px', flexShrink: 0 }}>▾</span>
      </button>

      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: 'var(--admin-input)', border: '1px solid var(--admin-border)', borderRadius: '8px', zIndex: 40, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden', minWidth: '240px' }}>
          <div style={{ padding: '8px', borderBottom: '1px solid var(--admin-border-card)' }}>
            <input type="text" autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search partners…" style={{ ...inputStyle, fontSize: '12px' }} />
          </div>

          <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '4px' }}>
            <button type="button" onClick={() => pick('')}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'transparent', border: 'none', fontSize: '12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--admin-text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
              — none —
            </button>

            {filtered.length === 0 ? (
              <div style={{ padding: '12px 10px', fontSize: '12px', color: 'var(--admin-text-muted)', textAlign: 'center' }}>
                Nothing found
              </div>
            ) : (
              filtered.map((p) => (
                <button key={p.id} type="button" onClick={() => pick(p.id)}
                  style={{ display: 'flex', width: '100%', textAlign: 'left', padding: '8px 10px', background: p.id === value ? 'var(--admin-card)' : 'transparent', border: 'none', fontSize: '12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--admin-text)', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = p.id === value ? 'var(--admin-card)' : 'transparent' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  {p.service_type && (
                    <span style={{ fontSize: '10px', color: 'var(--admin-text-muted)', flexShrink: 0 }}>{p.service_type}</span>
                  )}
                </button>
              ))
            )}
          </div>

          {returnTo && (
            <div style={{ borderTop: '1px solid var(--admin-border-card)', padding: '4px' }}>
              <button type="button"
                onClick={() => router.push(`/admin/partners/new?returnTo=${encodeURIComponent(returnTo)}`)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', background: 'transparent', border: 'none', fontSize: '12px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--admin-accent)', fontWeight: 500 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                + Create new partner
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}