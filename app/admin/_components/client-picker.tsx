'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n-client'

export type PickerClient = {
  id: string
  name: string
  client_code: string | null
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: '14px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

export default function ClientPicker({
  clients, value, onChange, returnTo,
}: {
  clients: PickerClient[]
  value: string                 // client_id или ''
  onChange: (clientId: string) => void
  returnTo: string              // куда вернуться после создания клиента
}) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  const selected = clients.find((c) => c.id === value) || null

  // фильтрация по имени и коду
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => {
      const hay = `${c.name} ${c.client_code || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [clients, query])

  // закрытие по клику вне
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function pick(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  function goCreateClient() {
    // создаём клиента и возвращаемся сюда же
    const url = `/admin/clients/new?returnTo=${encodeURIComponent(returnTo)}`
    router.push(url)
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      {/* Кнопка-поле */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          ...inputStyle,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <span style={{ color: selected ? 'var(--admin-text)' : 'var(--admin-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected
            ? `${selected.name}${selected.client_code ? ` · ${selected.client_code}` : ''}`
            : t('— No client —', '— Без клиента —')}
        </span>
        <span style={{ color: 'var(--admin-text-muted)', fontSize: '11px', flexShrink: 0 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
          background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
          borderRadius: '8px', zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
          {/* Поиск */}
          <div style={{ padding: '8px', borderBottom: '1px solid var(--admin-border-card)' }}>
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Search by name or code…', 'Поиск по имени или коду…')}
              style={{ ...inputStyle, padding: '8px 10px', fontSize: '13px' }}
            />
          </div>

          {/* Список */}
          <div style={{ maxHeight: '260px', overflowY: 'auto', padding: '4px' }}>
            <button
              type="button"
              onClick={() => pick('')}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px',
                background: 'transparent', border: 'none', fontSize: '13px', borderRadius: '4px',
                cursor: 'pointer', fontFamily: 'inherit', color: 'var(--admin-text-muted)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {t('— No client —', '— Без клиента —')}
            </button>

            {filtered.length === 0 ? (
              <div style={{ padding: '14px 10px', fontSize: '13px', color: 'var(--admin-text-muted)', textAlign: 'center' }}>
                {t('Nothing found', 'Ничего не найдено')}
              </div>
            ) : (
              filtered.map((c) => {
                const isSel = c.id === value
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pick(c.id)}
                    style={{
                      display: 'flex', width: '100%', textAlign: 'left', padding: '9px 10px',
                      background: isSel ? 'var(--admin-card)' : 'transparent', border: 'none',
                      fontSize: '13px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit',
                      color: 'var(--admin-text)', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isSel ? 'var(--admin-card)' : 'transparent' }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name || t('Untitled', 'Без названия')}
                    </span>
                    {c.client_code && (
                      <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', flexShrink: 0 }}>
                        {c.client_code}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* Создать клиента */}
          <div style={{ borderTop: '1px solid var(--admin-border-card)', padding: '4px' }}>
            <button
              type="button"
              onClick={goCreateClient}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px',
                background: 'transparent', border: 'none', fontSize: '13px', borderRadius: '4px',
                cursor: 'pointer', fontFamily: 'inherit', color: 'var(--admin-accent)', fontWeight: 500,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {t('+ Create new client', '+ Создать нового клиента')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}