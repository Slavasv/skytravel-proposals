'use client'

import { useState, useTransition } from 'react'
import { duplicateDayBlock, removeBlockFromDay } from './block-actions'
import type { DayBlock, Lang } from './edit-page-client'

type Props = {
  dayBlock: DayBlock
  lang: Lang
}

export default function DayBlockItem({ dayBlock, lang }: Props) {
  const [isPending, startTransition] = useTransition()
  const [menuOpen, setMenuOpen] = useState(false)

  const block = dayBlock.content_blocks
  const title = lang === 'ru' ? block.title_ru : block.title_en
  const description = lang === 'ru' ? block.description_ru : block.description_en
  const note = lang === 'ru' ? dayBlock.custom_note_ru : dayBlock.custom_note_en

  function handleDuplicate() {
    setMenuOpen(false)
    startTransition(async () => {
      await duplicateDayBlock(dayBlock.id)
    })
  }

  function handleRemove() {
    setMenuOpen(false)
    if (!confirm(`Remove "${title || 'this block'}" from this day?\n\nThe block stays in the library and can be added again later.`)) {
      return
    }
    startTransition(async () => {
      await removeBlockFromDay(dayBlock.id)
    })
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '88px 1fr',
        gap: '14px',
        padding: '12px',
        paddingRight: '40px',
        border: '1px solid #2A2A28',
        borderRadius: '6px',
        background: '#0d0d0d',
        opacity: isPending ? 0.4 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {/* Image */}
      <div style={{
        width: '88px',
        height: '88px',
        borderRadius: '4px',
        background: block.image_url
          ? `url(${block.image_url}) center/cover no-repeat`
          : '#222',
        flexShrink: 0,
      }} />

      {/* Content */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: '10px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#888780',
          marginBottom: '4px',
          fontWeight: 500,
        }}>
          {block.type}
          {block.location && <span style={{ color: '#555', fontWeight: 400 }}> · {block.location}</span>}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
          {title || <span style={{ color: '#888780', fontStyle: 'italic' }}>Untitled</span>}
        </div>
        {description && (
          <p style={{ fontSize: '12px', lineHeight: 1.5, color: '#888780', margin: '0 0 6px' }}>
            {description}
          </p>
        )}
        {note && (
          <div style={{
            fontSize: '12px',
            color: '#C8A862',
            background: 'rgba(200, 168, 98, 0.08)',
            border: '1px solid rgba(200, 168, 98, 0.2)',
            padding: '6px 10px',
            borderRadius: '4px',
            marginTop: '8px',
            lineHeight: 1.4,
          }}>
            {note}
          </div>
        )}
      </div>

      {/* Actions menu trigger */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setMenuOpen(!menuOpen)
        }}
        disabled={isPending}
        aria-label="Block actions"
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          background: 'transparent',
          border: 'none',
          padding: '6px 8px',
          cursor: isPending ? 'wait' : 'pointer',
          color: '#888780',
          fontSize: '14px',
          lineHeight: 1,
          borderRadius: '4px',
          fontFamily: 'inherit',
        }}
      >
        ⋯
      </button>

      {menuOpen && (
        <>
          <div
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1 }}
          />
          <div style={{
            position: 'absolute',
            top: '34px',
            right: '8px',
            background: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '8px',
            padding: '4px',
            minWidth: '140px',
            zIndex: 2,
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          }}>
            <button
              onClick={handleDuplicate}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: '#E5E2DA',
                fontSize: '13px',
                cursor: 'pointer',
                borderRadius: '4px',
                fontFamily: 'inherit',
              }}
            >
              Duplicate
            </button>
            <button
              onClick={handleRemove}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: '#E07B7B',
                fontSize: '13px',
                cursor: 'pointer',
                borderRadius: '4px',
                fontFamily: 'inherit',
              }}
            >
              Remove from day
            </button>
          </div>
        </>
      )}
    </div>
  )
}