// Общая модель фото галереи: url + двуязычная подпись.
// Хранится в jsonb (content_blocks.images, rooms[].images, section.images).
// Старые данные — просто массив строк-url; нормализуем оба варианта.

export type Photo = { url: string; caption_ru: string; caption_en: string }

export function normalizePhotos(raw: unknown): Photo[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((p): Photo => {
      if (typeof p === 'string') return { url: p, caption_ru: '', caption_en: '' }
      const o = (p ?? {}) as Record<string, unknown>
      return {
        url: String(o.url ?? ''),
        caption_ru: String(o.caption_ru ?? ''),
        caption_en: String(o.caption_en ?? ''),
      }
    })
    .filter((p) => p.url)
}

// Только url-ы (для мест, где подписи не нужны — совместимость со старым кодом)
export function photoUrls(raw: unknown): string[] {
  return normalizePhotos(raw).map((p) => p.url)
}