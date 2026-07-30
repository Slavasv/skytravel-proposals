'use client'

import { useState, useEffect, useRef } from 'react'
import GalleryUploader from '@/app/admin/library/[id]/gallery-uploader'
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

export default function SectionGallery({
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
  const [titleRu, setTitleRu] = useState(section.title_ru || '')
  const [titleEn, setTitleEn] = useState(section.title_en || '')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)

  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return }
    setSaveState('saving')
    // обновляем локальный стейт родителя сразу — чтобы свернуть/развернуть не терял данные
    onLocalChange({ title_ru: titleRu || null, title_en: titleEn || null, data: { images } })
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await updateSection(section.id, {
        title_ru: titleRu || null,
        title_en: titleEn || null,
        data: { images },
      })
      setSaveState('saved')
    }, 1200)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, titleRu, titleEn])

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--admin-text-muted)', marginBottom: '6px', fontWeight: 500,
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '14px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '12px' }}>
      <div>
        <label style={labelStyle}>{t('Section title (optional)', 'Заголовок раздела (необяз.)')} · {lang.toUpperCase()}</label>
        {lang === 'ru' ? (
          <input type="text" value={titleRu} onChange={(e) => setTitleRu(e.target.value)} style={inputStyle} placeholder="Например: Дикая природа Масаи-Мара" />
        ) : (
          <input type="text" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} style={inputStyle} placeholder="e.g.: Wildlife of Masai Mara" />
        )}
      </div>

      <div>
        <label style={labelStyle}>{t('Photos', 'Фотографии')}</label>
        <GalleryUploader images={images} onChange={setImages} lang={lang} />
      </div>

      <div style={{ fontSize: '11px', color: saveState === 'saved' ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
        {saveState === 'saving' ? t('● Saving...', '● Сохранение...') : saveState === 'saved' ? t('● Saved', '● Сохранено') : ''}
      </div>
    </div>
  )
}