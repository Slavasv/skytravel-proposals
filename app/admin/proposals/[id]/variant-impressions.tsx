'use client'

import { useState, useEffect, useRef } from 'react'
import ImageUploader from '@/app/admin/_components/image-uploader'
import { uploadImage } from '@/lib/upload-image'
import { updateVariant, type VariantFull } from './variant-actions'
import type { Lang } from './edit-page-client'
import { useT } from '@/lib/i18n-client'

type GalleryItem = { id: string; image_url: string; caption_ru: string; caption_en: string }

function normalizeGallery(raw: unknown): GalleryItem[] {
  if (!Array.isArray(raw)) return []
  return raw.map((g) => ({
    id: g?.id || Math.random().toString(36).slice(2, 10),
    image_url: g?.image_url || '',
    caption_ru: g?.caption_ru || '',
    caption_en: g?.caption_en || '',
  }))
}

export default function VariantImpressions({ variant, lang }: { variant: VariantFull; lang: Lang }) {
  const t = useT()
  const [gallery, setGallery] = useState<GalleryItem[]>(normalizeGallery(variant.gallery))
  const [text, setText] = useState(lang === 'ru' ? (variant.impressions_text_ru || '') : (variant.impressions_text_en || ''))
  const [divider, setDivider] = useState(variant.divider_image || '')
  const [overview, setOverview] = useState(lang === 'ru' ? (variant.overview_ru || '') : (variant.overview_en || ''))
  const [uploading, setUploading] = useState(false)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const first = useRef(true)
  const fileInput = useRef<HTMLInputElement | null>(null)

  const textKey = lang === 'ru' ? 'impressions_text_ru' : 'impressions_text_en'
  const overviewKey = lang === 'ru' ? 'overview_ru' : 'overview_en'
  const capKey = lang === 'ru' ? 'caption_ru' : 'caption_en'

  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      updateVariant(variant.id, {
        gallery,
        [textKey]: text || null,
        [overviewKey]: overview || null,
        divider_image: divider || null,
      }).catch(() => {})
    }, 1000)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gallery, text, divider, overview])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const added: GalleryItem[] = []
    for (const file of Array.from(files)) {
      try {
        const result = await uploadImage(file)
        if (result?.url) {
          added.push({ id: Math.random().toString(36).slice(2, 10), image_url: result.url, caption_ru: '', caption_en: '' })
        }
      } catch { /* пропускаем битый файл */ }
    }
    if (added.length > 0) setGallery((prev) => [...prev, ...added])
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  function updateCaption(id: string, value: string) {
    setGallery((prev) => prev.map((g) => g.id === id ? { ...g, [capKey]: value } : g))
  }
  function removePhoto(id: string) {
    setGallery((prev) => prev.filter((g) => g.id !== id))
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '13px', fontWeight: 500, color: 'var(--admin-text)', display: 'block', marginBottom: '6px',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '14px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Овервью варианта — абзац-буквица ПЕРЕД блоком «Впечатления» */}
      <div>
        <label style={labelStyle}>{t('Variant overview', 'Обзор варианта')} · {lang.toUpperCase()}</label>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 8px' }}>
          {t('Intro paragraph for this variant, shown before the impressions gallery (with a big drop-cap on the client page).', 'Вступительный абзац для этого варианта, показывается перед галереей впечатлений (с крупной буквицей на странице клиента).')}
        </p>
        <textarea value={overview} onChange={(e) => setOverview(e.target.value)} rows={4}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
          placeholder={lang === 'ru' ? 'Десять дней между океаном и саванной…' : 'Ten days between ocean and savannah…'} />
      </div>

      {/* Галерея — компактная сетка */}
      <div>
        <label style={labelStyle}>{t('Gallery photos', 'Фотографии галереи')}</label>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 12px' }}>
          {t('Photos with captions shown at the top of the variant. Select several at once.', 'Фотографии с подписями, показываемые вверху варианта. Можно выбрать несколько сразу.')}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
          {gallery.map((g) => (
            <div key={g.id} style={{ border: '1px solid var(--admin-border-card)', borderRadius: '8px', overflow: 'hidden', background: 'var(--admin-card)' }}>
              <div style={{ position: 'relative', width: '100%', paddingBottom: '66%', background: g.image_url ? `url(${g.image_url}) center/cover no-repeat` : 'var(--admin-input)' }}>
                <button type="button" onClick={() => removePhoto(g.id)}
                  style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(20,20,20,0.75)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '4px 8px', fontFamily: 'inherit', backdropFilter: 'blur(4px)' }}>✕</button>
              </div>
              <input type="text" value={g[capKey]} onChange={(e) => updateCaption(g.id, e.target.value)}
                placeholder={`${t('Caption', 'Подпись')} · ${lang.toUpperCase()}`}
                style={{ width: '100%', padding: '7px 9px', fontSize: '12px', color: 'var(--admin-text)', background: 'transparent', border: 'none', borderTop: '1px solid var(--admin-border-card)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
            </div>
          ))}
        </div>

        <input ref={fileInput} type="file" accept="image/*" multiple style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)} />
        <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading}
          style={{ marginTop: '12px', padding: '8px 14px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: uploading ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
          {uploading ? t('Uploading…', 'Загрузка…') : t('+ Add photos', '+ Добавить фото')}
        </button>
      </div>

      {/* Впечатляющий текст */}
      <div>
        <label style={labelStyle}>{t('Impressions text', 'Текст впечатлений')} · {lang.toUpperCase()}</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
          placeholder={lang === 'ru' ? 'Текст под галереей впечатлений — атмосфера, детали, эмоции…' : 'Text under the impressions gallery — atmosphere, details, emotions…'} />
      </div>

      {/* Фото-дивайдер */}
      <div>
        <label style={labelStyle}>{t('Divider photo', 'Фото-разделитель')}</label>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 12px' }}>
          {t('One full-width photo shown after the text.', 'Одна фотография во всю ширину, показываемая после текста.')}
        </p>
        <ImageUploader value={divider} onChange={setDivider} label={t('Divider', 'Разделитель')} height={200} />
      </div>
    </div>
  )
}