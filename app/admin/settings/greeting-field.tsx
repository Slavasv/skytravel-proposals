'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n-client'

// мини-парсер Markdown: **жирный** и *курсив* → безопасный HTML
function renderMarkdown(text: string): string {
  // экранируем HTML, чтобы нельзя было вставить теги
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // **жирный** сначала, потом *курсив*
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
}

const labelStyle: React.CSSProperties = {
  fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '4px', display: 'block',
}
const inputStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: '14px', background: 'var(--admin-card)',
  border: '1px solid var(--admin-border)', borderRadius: '6px', color: 'var(--admin-text)',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
  resize: 'vertical', lineHeight: 1.5,
}

export default function GreetingField({ defaultValue }: { defaultValue: string }) {
  const t = useT()
  const [text, setText] = useState(defaultValue)

  return (
    <div>
      <label style={labelStyle}>{t('Greeting message', 'Приветственное сообщение')}</label>
      <textarea
        name="greeting_message"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        style={inputStyle}
        placeholder={t('**Everything has been arranged** — the rest is simply yours to enjoy.', '**Всё уже устроено** — остаётся лишь наслаждаться.')}
      />
      <div style={{ fontSize: '11px', color: 'var(--admin-text-faint)', marginTop: '6px' }}>
        {t('Use', 'Используйте')} <code style={{ color: 'var(--admin-accent)' }}>**bold**</code> {t('for bold and', 'для жирного и')} <code style={{ color: 'var(--admin-accent)' }}>*italic*</code> {t('for italic.', 'для курсива.')}
      </div>

      {text.trim() && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--admin-text-faint)', marginBottom: '6px' }}>{t('Preview', 'Предпросмотр')}</div>
          <div
            style={{ padding: '12px 14px', background: 'var(--admin-input)', border: '1px solid var(--admin-border-card)', borderRadius: '6px', fontSize: '14px', lineHeight: 1.6, color: 'var(--admin-text)' }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
          />
        </div>
      )}
    </div>
  )
}