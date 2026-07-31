'use client'

import { useState, useEffect, useRef } from 'react'
import GalleryUploader from '@/app/admin/library/[id]/gallery-uploader'
import ImageUploader from '@/app/admin/_components/image-uploader'
import { useT } from '@/lib/i18n-client'
import { updateSection } from './destination-actions'
import type { DestinationSection } from './destination-actions'
import { normalizePhotos, type Photo } from '@/lib/photos'

type Lang = 'ru' | 'en'

function getImages(data: unknown): Photo[] {
  if (data && typeof data === 'object' && 'images' in data) {
    return normalizePhotos((data as { images?: unknown }).images)
  }
  return []
}
function getStr(data: unknown, key: string): string {
  if (data && typeof data === 'object' && key in data) {
    const v = (data as Record<string, unknown>)[key]
    return typeof v === 'string' ? v : ''
  }
  return ''
}

// Блок «Вдохновение» — как «Обзор + Впечатления» в предложении:
//   Обзор (с буквицей, НАД галереей) → галерея → Текст впечатлений (обычный,
//   под галереей) → фото-разделитель.
export default function SectionInspiration({
  section,
  lang,
  onLocalChange,
}: {
  section: DestinationSection
  lang: Lang
  onLocalChange: (patch: Partial<DestinationSection>) => void
}) {
  const t = useT()
  const [images, setImages] = useState<Photo[]>(getImages(section.data))
  const [overviewRu, setOverviewRu] = useState(getStr(section.data, 'overview_ru'))
  const [overviewEn, setOverviewEn] = useState(getStr(section.data, 'overview_en'))
  const [impressionsRu, setImpressionsRu] = useState(getStr(section.data, 'impressions_ru'))
  const [impressionsEn, setImpressionsEn] = useState(getStr(section.data, 'impressions_en'))
  const [divider, setDivider] = useState(getStr(section.data, 'divider_image'))
  const [titleRu, setTitleRu] = useState(section.title_ru || '')
  const [titleEn, setTitleEn] = useState(section.title_en || '')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)

  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return }
    setSaveState('saving')
    const payload = {
      images,
      overview_ru: overviewRu, overview_en: overviewEn,
      impressions_ru: impressionsRu, impressions_en: impressionsEn,
      divider_image: divider,
    }
    onLocalChange({ title_ru: titleRu || null, title_en: titleEn || null, data: payload })
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await updateSection(section.id, { title_ru: titleRu || null, title_en: titleEn || null, data: payload })
      setSaveState('saved')
    }, 1200)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, overviewRu, overviewEn, impressionsRu, impressionsEn, divider, titleRu, titleEn])

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--admin-text-muted)', marginBottom: '6px', fontWeight: 500,
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '14px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
  }
  const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', lineHeight: 1.6 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '12px' }}>
      <div>
        <label style={labelStyle}>{t('Section title (optional)', 'Заголовок раздела (необяз.)')} · {lang.toUpperCase()}</label>
        {lang === 'ru' ? (
          <input type="text" value={titleRu} onChange={(e) => setTitleRu(e.target.value)} style={inputStyle} placeholder="Например: Почему именно сюда" />
        ) : (
          <input type="text" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} style={inputStyle} placeholder="e.g.: Why this place" />
        )}
      </div>

      <div>
        <label style={labelStyle}>{t('Overview — shown ABOVE the gallery (drop cap)', 'Обзор — НАД галереей (с буквицей)')} · {lang.toUpperCase()}</label>
        {lang === 'ru' ? (
          <textarea value={overviewRu} onChange={(e) => setOverviewRu(e.target.value)} rows={4} style={textareaStyle}
            placeholder="Вводный абзац, задающий концепт направления…" />
        ) : (
          <textarea value={overviewEn} onChange={(e) => setOverviewEn(e.target.value)} rows={4} style={textareaStyle}
            placeholder="Opening paragraph that sets the concept of the destination…" />
        )}
      </div>

      <div>
        <label style={labelStyle}>{t('Photos', 'Фотографии')}</label>
        <GalleryUploader images={images} onChange={setImages} lang={lang} />
      </div>

      <div>
        <label style={labelStyle}>{t('Impressions text — shown BELOW the gallery', 'Текст впечатлений — ПОД галереей')} · {lang.toUpperCase()}</label>
        {lang === 'ru' ? (
          <textarea value={impressionsRu} onChange={(e) => setImpressionsRu(e.target.value)} rows={4} style={textareaStyle}
            placeholder="Атмосферный текст под галереей…" />
        ) : (
          <textarea value={impressionsEn} onChange={(e) => setImpressionsEn(e.target.value)} rows={4} style={textareaStyle}
            placeholder="Evocative text below the gallery…" />
        )}
      </div>

      <div>
        <label style={labelStyle}>{t('Divider photo (full width, optional)', 'Фото-разделитель (на всю ширину, необяз.)')}</label>
        <ImageUploader value={divider} onChange={setDivider} label={t('Divider', 'Разделитель')} height={200} />
      </div>

      <div style={{ fontSize: '11px', color: saveState === 'saved' ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
        {saveState === 'saving' ? t('● Saving...', '● Сохранение...') : saveState === 'saved' ? t('● Saved', '● Сохранено') : ''}
      </div>
    </div>
  )
}
