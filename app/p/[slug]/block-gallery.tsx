'use client'

import { useState } from 'react'

type Props = {
  photos: string[]   // уже отфильтрованный список непустых URL
  alt?: string
  width?: number     // ширина области (для блока в дне — 160)
  height?: number    // высота
}

export default function BlockGallery({ photos, alt = '', width = 160, height = 110 }: Props) {
  const [index, setIndex] = useState(0)

  if (photos.length === 0) return null

  const count = photos.length
  const go = (dir: number) => setIndex((i) => (i + dir + count) % count)

  return (
    <div
      style={{
        position: 'relative',
        width: width ? `${width}px` : '100%',
        height: `${height}px`,
        borderRadius: '6px',
        overflow: 'hidden',
        flexShrink: 0,
        backgroundColor: 'var(--client-border-row)',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundImage: `url(${photos[index]})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transition: 'background-image 0.2s',
        }}
        role="img"
        aria-label={alt}
      />

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous photo"
            style={{
              position: 'absolute', top: '50%', left: '6px', transform: 'translateY(-50%)',
              width: '26px', height: '26px', borderRadius: '50%', border: 'none',
              background: 'rgba(0,0,0,0.45)', color: '#fff', cursor: 'pointer',
              fontSize: '14px', lineHeight: 1, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontFamily: 'inherit',
            }}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next photo"
            style={{
              position: 'absolute', top: '50%', right: '6px', transform: 'translateY(-50%)',
              width: '26px', height: '26px', borderRadius: '50%', border: 'none',
              background: 'rgba(0,0,0,0.45)', color: '#fff', cursor: 'pointer',
              fontSize: '14px', lineHeight: 1, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontFamily: 'inherit',
            }}
          >
            ›
          </button>
          <div
            style={{
              position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: '4px',
            }}
          >
            {photos.map((_, i) => (
              <span
                key={i}
                style={{
                  width: '5px', height: '5px', borderRadius: '50%',
                  background: i === index ? '#fff' : 'rgba(255,255,255,0.45)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}