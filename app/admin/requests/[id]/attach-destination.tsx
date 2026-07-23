'use client'

import { useState, useRef, useEffect, useMemo, useTransition } from 'react'
import { attachProposalToRequest, createDestinationFromRequest, type DestinationOption } from '../actions'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: '14px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

export default function AttachDestination({
  requestId, options, attachedIds,
}: {
  requestId: string
  options: DestinationOption[]
  attachedIds: string[]
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  const boxRef = useRef<HTMLDivElement>(null)

  const available = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options
      .filter((o) => !attachedIds.includes(o.id))
      .filter((o) => {
        if (!q) return true
        const hay = `${o.trip_title_ru || ''} ${o.trip_title_en || ''}`.toLowerCase()
        return hay.includes(q)
      })
  }, [options, attachedIds, query])

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

  function handleAttach(id: string) {
    setOpen(false); setQuery('')
    startTransition(async () => { await attachProposalToRequest(requestId, id) })
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} disabled={isPending}
        style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: isPending ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: isPending ? 0.5 : 1 }}>
        {isPending ? 'Attaching…' : 'Attach destination ▾'}
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: '320px', background: 'var(--admin-input)', border: '1px solid var(--admin-border)', borderRadius: '8px', zIndex: 30, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
          <div style={{ padding: '8px', borderBottom: '1px solid var(--admin-border-card)' }}>
            <input type="text" autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search destinations…" style={{ ...inputStyle, padding: '8px 10px', fontSize: '13px' }} />
          </div>

          <div style={{ maxHeight: '260px', overflowY: 'auto', padding: '4px' }}>
            {available.length === 0 ? (
              <div style={{ padding: '14px 10px', fontSize: '13px', color: 'var(--admin-text-muted)', textAlign: 'center' }}>
                {options.length === 0 ? 'No destinations yet' : 'Nothing found'}
              </div>
            ) : (
              available.map((o) => (
                <button key={o.id} type="button" onClick={() => handleAttach(o.id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', background: 'transparent', border: 'none', fontSize: '13px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--admin-text)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                  {o.trip_title_ru || o.trip_title_en || 'Untitled destination'}
                </button>
              ))
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--admin-border-card)', padding: '4px' }}>
            <form action={createDestinationFromRequest.bind(null, requestId)}>
              <button type="submit"
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px', background: 'transparent', border: 'none', fontSize: '13px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--admin-accent)', fontWeight: 500 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                + Create new destination
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}