'use client'

import { useState } from 'react'
import { useTransition } from 'react'
import { updateCompany } from './actions'
import ImageUploader from '@/app/admin/_components/image-uploader'

type Company = {
  logo_url: string | null
  accent_color: string | null
  contact_email: string | null
  contact_phone: string | null
  website_url: string | null
  office_address: string | null
  footer_note: string | null
  socials: Record<string, string> | null
}

export default function BrandSettingsForm({ company }: { company: Company }) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [color, setColor] = useState(company.accent_color || 'var(--admin-accent)')
  const [logo, setLogo] = useState(company.logo_url || '')

  const socials = company.socials || {}

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSaved(false)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await updateCompany(formData)
        setSaved(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка сохранения')
      }
    })
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: '14px',
    background: 'var(--admin-card)',
    border: '1px solid var(--admin-border)',
    borderRadius: '6px',
    color: 'var(--admin-text)',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--admin-text-muted)',
    marginBottom: '4px',
    display: 'block',
  }

  return (
    <form onSubmit={handleSubmit} style={{
      padding: '20px',
      border: '1px solid var(--admin-border-card)',
      borderRadius: '8px',
      background: 'var(--admin-input)',
      marginBottom: '32px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        <div>
          <ImageUploader
            value={logo}
            onChange={setLogo}
            label="Логотип"
            height={140}
          />
          <input type="hidden" name="logo_url" value={logo} />
        </div>

        <div>
          <label style={labelStyle}>Акцентный цвет</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: '44px', height: '38px', padding: '2px', background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '6px', cursor: 'pointer' }}
            />
            <input
              type="text"
              name="accent_color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="var(--admin-accent)"
              style={{ ...inputStyle, width: '120px' }}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Email</label>
          <input type="text" name="contact_email" defaultValue={company.contact_email || ''} placeholder="concierge@brand.com" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Телефон</label>
          <input type="text" name="contact_phone" defaultValue={company.contact_phone || ''} placeholder="+971 ..." style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Сайт</label>
          <input type="text" name="website_url" defaultValue={company.website_url || ''} placeholder="https://..." style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Адрес офиса</label>
          <input type="text" name="office_address" defaultValue={company.office_address || ''} placeholder="9 Rue de la Paix, Paris, France" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Подпись в футере</label>
          <input type="text" name="footer_note" defaultValue={company.footer_note || ''} placeholder="Sky Travel · Dubai" style={inputStyle} />
        </div>

        <div style={{ height: '1px', background: 'var(--admin-border-card)' }} />
        <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-faint)' }}>
          Соцсети
        </div>

        <div>
          <label style={labelStyle}>WhatsApp</label>
          <input type="text" name="social_whatsapp" defaultValue={socials.whatsapp || ''} placeholder="https://wa.me/..." style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Instagram</label>
          <input type="text" name="social_instagram" defaultValue={socials.instagram || ''} placeholder="https://instagram.com/..." style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Telegram</label>
          <input type="text" name="social_telegram" defaultValue={socials.telegram || ''} placeholder="https://t.me/..." style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Facebook</label>
          <input type="text" name="social_facebook" defaultValue={socials.facebook || ''} placeholder="https://facebook.com/..." style={inputStyle} />
        </div>

      </div>

      {error && (
        <div style={{ color: 'var(--admin-danger)', fontSize: '13px', marginTop: '12px' }}>{error}</div>
      )}
      {saved && (
        <div style={{ color: 'var(--admin-success)', fontSize: '13px', marginTop: '12px' }}>Сохранено.</div>
      )}

      <button
        type="submit"
        disabled={isPending}
        style={{
          marginTop: '16px',
          padding: '10px 18px',
          fontSize: '13px',
          fontWeight: 500,
          background: 'var(--admin-text-on-dark)',
          color: 'var(--admin-dark-panel)',
          border: 'none',
          borderRadius: '8px',
          cursor: isPending ? 'wait' : 'pointer',
          opacity: isPending ? 0.4 : 1,
          fontFamily: 'inherit',
        }}
      >
        {isPending ? 'Сохранение...' : 'Сохранить'}
      </button>
    </form>
  )
}