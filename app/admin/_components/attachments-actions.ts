'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

const BUCKET = 'attachments'
const SIGNED_TTL = 60 * 10 // 10 минут
const MAX_FILE_MB = 25

export type EntityType = 'client' | 'request' | 'booking' | 'task'

export type FileRow = {
  id: string
  file_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string | null
  uploaded_by_name: string | null
  created_at: string
}

export type AttachmentRow = FileRow & { link_id: string }
export type ClientLite = { id: string; name: string }

export type Me = { id: string; isAdmin: boolean }

export async function getMe(): Promise<Me> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { id: '', isAdmin: false }
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (me?.role as string | null) ?? ''
  return { id: user.id, isAdmin: role === 'owner' || role === 'admin' }
}

// company_id сущности (бренд) — чтобы корректно тегать файл
async function entityCompany(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  entityType: EntityType,
  entityId: string,
): Promise<string | null> {
  const table = entityType === 'client' ? 'clients'
    : entityType === 'request' ? 'requests'
      : entityType === 'booking' ? 'bookings'
        : 'tasks'
  const { data } = await supabase.from(table).select('company_id').eq('id', entityId).single()
  return (data?.company_id as string | null) ?? null
}

async function nameMap(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(ids.filter((x): x is string => !!x)))
  const map = new Map<string, string>()
  if (uniq.length === 0) return map
  const { data } = await supabase.from('profiles').select('id, full_name, email').in('id', uniq)
  for (const p of data ?? []) {
    map.set(p.id as string, ((p.full_name as string | null)?.trim() || (p.email as string | null) || '—') as string)
  }
  return map
}

// Список вложений сущности
export async function getAttachments(entityType: EntityType, entityId: string): Promise<AttachmentRow[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('file_links')
    .select('id, created_at, files(id, file_name, storage_path, mime_type, size_bytes, uploaded_by, created_at)')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
  if (error || !data) return []

  const rows = data as unknown as { id: string; files: FileRow | FileRow[] | null }[]
  const files = rows.map((r) => (Array.isArray(r.files) ? r.files[0] : r.files)).filter(Boolean) as FileRow[]
  const names = await nameMap(supabase, files.map((f) => f.uploaded_by))

  return rows
    .map((r) => {
      const f = (Array.isArray(r.files) ? r.files[0] : r.files) as FileRow | null
      if (!f) return null
      return {
        link_id: r.id,
        id: f.id,
        file_name: f.file_name,
        storage_path: f.storage_path,
        mime_type: f.mime_type,
        size_bytes: f.size_bytes,
        uploaded_by: f.uploaded_by,
        uploaded_by_name: f.uploaded_by ? names.get(f.uploaded_by) ?? null : null,
        created_at: f.created_at,
      } as AttachmentRow
    })
    .filter((x): x is AttachmentRow => !!x)
}

// Клиенты, в которых можно сохранить файл (для опции «также в клиента»)
export async function getEntityClients(entityType: EntityType, entityId: string): Promise<ClientLite[]> {
  const supabase = await createSupabaseServer()
  const ids = new Set<string>()

  if (entityType === 'client') {
    ids.add(entityId)
  } else if (entityType === 'request') {
    const { data } = await supabase.from('requests').select('client_id').eq('id', entityId).single()
    if (data?.client_id) ids.add(data.client_id as string)
  } else if (entityType === 'booking') {
    const { data } = await supabase.from('bookings').select('client_id').eq('id', entityId).single()
    if (data?.client_id) ids.add(data.client_id as string)
    // плательщики (разделение счёта) — когда появится booking_payers, добавить сюда
  } else if (entityType === 'task') {
    const { data } = await supabase.from('tasks').select('client_id').eq('id', entityId).single()
    if (data?.client_id) ids.add(data.client_id as string)
  }

  const arr = Array.from(ids)
  if (arr.length === 0) return []
  const { data } = await supabase.from('clients').select('id, name').in('id', arr)
  return (data ?? []).map((c) => ({ id: c.id as string, name: (c.name as string | null) || '—' }))
}

// Файлы в библиотеке клиента (для пикера «Взять из файлов клиента»)
export async function getClientFiles(clientId: string): Promise<FileRow[]> {
  const supabase = await createSupabaseServer()
  const { data } = await supabase
    .from('file_links')
    .select('files(id, file_name, storage_path, mime_type, size_bytes, uploaded_by, created_at)')
    .eq('entity_type', 'client')
    .eq('entity_id', clientId)
    .order('created_at', { ascending: false })
  const rows = (data ?? []) as unknown as { files: FileRow | FileRow[] | null }[]
  return rows.map((r) => (Array.isArray(r.files) ? r.files[0] : r.files)).filter((x): x is FileRow => !!x)
}

