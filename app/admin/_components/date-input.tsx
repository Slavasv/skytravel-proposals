'use client'

import { useRef } from 'react'

// Поле даты с маской DD/MM/YYYY.
// Хранит и отдаёт значение строго в формате "ДД/ММ/ГГГГ" (или пустую строку / частичный ввод).
// Только цифры, слеши подставляются автоматически, можно править отдельные цифры.

type Props = {
  value: string
  onChange: (value: string) => void
  style?: React.CSSProperties
  readOnly?: boolean
  placeholder?: string
}

// оставляет только цифры, максимум 8 (ддммгггг), форматирует как ДД/ММ/ГГГГ
function formatMasked(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 8)
  const parts: string[] = []
  parts.push(d.slice(0, 2))
  if (d.length > 2) parts.push(d.slice(2, 4))
  if (d.length > 4) parts.push(d.slice(4, 8))
  return parts.join('/')
}

export default function DateInput({ value, onChange, style, readOnly, placeholder = 'dd/mm/yyyy' }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    // все цифры из текущего ввода
    const digits = raw.replace(/\D/g, '')
    onChange(formatMasked(digits))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Backspace: убираем последнюю цифру (игнорируя слеши)
    if (e.key === 'Backspace') {
      e.preventDefault()
      const digits = value.replace(/\D/g, '')
      onChange(formatMasked(digits.slice(0, -1)))
    }
  }

  const baseStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '14px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
    letterSpacing: '0.03em',
    ...style,
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      readOnly={readOnly}
      placeholder={placeholder}
      style={baseStyle}
      maxLength={10}
    />
  )
}