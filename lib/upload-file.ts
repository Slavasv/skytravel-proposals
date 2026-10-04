import { supabase } from './supabase'

// Загрузка документов в ПРИВАТНЫЙ бакет attachments (без сжатия, исходный файл).
// Просмотр/скачивание — по короткоживущим подписанным ссылкам.

const BUCKET = 'attachments'
export const MAX_FILE_MB = 25
const SIGNED_TTL = 60 * 10 // 10 минут

export type UploadedFile = {
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
}

function extOf(name: string): string {
  const m = name.match(/\.([a-z0-9]+)$/i)
  return m ? m[1].toLowerCase() : 'bin'
}

// Загрузить файл в бакет. Путь: YYYYMM/<random>.<ext>. Возвращает метаданные для записи в БД.
export async function uploadFile(file: File): Promise<UploadedFile> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`Файл больше ${MAX_FILE_MB} МБ`)
  }
  const now = new Date()
  const folder = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const rand = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const path = `${folder}/${rand}.${extOf(file.name)}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (error) throw new Error(`Не удалось загрузить: ${error.message}`)

  return {
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
  }
}

// Подписанная ссылка на один файл (для просмотра/скачивания).
export async function signedUrl(path: string, download = false): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL, { download })
  if (error || !data) return null
  return data.signedUrl
}

// Подписанные ссылки пачкой (для превью сетки). Возвращает map path → url.
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL)
  if (error || !data) return {}
  const map: Record<string, string> = {}
  for (const row of data) {
    if (row.path && row.signedUrl) map[row.path] = row.signedUrl
  }
  return map
}

// Удалить объект из бакета (cleanup; метаданные удаляются отдельно в экшене).
export async function removeFromBucket(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}
