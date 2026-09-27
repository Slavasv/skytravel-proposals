'use client'

import { useState } from 'react'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n-client'
import BrandSettingsForm from './brand-settings-form'
import { createOwnerBrand, type OwnerBrand } from './actions'

export default function BrandSettingsManager({ brands }: { brands: OwnerBrand[] }) {
  const t = useT()
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(brands[0]?.id || '')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const selected = brands.find((b) => b.id === selectedId) || brands[0]

  function addBrand(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      try {
        const res = await createOwnerBrand(name, slug)
        setName(''); setSlug(''); setAdding(false)
        setSelectedId(res.id)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка')
      }
    })
  }

  const field: React.CSSProperties = {
    padding: '10px 12px', fontSize: '14px', background: 'var(--admin-input)',
    border: '1px solid var(--admin-border)', borderRadius: '6px', color: 'var(--admin-text)',
    fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div>
      {brands.length > 1 && (
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '4px', display: 'block' }}>
            {t('Brand', 'Бренд')}
          </label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={field}>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name || b.slug || b.id}</option>)}
          </select>
        </div>
      )}

      {selected && <BrandSettingsForm key={selected.id} company={selected} companyId={selected.id} />}

      {/* Добавить бренд */}
      {!adding ? (
        <button type="button" onClick={() => setAdding(true)}
          style={{ ...field, cursor: 'pointer', color: 'var(--admin-accent)', textAlign: 'left', width: 'auto', padding: '10px 16px', border: '1px dashed var(--admin-border-hover)', background: 'transparent' }}>
          + {t('Add brand', 'Добавить бренд')}
        </button>
      ) : (
        <form onSubmit={addBrand} style={{ padding: '16px', border: '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-input)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{t('New brand', 'Новый бренд')}</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Brand name (e.g. Tigu Travel)', 'Название бренда (напр. Tigu Travel)')} style={field} />
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={t('slug (e.g. tigu)', 'slug (напр. tigu)')} style={field} />
          {error && <div style={{ color: 'var(--admin-danger)', fontSize: '12.5px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" disabled={isPending} style={{ padding: '9px 16px', fontSize: '13px', fontWeight: 600, background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
              {isPending ? t('Creating…', 'Создаю…') : t('Create', 'Создать')}
            </button>
            <button type="button" onClick={() => { setAdding(false); setError('') }} style={{ padding: '9px 16px', fontSize: '13px', background: 'transparent', border: '1px solid var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--admin-text-muted)' }}>
              {t('Cancel', 'Отмена')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
