'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useT } from '@/lib/i18n-client'
import { uploadFile, signedUrl, signedUrls, MAX_FILE_MB } from '@/lib/upload-file'
import {
  getAttachments, getMe, getEntityClients, getClientFiles,
  createFile, linkExisting, unlink, deleteFile,
  type AttachmentRow, type ClientLite, type FileRow, type EntityType, type Me,
} from './attachments-actions'

function isImage(m: string | null): boolean { return !!m && m.startsWith('image/') }
function isPdf(m: string | null): boolean { return m === 'application/pdf' }
function extOf(name: string): string { const m = name.match(/\.([a-z0-9]+)$/i); return m ? m[1].toUpperCase() : 'FILE' }
function fmtSize(n: number | null): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

const card: React.CSSProperties = {
  border: '1px solid var(--admin-border-card)', borderRadius: '10px', background: 'var(--admin-card)',
}
const btn: React.CSSProperties = {
  padding: '8px 14px', fontSize: '13px', fontFamily: 'inherit', borderRadius: '8px', cursor: 'pointer',
  background: 'var(--admin-input)', color: 'var(--admin-text)', border: '1px solid var(--admin-border)',
}

export default function Attachments({ entityType, entityId }: { entityType: EntityType; entityId: string }) {
  const t = useT()
  const [items, setItems] = useState<AttachmentRow[]>([])
  const [me, setMe] = useState<Me>({ id: '', isAdmin: false })
  const [clients, setClients] = useState<ClientLite[]>([])
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [alsoClients, setAlsoClients] = useState<Set<string>>(new Set())
  const [viewer, setViewer] = useState<{ url: string; name: string; pdf: boolean } | null>(null)
  const [pickerFor, setPickerFor] = useState<ClientLite | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [list, meData, cls] = await Promise.all([
      getAttachments(entityType, entityId), getMe(), getEntityClients(entityType, entityId),
    ])
    setItems(list); setMe(meData); setClients(cls)
    const previewPaths = list.filter((f) => isImage(f.mime_type)).map((f) => f.storage_path)
    setPreviews(previewPaths.length ? await signedUrls(previewPaths) : {})
    setLoading(false)
  }, [entityType, entityId])

  useEffect(() => { load() }, [load])

  // клиенты, доступные для «в клиента» (на самой странице клиента — не предлагаем)
  const clientTargets = entityType === 'client' ? [] : clients

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setBusy(true)
    try {
      for (const file of Array.from(fileList)) {
        const uploaded = await uploadFile(file)
        await createFile({ entityType, entityId, file: uploaded, alsoClientIds: Array.from(alsoClients) })
      }
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : t('Upload failed', 'Не удалось загрузить'))
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function openFile(f: AttachmentRow, download = false) {
    const url = await signedUrl(f.storage_path, download)
    if (!url) { alert(t('Could not open file', 'Не удалось открыть файл')); return }
    if (download) { window.location.href = url; return }
    if (isImage(f.mime_type) || isPdf(f.mime_type)) {
      setViewer({ url, name: f.file_name, pdf: isPdf(f.mime_type) })
    } else {
      window.open(url, '_blank') // офисные — отдаём открытием/скачиванием
    }
  }

  async function handleRemove(f: AttachmentRow) {
    if (entityType === 'client') {
      if (!confirm(t('Delete this file completely? It will be removed everywhere.', 'Удалить файл совсем? Он исчезнет везде.'))) return
      setItems((p) => p.filter((x) => x.link_id !== f.link_id))
      await deleteFile(f.id)
    } else {
      setItems((p) => p.filter((x) => x.link_id !== f.link_id))
      await unlink(f.link_id)
    }
  }

  async function addToClient(f: AttachmentRow, clientId: string) {
    await linkExisting(f.id, 'client', clientId)
    alert(t('Added to client files', 'Добавлено в файлы клиента'))
  }

  async function attachFromClient(fileIds: string[]) {
    setBusy(true)
    for (const fid of fileIds) await linkExisting(fid, entityType, entityId)
    setPickerFor(null)
    await load()
    setBusy(false)
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: 'var(--admin-text)' }}>
          {t('Files', 'Файлы')}{items.length > 0 ? ` · ${items.length}` : ''}
        </h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {clientTargets.map((c) => (
            <button key={c.id} type="button"
              onClick={() => setPickerFor(c)}
              style={{ ...btn, fontSize: '12px', padding: '7px 11px' }}>
              {t('From client files', 'Из файлов клиента')}{clientTargets.length > 1 ? `: ${c.name}` : ''}
            </button>
          ))}
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}
            style={{ ...btn, fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
            {busy ? t('Uploading…', 'Загрузка…') : t('+ Upload', '+ Загрузить')}
          </button>
        </div>
      </div>

      {/* опция «также в клиента» (выкл по умолчанию) */}
      {clientTargets.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{t('Also save to client:', 'Также в файлы клиента:')}</span>
          {clientTargets.map((c) => {
            const on = alsoClients.has(c.id)
            return (
              <button key={c.id} type="button"
                onClick={() => setAlsoClients((s) => { const n = new Set(s); if (n.has(c.id)) { n.delete(c.id) } else { n.add(c.id) } return n })}
                style={{ ...btn, fontSize: '12px', padding: '5px 10px', background: on ? 'var(--admin-text-on-dark)' : 'var(--admin-input)', color: on ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)', border: `1px solid ${on ? 'var(--admin-text-on-dark)' : 'var(--admin-border)'}` }}>
                {on ? '✓ ' : ''}{clientTargets.length > 1 ? c.name : t('client', 'клиент')}
              </button>
            )
          })}
        </div>
      )}

      <input ref={fileInput} type="file" multiple style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />

      {/* зона/сетка */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files) }}
        style={{ ...card, padding: '14px', borderStyle: drag ? 'dashed' : 'solid', borderColor: drag ? 'var(--admin-accent)' : 'var(--admin-border-card)' }}>
        {loading ? (
          <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>{t('Loading…', 'Загрузка…')}</div>
        ) : items.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--admin-text-faint)', textAlign: 'center', padding: '18px' }}>
            {t('Drag files here or click “Upload”.', 'Перетащите файлы сюда или нажмите «Загрузить».')}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
            {items.map((f) => {
              const canDelete = entityType === 'client' ? (me.isAdmin || f.uploaded_by === me.id) : true
              const img = isImage(f.mime_type) ? previews[f.storage_path] : null
              return (
                <div key={f.link_id} style={{ ...card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <button type="button" onClick={() => openFile(f)}
                    style={{ border: 'none', padding: 0, margin: 0, cursor: 'pointer', background: 'var(--admin-input)', height: '96px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                    title={t('Open', 'Открыть')}>
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={f.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em', color: isPdf(f.mime_type) ? '#B24A42' : 'var(--admin-text-muted)' }}>
                        {isPdf(f.mime_type) ? 'PDF' : extOf(f.file_name)}
                      </span>
                    )}
                  </button>
                  <div style={{ padding: '8px 9px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <div style={{ fontSize: '12px', color: 'var(--admin-text)', wordBreak: 'break-word', lineHeight: 1.3 }}>{f.file_name}</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--admin-text-faint)' }}>{fmtSize(f.size_bytes)}</div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '2px' }}>
                      <button type="button" onClick={() => openFile(f, true)} title={t('Download', 'Скачать')}
                        style={{ background: 'none', border: 'none', color: 'var(--admin-accent)', cursor: 'pointer', fontSize: '11px', padding: 0, fontFamily: 'inherit' }}>
                        ↓ {t('Download', 'Скачать')}
                      </button>
                      {clientTargets.length === 1 && (
                        <button type="button" onClick={() => addToClient(f, clientTargets[0].id)}
                          title={t('Add to client files', 'В файлы клиента')}
                          style={{ background: 'none', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', fontSize: '11px', padding: 0, fontFamily: 'inherit' }}>
                          → {t('client', 'клиент')}
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" onClick={() => handleRemove(f)}
                          title={entityType === 'client' ? t('Delete', 'Удалить') : t('Remove', 'Открепить')}
                          style={{ background: 'none', border: 'none', color: 'var(--admin-danger)', cursor: 'pointer', fontSize: '11px', padding: 0, marginLeft: 'auto', fontFamily: 'inherit' }}>
                          {entityType === 'client' ? '🗑' : '✕'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* просмотрщик поверх */}
      {viewer && (
        <div onClick={() => setViewer(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }} onClick={(e) => e.stopPropagation()}>
            <span style={{ color: '#fff', fontSize: '14px' }}>{viewer.name}</span>
            <a href={viewer.url} download style={{ ...btn, textDecoration: 'none' }}>↓ {t('Download', 'Скачать')}</a>
            <button type="button" onClick={() => setViewer(null)} style={{ ...btn }}>✕ {t('Close', 'Закрыть')}</button>
          </div>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(1000px, 94vw)', height: '82vh', background: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
            {viewer.pdf
              ? <iframe src={viewer.url} title={viewer.name} style={{ width: '100%', height: '100%', border: 'none' }} />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={viewer.url} alt={viewer.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
          </div>
        </div>
      )}

      {/* пикер «из файлов клиента» */}
      {pickerFor && (
        <ClientFilePicker client={pickerFor} onClose={() => setPickerFor(null)} onPick={attachFromClient} />
      )}
    </div>
  )
}

function ClientFilePicker({ client, onClose, onPick }: { client: ClientLite; onClose: () => void; onPick: (ids: string[]) => void }) {
  const t = useT()
  const [files, setFiles] = useState<FileRow[] | null>(null)
  const [sel, setSel] = useState<Set<string>>(new Set())

  useEffect(() => { getClientFiles(client.id).then(setFiles) }, [client.id])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 101, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 'min(520px, 94vw)', maxHeight: '80vh', overflowY: 'auto', padding: '18px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600 }}>{t('Files of', 'Файлы клиента')} {client.name}</h3>
        {files === null ? (
          <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>{t('Loading…', 'Загрузка…')}</div>
        ) : files.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--admin-text-faint)' }}>{t('This client has no files yet.', 'У клиента пока нет файлов.')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {files.map((f) => {
              const on = sel.has(f.id)
              return (
                <button key={f.id} type="button"
                  onClick={() => setSel((s) => { const n = new Set(s); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n })}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 11px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', border: `1px solid ${on ? 'var(--admin-accent)' : 'var(--admin-border-card)'}`, background: on ? 'var(--admin-hover)' : 'transparent' }}>
                  <span style={{ width: '18px', height: '18px', borderRadius: '5px', flex: 'none', border: `1.6px solid ${on ? 'var(--admin-accent)' : 'var(--admin-text-faint)'}`, background: on ? 'var(--admin-accent)' : 'transparent', color: '#20242c', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
                  <span style={{ fontSize: '13px', color: 'var(--admin-text)', flex: 1, wordBreak: 'break-word' }}>{f.file_name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--admin-text-faint)' }}>{fmtSize(f.size_bytes)}</span>
                </button>
              )
            })}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button type="button" onClick={onClose} style={{ ...btn }}>{t('Cancel', 'Отмена')}</button>
          <button type="button" disabled={sel.size === 0} onClick={() => onPick(Array.from(sel))}
            style={{ ...btn, fontWeight: 600, background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', opacity: sel.size === 0 ? 0.5 : 1 }}>
            {t('Attach', 'Прикрепить')}{sel.size ? ` (${sel.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
