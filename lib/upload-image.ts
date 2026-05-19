import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'

const BUCKET = 'block-images'
const MAX_WIDTH = 2000
const MAX_SIZE_MB = 0.5
const QUALITY = 0.85

export type UploadResult = {
  url: string
  path: string
}

export type UploadProgress = {
  stage: 'compressing' | 'uploading' | 'done'
  percent: number
}

/**
 * Сжимает картинку в браузере и загружает в Supabase Storage.
 * Возвращает публичный URL.
 */
export async function uploadImage(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  // 1. Сжатие
  onProgress?.({ stage: 'compressing', percent: 0 })

  const compressed = await imageCompression(file, {
    maxSizeMB: MAX_SIZE_MB,
    maxWidthOrHeight: MAX_WIDTH,
    useWebWorker: true,
    initialQuality: QUALITY,
    fileType: 'image/webp',
    onProgress: (percent) => {
      onProgress?.({ stage: 'compressing', percent: Math.min(percent, 99) })
    },
  })

  // 2. Загрузка
  onProgress?.({ stage: 'uploading', percent: 0 })

  // Уникальное имя файла: timestamp + случайные 6 символов + расширение
  const randomId = Math.random().toString(36).slice(2, 8)
  const filename = `${Date.now()}-${randomId}.webp`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filename, compressed, {
      cacheControl: '31536000', // 1 год кэша (картинки не меняются)
      upsert: false,
      contentType: 'image/webp',
    })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  // 3. Получение публичного URL
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename)

  onProgress?.({ stage: 'done', percent: 100 })

  return {
    url: data.publicUrl,
    path: filename,
  }
}

/**
 * Извлекает имя файла из публичного URL Supabase Storage.
 * Возвращает null если URL не из нашего bucket.
 */
export function extractStoragePath(url: string | null | undefined): string | null {
  if (!url) return null

  // Supabase URL вида: https://xxx.supabase.co/storage/v1/object/public/block-images/1234-abcdef.webp
  const match = url.match(new RegExp(`/storage/v1/object/public/${BUCKET}/(.+)$`))
  if (!match) return null

  return match[1]
}

/**
 * Удаляет файл из Storage. Безопасно вызывать с любым URL —
 * если URL не из нашего bucket, ничего не делает.
 */
export async function deleteImageIfOurs(url: string | null | undefined): Promise<void> {
  const path = extractStoragePath(url)
  if (!path) return

  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) {
    console.error('Failed to delete image:', error.message)
    // Не бросаем ошибку — это операция cleanup'а, не критическая
  }
}