'use client'

import { useState } from 'react'

export type Slide = { url: string; caption?: string }

// Переиспользуемая карусель: одно фото, стрелки, точки, счётчик.
// Используется в «Впечатлениях» и в «Проживании» (галереи отеля/номера).
export default function Carousel({ slides, aspect = '16 / 9' }: { slides: Slide[]; aspect?: string }) {
  const [i, setI] = useState(0)
  if (slides.length === 0) return null

  const idx = Math.min(i, slides.length - 1)
  const cur = slides[idx]
  const many = slides.length > 1
  const go = (d: number) => setI((p) => (p + d + slides.length) % slides.length)

  return (
    <div className="tp-carousel">
      <div className="tp-carousel__frame" style={{ aspectRatio: aspect }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="tp-carousel__img" src={cur.url} alt={cur.caption || ''} />
        {cur.caption && <div className="tp-carousel__cap">{cur.caption}</div>}
        {many && (
          <>
            <button className="tp-carousel__nav tp-carousel__nav--prev" aria-label="Prev" onClick={() => go(-1)}>‹</button>
            <button className="tp-carousel__nav tp-carousel__nav--next" aria-label="Next" onClick={() => go(1)}>›</button>
            <div className="tp-carousel__counter">{idx + 1} / {slides.length}</div>
          </>
        )}
      </div>

      {many && (
        <div className="tp-carousel__dots">
          {slides.map((_, k) => (
            <button
              key={k}
              className="tp-carousel__dot"
              data-active={k === idx}
              aria-label={`Slide ${k + 1}`}
              onClick={() => setI(k)}
            />
          ))}
        </div>
      )}
    </div>
  )
}