'use client'

import ImageUploader from '@/app/admin/_components/image-uploader'
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

type Props = {
  images: string[]
  onChange: (images: string[]) => void
}

// Стабильный ключ для каждого слота: используем сам url + индекс
function slotId(url: string, i: number) {
  return `${i}::${url || 'empty'}`
}

function SortablePhoto({
  id,
  url,
  index,
  onReplace,
  onRemove,
}: {
  id: string
  url: string
  index: number
  onReplace: (index: number, url: string) => void
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
        value={url}
        onChange={(newUrl) => onReplace(index, newUrl)}
        label=""
        height={140}
      />
    </div>
  )
}

export default function GalleryUploader({ images, onChange }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function addPhoto() {
    onChange([...images, ''])
  }

  function replacePhoto(index: number, url: string) {
    // Если фото удалили внутри аплоадера (url пустой) — оставляем пустой слот,
    // его можно убрать кнопкой Remove. Если загрузили — ставим url.
    const next = [...images]
    next[index] = url
    onChange(next)
  }

  function removePhoto(index: number) {
    onChange(images.filter((_, i) => i !== index))
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = images.map((url, i) => slotId(url, i))
    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    onChange(arrayMove(images, oldIndex, newIndex))
  }

  const ids = images.map((url, i) => slotId(url, i))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {images.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {images.map((url, i) => (
                <SortablePhoto
                  key={ids[i]}
                  id={ids[i]}
                  url={url}
                  index={i}
                  onReplace={replacePhoto}
                  onRemove={removePhoto}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        type="button"
        onClick={addPhoto}
        style={{
          padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)',
          background: 'transparent', border: '1px dashed var(--admin-border-card)',
          borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start',
        }}
      >
        + Add photo
      </button>
    </div>
  )
}