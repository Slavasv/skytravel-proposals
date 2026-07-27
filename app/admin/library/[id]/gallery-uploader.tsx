'use client'

import ImageUploader from '@/app/admin/_components/image-uploader'
import { useState, useRef } from 'react'
import { uploadImage } from '@/lib/upload-image'
import { type Photo } from '@/lib/photos'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type CapKey = 'caption_ru' | 'caption_en'

type Props = {
  images: Photo[]
  onChange: (images: Photo[]) => void
  lang?: 'ru' | 'en'
}

// Стабильный ключ для каждого слота
function slotId(url: string, i: number) {
  return `${i}::${url || 'empty'}`
}

function SortablePhoto({
  id,
  photo,
  index,
  capKey,
  onReplace,
  onCaption,
  onRemove,
}: {
  id: string
  photo: Photo
  index: number
  capKey: CapKey
  onReplace: (index: number, url: string) => void
  onCaption: (index: number, value: string) => void
  onRemove: (index: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: 'relative',
    border: '1px solid var(--admin-border-card)',
    borderRadius: '8px',
    padding: '10px',
    background: 'var(--admin-card)',
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          style={{
            background: 'transparent', border: 'none', padding: '2px 6px',
            cursor: 'grab', color: 'var(--admin-text-muted)', fontSize: '14px',
            fontFamily: 'inherit', touchAction: 'none',
          }}
        >
          ⋮⋮ <span style={{ fontSize: '11px' }}>Photo {index + 1}</span>
        </button>
        <button
          type="button"
          onClick={() => onRemove(index)}
          style={{
            padding: '4px 10px', fontSize: '12px', color: 'var(--admin-danger)',
            background: 'transparent', border: '1px solid var(--admin-border-card)',
            borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ✕ Remove
        </button>
      </div>
      <ImageUploader
        value={photo.url}
        onChange={(newUrl) => onReplace(index, newUrl)}
        label=""
        height={140}
      />
      <input
        type="text"
        value={photo[capKey]}
        onChange={(e) => onCaption(index, e.target.value)}
        placeholder={`Caption · ${capKey === 'caption_ru' ? 'RU' : 'EN'}`}
        style={{
          marginTop: '8px', width: '100%', padding: '7px 9px', fontSize: '12px',
          color: 'var(--admin-text)', background: 'var(--admin-input)',
          border: '1px solid var(--admin-border)', borderRadius: '4px',
          fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
        }}
      />
    </div>
  )
}

export default function GalleryUploader({ images, onChange, lang = 'ru' }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const capKey: CapKey = lang === 'ru' ? 'caption_ru' : 'caption_en'

  // мультизагрузка: выбрать несколько файлов сразу
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const added: Photo[] = []
    for (const file of Array.from(files)) {
      try {
        const result = await uploadImage(file)
        if (result?.url) added.push({ url: result.url, caption_ru: '', caption_en: '' })
      } catch { /* пропускаем битый файл */ }
    }
    if (added.length > 0) onChange([...images, ...added])
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  function addPhoto() {
    onChange([...images, { url: '', caption_ru: '', caption_en: '' }])
  }

  function replacePhoto(index: number, url: string) {
    const next = [...images]
    next[index] = { ...next[index], url }
    onChange(next)
  }

  function setCaption(index: number, value: string) {
    const next = [...images]
    next[index] = { ...next[index], [capKey]: value }
    onChange(next)
  }

  function removePhoto(index: number) {
    onChange(images.filter((_, i) => i !== index))
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = images.map((p, i) => slotId(p.url, i))
    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    onChange(arrayMove(images, oldIndex, newIndex))
  }

  const ids = images.map((p, i) => slotId(p.url, i))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {images.map((photo, i) => (
                <SortablePhoto
                  key={ids[i]}
                  id={ids[i]}
                  photo={photo}
                  index={i}
                  capKey={capKey}
                  onReplace={replacePhoto}
                  onCaption={setCaption}
                  onRemove={removePhoto}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          style={{
            padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)',
            background: 'transparent', border: '1px dashed var(--admin-border-card)',
            borderRadius: '8px', cursor: uploading ? 'wait' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {uploading ? 'Uploading…' : '＋ Upload photos'}
        </button>
        <button
          type="button"
          onClick={addPhoto}
          style={{
            padding: '10px 16px', fontSize: '13px', color: 'var(--admin-text-muted)',
            background: 'transparent', border: '1px solid var(--admin-border-card)',
            borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          + Empty slot
        </button>
      </div>
    </div>
  )
}