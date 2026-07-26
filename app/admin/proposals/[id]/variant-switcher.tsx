'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createVariant, selectVariant, deleteVariant, updateVariant } from './variant-actions'
import type { Lang } from './edit-page-client'

export type VariantBrief = {
  id: string
  sort_order: number
  name_ru: string | null
  name_en: string | null
  subtitle_ru: string | null
  subtitle_en: string | null
  is_selected: boolean
  total_price: number | null
}

export default function VariantSwitcher({
  proposalId, variants, activeVariantId, lang,
}: {
  proposalId: string
  variants: VariantBrief[]
  activeVariantId: string | null
  lang: Lang
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function switchTo(variantId: string) {
    router.push(`/admin/proposals/${proposalId}?variant=${variantId}`, { scroll: false })
  }

  function handleCreate() {
    startTransition(async () => {
     const newId = await createVariant(proposalId)
      if (newId) router.push(`/admin/proposals/${proposalId}?variant=${newId}`, { scroll: false })
    })
  }

  function handleSelect(variantId: string) {
    startTransition(async () => {
      await selectVariant(proposalId, variantId)
      router.refresh()
    })
  }

  function handleDelete(variantId: string) {
    if (!confirm('Delete this variant and all its days? This cannot be undone.')) return
    startTransition(async () => {
      try {
        await deleteVariant(proposalId, variantId)
        // после удаления — на первый оставшийся
        const remaining = variants.filter((v) => v.id !== variantId)
        const next = remaining[0]?.id
        router.push(next ? `/admin/proposals/${proposalId}?variant=${next}` : `/admin/proposals/${proposalId}`)
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Failed to delete')
      }
    })
  }

  const only = variants.length <= 1
  const active = variants.find((v) => v.id === activeVariantId)

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: only ? 0 : '10px' }}>
        {!only && variants.map((v) => {
          const isActive = v.id === activeVariantId
          const name = (lang === 'ru' ? v.name_ru : v.name_en) || (lang === 'ru' ? v.name_en : v.name_ru) || 'Route'
          return (
            <button key={v.id} type="button" onClick={() => switchTo(v.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', fontSize: '13px', fontWeight: 500,
                borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
                background: isActive ? 'var(--admin-text-on-dark)' : 'transparent',
                color: isActive ? 'var(--admin-dark-panel)' : 'var(--admin-text)',
                border: isActive ? '1px solid var(--admin-text-on-dark)' : '1px solid var(--admin-border-card)',
              }}>
              {name}
              {v.is_selected && <span style={{ fontSize: '11px', color: isActive ? 'var(--admin-dark-panel)' : 'var(--admin-success)' }}>✓</span>}
            </button>
          )
        })}

        <button type="button" onClick={handleCreate} disabled={isPending}
          style={{ padding: '8px 14px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: isPending ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
          + Add variant
        </button>
      </div>

      {/* название и подзаголовок активного варианта */}
      {!only && active && (
        <VariantNameFields key={active.id} variant={active} lang={lang} />
      )}

      {/* действия с активным вариантом — только если вариантов больше одного */}
      {!only && active && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          {active.is_selected ? (
            <span style={{ fontSize: '12px', color: 'var(--admin-success)' }}>✓ Client chose this variant</span>
          ) : (
            <button type="button" onClick={() => handleSelect(active.id)} disabled={isPending}
              style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--admin-accent)', background: 'transparent', border: '1px solid var(--admin-accent)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Mark as chosen
            </button>
          )}
          <button type="button" onClick={() => handleDelete(active.id)} disabled={isPending}
            style={{ padding: '4px 10px', fontSize: '11px', color: 'var(--admin-text-muted)', background: 'transparent', border: '1px solid var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Delete variant
          </button>
        </div>
      )}
    </div>
  )
}

function VariantNameFields({ variant, lang }: { variant: VariantBrief; lang: Lang }) {
  const nameKey = lang === 'ru' ? 'name_ru' : 'name_en'
  const subKey = lang === 'ru' ? 'subtitle_ru' : 'subtitle_en'

  const [name, setName] = useState(variant[nameKey] || '')
  const [subtitle, setSubtitle] = useState(variant[subKey] || '')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      updateVariant(variant.id, { [nameKey]: name || null, [subKey]: subtitle || null }).catch(() => {})
    }, 800)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, subtitle])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: '13px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--admin-text-muted)', fontWeight: 500, display: 'block', marginBottom: '4px',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginTop: '12px' }}>
      <div>
        <label style={labelStyle}>Variant name · {lang.toUpperCase()}</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder={lang === 'ru' ? 'Классический' : 'Classic'} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Subtitle · {lang.toUpperCase()}</label>
        <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
          placeholder={lang === 'ru' ? 'One&Only · Mont Rochelle · Morukuru' : 'One&Only · Mont Rochelle · Morukuru'} style={inputStyle} />
      </div>
    </div>
  )
}