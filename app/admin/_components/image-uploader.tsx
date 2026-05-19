'use client'

import { useState, useRef, useEffect } from 'react'
import { uploadImage, deleteImageIfOurs, type UploadProgress } from '@/lib/upload-image'

type Props = {
  value: string
  onChange: (url: string) => void
  label?: string
  height?: number
}

type Stage = 'idle' | 'compressing' | 'uploading' | 'done' | 'error'

export default function ImageUploader({ value, onChange, label = 'Image', height = 180 }: Props) {
  const [stage, setStage] = useState<Stage>('idle')
  const [percent, setPercent] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [urlInputOpen, setUrlInputOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState(value)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync urlDraft с value когда value меняется снаружи (например при загрузке файла)
  useEffect(() => {
    setUrlDraft(value)
  }, [value])

  // Paste handler (на уровне document когда фокус на нашей зоне)
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      // Только если фокус внутри нашего компонента
      if (!containerRef.current?.contains(document.activeElement)
          && document.activeElement !== document.body) return

      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            handleFile(file)
            return
          }
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  async function handleFile(file: File) {
    // Базовая валидация
    if (!file.type.startsWith('image/')) {
      setStage('error')
      setErrorMsg('Please select an image file')
      return
    }

    setStage('compressing')
    setPercent(0)
    setErrorMsg(null)

    // Удалим старую картинку из Storage если она была наша
    const oldUrl = value
    if (oldUrl) {
      deleteImageIfOurs(oldUrl).catch(() => {/* ignore */})
    }

    try {
      const result = await uploadImage(file, (progress: UploadProgress) => {
        setStage(progress.stage === 'done' ? 'done' : progress.stage)
        setPercent(progress.percent)
      })

      onChange(result.url)
      setStage('done')
      setPercent(100)

      // Через секунду снова в idle
      setTimeout(() => {
        if (stage !== 'error') setStage('idle')
      }, 1200)
    } catch (err) {
      setStage('error')
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  function handleClick() {
    if (stage === 'compressing' || stage === 'uploading') return
    fileInputRef.current?.click()
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Сброс инпута чтобы можно было загрузить тот же файл повторно
    e.target.value = ''
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (stage !== 'compressing' && stage !== 'uploading') {
      setIsDragOver(true)
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (stage === 'compressing' || stage === 'uploading') return

    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation()
    if (value) {
      deleteImageIfOurs(value).catch(() => {/* ignore */})
    }
    onChange('')
    setStage('idle')
  }

  function applyUrl() {
    if (urlDraft !== value) {
      // Если старая была наша из Storage, удалим её
      if (value) {
        deleteImageIfOurs(value).catch(() => {/* ignore */})
      }
      onChange(urlDraft)
    }
    setUrlInputOpen(false)
  }

  const isBusy = stage === 'compressing' || stage === 'uploading'
  const hasImage = Boolean(value) && stage !== 'compressing' && stage !== 'uploading'

  return (
    <div ref={containerRef}>
      <label style={{
        display: 'block',
        fontSize: '11px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#888780',
        marginBottom: '6px',
        fontWeight: 500,
      }}>
        {label}
      </label>

      {/* Drop zone */}
      <div
        onClick={hasImage ? undefined : handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        tabIndex={0}
        style={{
          position: 'relative',
          height: `${height}px`,
          borderRadius: '8px',
          border: `1px ${isDragOver ? 'solid' : 'dashed'} ${isDragOver ? '#FAF8F4' : '#333'}`,
          background: hasImage
            ? `url(${value}) center/cover no-repeat`
            : isDragOver ? '#1a1a1a' : '#0d0d0d',
          cursor: isBusy ? 'wait' : hasImage ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '8px',
          color: '#888780',
          fontSize: '13px',
          overflow: 'hidden',
          transition: 'border-color 0.15s, background-color 0.15s',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          if (!hasImage && !isBusy) {
            e.currentTarget.style.borderColor = '#555'
          }
        }}
        onMouseLeave={(e) => {
          if (!hasImage && !isBusy && !isDragOver) {
            e.currentTarget.style.borderColor = '#333'
          }
        }}
      >
        {isBusy && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(13, 13, 13, 0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '12px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '13px', color: '#E5E2DA' }}>
              {stage === 'compressing' ? 'Compressing...' : 'Uploading...'}
            </div>
            <div style={{
              width: '60%',
              maxWidth: '300px',
              height: '4px',
              background: '#2A2A28',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${percent}%`,
                height: '100%',
                background: '#C8A862',
                transition: 'width 0.2s',
              }} />
            </div>
            <div style={{ fontSize: '11px', color: '#888780' }}>{percent}%</div>
          </div>
        )}

        {!hasImage && !isBusy && (
          <>
            <div style={{ fontSize: '24px', color: '#555', lineHeight: 1 }}>↑</div>
            <div style={{ fontSize: '13px', color: '#888780' }}>
              {isDragOver ? 'Drop image here' : 'Drop image here, or click to browse'}
            </div>
            <div style={{ fontSize: '11px', color: '#555' }}>
              JPG, PNG, WebP, HEIC · also paste from clipboard
            </div>
          </>
        )}

        {hasImage && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            display: 'flex',
            gap: '6px',
          }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleClick() }}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                background: 'rgba(20, 20, 20, 0.85)',
                color: '#E5E2DA',
                border: '1px solid #444',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                backdropFilter: 'blur(4px)',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(40, 40, 40, 0.95)'
                e.currentTarget.style.borderColor = '#666'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(20, 20, 20, 0.85)'
                e.currentTarget.style.borderColor = '#444'
              }}
            >
              Replace
            </button>
            <button
              type="button"
              onClick={handleRemove}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                background: 'rgba(20, 20, 20, 0.85)',
                color: '#E07B7B',
                border: '1px solid #444',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                backdropFilter: 'blur(4px)',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(60, 30, 30, 0.95)'
                e.currentTarget.style.borderColor = '#7a3a3a'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(20, 20, 20, 0.85)'
                e.currentTarget.style.borderColor = '#444'
              }}
            >
              Remove
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Error message */}
      {stage === 'error' && errorMsg && (
        <div style={{ fontSize: '12px', color: '#E07B7B', marginTop: '6px' }}>
          {errorMsg}
        </div>
      )}

      {/* URL fallback */}
      <div style={{ marginTop: '8px' }}>
        {!urlInputOpen ? (
          <button
            type="button"
            onClick={() => setUrlInputOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: '#888780',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              textDecorationColor: '#444',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#E5E2DA' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#888780' }}
          >
            Or paste URL (Unsplash, etc.)
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="text"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://..."
              style={{
                flex: 1,
                padding: '8px 10px',
                fontSize: '12px',
                color: '#E5E2DA',
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '6px',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
            />
            <button
              type="button"
              onClick={applyUrl}
              style={{
                padding: '8px 14px',
                fontSize: '12px',
                fontWeight: 500,
                background: '#FAF8F4',
                color: '#2C2C2A',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#FFFFFF' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#FAF8F4' }}
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => { setUrlDraft(value); setUrlInputOpen(false) }}
              style={{
                padding: '8px 10px',
                fontSize: '12px',
                background: 'transparent',
                color: '#888780',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#E5E2DA' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#888780' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}