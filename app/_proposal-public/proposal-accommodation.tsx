'use client'

import { useState } from 'react'
import Carousel from './carousel'
import { getNights } from '@/lib/proposal-costs'
import { normalizePhotos, type Photo } from '@/lib/photos'
import type { PublicVariant, PublicDayBlock, Lang } from './types'

type RoomDef = {
  id: string
  images: Photo[]
  title_ru: string
  title_en: string
  subtitle_ru: string
  subtitle_en: string
}

function pick(lang: Lang, ru: string | null, en: string | null): string {
  return (lang === 'ru' ? ru : en) || ''
}

function nightsWord(n: number, lang: Lang): string {
  if (lang !== 'ru') return `${n} ${n === 1 ? 'night' : 'nights'}`
  const d = n % 10, dd = n % 100
  const w = dd > 10 && dd < 20 ? 'ночей' : d === 1 ? 'ночь' : d >= 2 && d <= 4 ? 'ночи' : 'ночей'
  return `${n} ${w}`
}

function normalizeRooms(raw: unknown): RoomDef[] {
  if (!Array.isArray(raw)) return []
  return raw.map((r: Record<string, unknown>) => ({
    id: String(r?.id ?? ''),
    images: normalizePhotos(r?.images),
    title_ru: String(r?.title_ru ?? ''),
    title_en: String(r?.title_en ?? ''),
    subtitle_ru: String(r?.subtitle_ru ?? ''),
    subtitle_en: String(r?.subtitle_en ?? ''),
  }))
}

export default function ProposalAccommodation({
  variant,
  variantNumber,
  tripStart,
  tripEnd,
  lang,
}: {
  variant: PublicVariant
  variantNumber: number
  tripStart: string | null
  tripEnd: string | null
  lang: Lang
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const days = [...variant.days].sort((a, b) => a.day_number - b.day_number)

  const hotels: { block: PublicDayBlock; nights: number | null }[] = []
  for (const d of days) {
    for (const b of d.day_blocks ?? []) {
      if (b.content_blocks?.type === 'hotel') {
        hotels.push({ block: b, nights: getNights(days, tripStart, tripEnd, b.id) })
      }
    }
  }

  if (hotels.length === 0) return null

  return (
    <div className="tp-container">
      <h2 className="tp-h2 tp-hotels__title">{lang === 'ru' ? 'Проживание' : 'Accommodation'}</h2>
      <div className="tp-itin__head">
        <span className="tp-label">
          {lang === 'ru' ? 'ПРОЖИВАНИЕ' : 'ACCOMMODATION'} · {lang === 'ru' ? 'МАРШРУТ' : 'ROUTE'} № {variantNumber}
        </span>
      </div>

      <div className="tp-hotels">
        {hotels.map((h, i) => {
          const cb = h.block.content_blocks!
          const name = pick(lang, cb.title_ru, cb.title_en)
          const sub = pick(lang, cb.subtitle_ru, cb.subtitle_en)
          const desc = pick(lang, cb.description_ru, cb.description_en)
          const photos: { url: string; caption?: string }[] = [
            ...(cb.image_url ? [{ url: cb.image_url }] : []),
            ...normalizePhotos(cb.images).map((p) => ({ url: p.url, caption: pick(lang, p.caption_ru, p.caption_en) })),
          ]
          const roomDefs = normalizeRooms(cb.rooms)
          const isOpen = open.has(h.block.id)
          const hasMore = Boolean(desc) || Boolean(cb.link_url)

          const seen = new Set<string>()
          const rooms = (h.block.selected_rooms ?? [])
            .filter((sr) => {
              if (seen.has(sr.room_id)) return false
              seen.add(sr.room_id)
              return true
            })
            .map((sr) => roomDefs.find((r) => r.id === sr.room_id))
            .filter((r): r is RoomDef => Boolean(r))

          const metaBits = [cb.location || '', h.nights ? nightsWord(h.nights, lang) : ''].filter(Boolean)

          return (
            <div className="tp-hotel" key={h.block.id}>
              <div className="tp-hotel__head">
                <span className="tp-hotel__num">{String(i + 1).padStart(2, '0')}</span>
                <div className="tp-hotel__info">
                  {metaBits.length > 0 && <div className="tp-label">{metaBits.join(' · ')}</div>}
                  {name && <h3 className="tp-hotel__name">{name}</h3>}
                  {sub && <p className="tp-hotel__sub">{sub}</p>}
                </div>
              </div>

              {photos.length > 0 && (
                <div className="tp-hotel__media">
                  <div className="tp-label tp-hotel__media-label">{lang === 'ru' ? 'ОТЕЛЬ И ТЕРРИТОРИЯ' : 'HOTEL & GROUNDS'}</div>
                  <Carousel slides={photos} />
                </div>
              )}

              {hasMore && (
                <div className="tp-hotel__more">
                  <button type="button" className="tp-hotel__toggle" onClick={() => toggle(h.block.id)}>
                    <span className="tp-hotel__toggle-ic" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                    {isOpen
                      ? (lang === 'ru' ? 'Скрыть описание' : 'Hide details')
                      : (lang === 'ru' ? 'Подробнее об отеле' : 'More about the hotel')}
                  </button>
                  {isOpen && (
                    <div className="tp-hotel__detail">
                      {desc && <p className="tp-hotel__desc">{desc}</p>}
                      {cb.link_url && (
                        <a className="tp-hotel__link" href={cb.link_url} target="_blank" rel="noopener noreferrer">
                          {lang === 'ru' ? 'Сайт отеля →' : 'Hotel website →'}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {rooms.map((room) => {
                const rname = pick(lang, room.title_ru, room.title_en)
                const rsub = pick(lang, room.subtitle_ru, room.subtitle_en)
                return (
                  <div className="tp-room" key={room.id}>
                    <div className="tp-label">{lang === 'ru' ? 'НОМЕР' : 'ROOM'}</div>
                    {rname && <h4 className="tp-room__name">{rname}</h4>}
                    {rsub && <p className="tp-room__sub">{rsub}</p>}
                    {room.images.length > 0 && (
                      <Carousel slides={room.images.map((p) => ({ url: p.url, caption: pick(lang, p.caption_ru, p.caption_en) }))} />
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}