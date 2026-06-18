'use client'

import { useState, KeyboardEvent } from 'react'

type Props = {
  value: string[]
  onChange: (tags: string[]) => void
}

export default function TagsInput({ value, onChange }: Props) {
  const [draft, setDraft] = useState('')

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase()
    if (!tag) return
    if (value.includes(tag)) {
      setDraft('')
      return
    }
    onChange([...value, tag])
    setDraft('')
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(draft)
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px',
      padding: '8px 10px',
      border: '1px solid var(--admin-border)',
      borderRadius: '6px',
      background: 'var(--admin-input)',
      minHeight: '42px',
      alignItems: 'center',
    }}>
      {value.map((tag) => (
        <span
          key={tag}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            paddingRight: '6px',
            background: 'var(--admin-border-card)',
            color: 'var(--admin-text)',
            borderRadius: '999px',
            fontSize: '12px',
            fontFamily: 'inherit',
          }}
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            aria-label={`Remove ${tag}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '16px',
              height: '16px',
              padding: 0,
              background: 'transparent',
              border: 'none',
              color: 'var(--admin-text-muted)',
              cursor: 'pointer',
              fontSize: '14px',
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(draft)}
        placeholder={value.length === 0 ? 'Type a tag and press Enter...' : ''}
        style={{
          flex: 1,
          minWidth: '120px',
          padding: '4px 4px',
          fontSize: '13px',
          color: 'var(--admin-text)',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
    </div>
  )
}