// Гарантируем наличие приватного бакета (на случай, если не создан миграцией)
async function ensureBucket(admin: ReturnType<typeof createSupabaseAdmin>): Promise<void> {
  try { await admin.storage.createBucket(BUCKET, { public: false }) } catch { /* уже есть */ }
}

// Загрузка файла + запись метаданных. Файл грузим СЕРВИС-РОЛЬЮ (мимо storage-RLS),
// а строки в БД — под обычным пользователем (RLS по бренду работает).
export async function uploadAndCreate(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authorized' }

  const file = formData.get('file') as File | null
  const entityType = formData.get('entityType') as EntityType | null
  const entityId = formData.get('entityId') as string | null
  const alsoRaw = (formData.get('alsoClientIds') as string | null) || '[]'
  if (!file || !entityType || !entityId) return { ok: false, error: 'Bad input' }
  if (file.size > MAX_FILE_MB * 1024 * 1024) return { ok: false, error: `Файл больше ${MAX_FILE_MB} МБ` }

  const companyId = await entityCompany(supabase, entityType, entityId)
  if (!companyId) return { ok: false, error: 'Company not found' }

  let alsoClientIds: string[] = []
  try { alsoClientIds = JSON.parse(alsoRaw) } catch { alsoClientIds = [] }

  // 1) заливаем объект сервис-ролью
  const admin = createSupabaseAdmin()
  await ensureBucket(admin)
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || 'bin').toLowerCase()
  const now = new Date()
  const folder = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const bytes = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || 'application/octet-stream', upsert: false,
  })
  if (upErr) return { ok: false, error: `Не удалось загрузить: ${upErr.message}` }

  // 2) метаданные под пользователем (RLS по бренду)
  const { data: f, error } = await supabase.from('files').insert({
    company_id: companyId,
    file_name: file.name,
    storage_path: path,
    mime_type: file.type || 'application/octet-stream',
    size_bytes: file.size,
    uploaded_by: user.id,
  }).select('id').single()
  if (error || !f) {
    await admin.storage.from(BUCKET).remove([path]).catch(() => {})
    return { ok: false, error: error?.message || 'insert failed' }
  }

  const links: { file_id: string; entity_type: EntityType; entity_id: string }[] = [
    { file_id: f.id as string, entity_type: entityType, entity_id: entityId },
  ]
  for (const cid of alsoClientIds) {
    if (entityType === 'client' && cid === entityId) continue
    links.push({ file_id: f.id as string, entity_type: 'client', entity_id: cid })
  }
  const { error: lerr } = await supabase.from('file_links').insert(links)
  if (lerr) return { ok: false, error: lerr.message }
  return { ok: true }
}

// Подписанные ссылки (сервис-роль) — для превью и просмотра/скачивания.
export async function signUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const admin = createSupabaseAdmin()
  const { data } = await admin.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL)
  const map: Record<string, string> = {}
  for (const r of data ?? []) { if (r.path && r.signedUrl) map[r.path] = r.signedUrl }
  return map
}

export async function signOne(path: string, download = false): Promise<string | null> {
  const admin = createSupabaseAdmin()
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL, { download })
  return data?.signedUrl ?? null
}

// Прикрепить существующий файл к сущности (пикер / «→ в клиента»)
export async function linkExisting(fileId: string, entityType: EntityType, entityId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('file_links')
    .upsert({ file_id: fileId, entity_type: entityType, entity_id: entityId }, { onConflict: 'file_id,entity_type,entity_id' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// Снять появление файла с сущности (файл остаётся)
export async function unlink(linkId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('file_links').delete().eq('id', linkId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// Удалить файл СОВСЕМ (объект из бакета + метаданные; links каскадом).
// Права проверяет RLS (files_delete: загрузивший или админ/владелец).
export async function deleteFile(fileId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer()
  const { data: f } = await supabase.from('files').select('storage_path').eq('id', fileId).single()
  const { error } = await supabase.from('files').delete().eq('id', fileId)
  if (error) return { ok: false, error: error.message }
  if (f?.storage_path) {
    // удаляем объект сервис-ролью (мимо storage-RLS)
    await createSupabaseAdmin().storage.from(BUCKET).remove([f.storage_path as string]).catch(() => {})
  }
  return { ok: true }
}
