'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n-client'
import { superadminResetPassword, superadminUpdateOwnerEmail, deleteCompany } from './actions'

export type CompanyRow = {
  id: string
  name: string
  slug: string
  is_active: boolean | null
  ownerEmail: string
  userCount: number
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', fontSize: '13px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}
const btnDark: React.CSSProperties = {
  padding: '8px 14px', fontSize: '13px', fontWeight: 500, background: 'var(--admin-text-on-dark)',
  color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit',
}
const btnGhost: React.CSSProperties = {
  padding: '8px 14px', fontSize: '13px', background: 'transparent', color: 'var(--admin-text-muted)',
  border: '1px solid var(--admin-border)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit',
}

function randomPassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

type Panel = 'none' | 'menu' | 'password' | 'email' | 'delete'

function CompanyCard({ c }: { c: CompanyRow }) {
  const t = useT()
  const router = useRouter()
  const [panel, setPanel] = useState<Panel>('none')
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  // поля панелей
  const [pwd, setPwd] = useState('')
  const [pwdDone, setPwdDone] = useState(false)
  const [email, setEmail] = useState(c.ownerEmail)
  const [delName, setDelName] = useState('')

  function reset() {
    setPanel('none'); setMsg(null); setPwd(''); setPwdDone(false); setEmail(c.ownerEmail); setDelName('')
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  function doResetPassword() {
    setMsg(null)
    startTransition(async () => {
      const r = await superadminResetPassword(c.id, pwd)
      if (r.ok) { setPwdDone(true); setMsg({ kind: 'ok', text: t('Password changed — copy it and pass it on.', 'Пароль изменён — скопируйте и передайте.') }) }
      else setMsg({ kind: 'err', text: r.error || t('Error', 'Ошибка') })
    })
  }

  function doUpdateEmail() {
    setMsg(null)
    startTransition(async () => {
      const r = await superadminUpdateOwnerEmail(c.id, email)
      if (r.ok) { setMsg({ kind: 'ok', text: t('Login updated', 'Логин изменён') }); router.refresh() }
      else setMsg({ kind: 'err', text: r.error || t('Error', 'Ошибка') })
    })
  }

  function doDelete() {
    setMsg(null)
    startTransition(async () => {
      const r = await deleteCompany(c.id, delName)
      if (r.ok) router.refresh()
      else setMsg({ kind: 'err', text: r.error || t('Error', 'Ошибка') })
    })
  }

  const nameMatches = delName.trim().toLowerCase() === c.name.trim().toLowerCase()

  return (
    <li style={{ padding: '16px', border: '1px solid var(--admin-border-card)', borderRadius: '8px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 500, color: 'var(--admin-text)' }}>
            {c.name}{!c.is_active && <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', fontWeight: 400 }}> · {t('archived', 'архив')}</span>}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginTop: '4px' }}>
            slug: {c.slug}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--admin-text)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--admin-text-muted)' }}>{t('login:', 'логин:')}</span>
            <span style={{ fontWeight: 500 }}>{c.ownerEmail || t('no owner', 'нет владельца')}</span>
            {c.ownerEmail && (
              <button type="button" onClick={() => copy(c.ownerEmail)} title={t('Copy', 'Скопировать')}
                style={{ ...btnGhost, padding: '2px 8px', fontSize: '11px' }}>{t('copy', 'копировать')}</button>
            )}
            {c.userCount > 1 && (
              <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>· {t(`+${c.userCount - 1} more staff`, `ещё ${c.userCount - 1} сотр.`)}</span>
            )}
          </div>
        </div>

        <button type="button" onClick={() => setPanel(panel === 'menu' ? 'none' : 'menu')} aria-label={t('Actions', 'Действия')}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--admin-text-muted)', fontSize: '18px', lineHeight: 1, padding: '4px 8px', flexShrink: 0, fontFamily: 'inherit' }}>⋯</button>
      </div>

      {panel === 'menu' && (
        <>
          <div onClick={() => setPanel('none')} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
          <div style={{ position: 'absolute', top: '44px', right: '14px', background: 'var(--admin-input)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '4px', minWidth: '190px', zIndex: 2, boxShadow: '0 6px 20px rgba(0,0,0,0.4)' }}>
            <button type="button" onClick={() => { setMsg(null); setPanel('password') }} style={menuItem}>{t('Reset password', 'Сбросить пароль')}</button>
            <button type="button" onClick={() => { setMsg(null); setEmail(c.ownerEmail); setPanel('email') }} style={menuItem}>{t('Change login (email)', 'Изменить логин (email)')}</button>
            <button type="button" onClick={() => { setMsg(null); setDelName(''); setPanel('delete') }} style={{ ...menuItem, color: 'var(--admin-danger)' }}>{t('Delete brand', 'Удалить бренд')}</button>
          </div>
        </>
      )}

      {panel === 'password' && (
        <div style={panelBox}>
          <div style={panelTitle}>{t('Reset owner password', 'Сброс пароля владельца')}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input type="text" value={pwd} onChange={(e) => { setPwd(e.target.value); setPwdDone(false) }} placeholder={t('New password (min 6)', 'Новый пароль (от 6)')} style={{ ...inputStyle, flex: 1, minWidth: '160px' }} />
            <button type="button" onClick={() => { setPwd(randomPassword()); setPwdDone(false) }} style={btnGhost}>{t('Generate', 'Сгенерировать')}</button>
          </div>
          {pwd && <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '6px' }}>{t('Password to pass on:', 'Пароль для передачи:')} <b style={{ color: 'var(--admin-text)' }}>{pwd}</b> {pwdDone && <button type="button" onClick={() => copy(pwd)} style={{ ...btnGhost, padding: '1px 7px', fontSize: '11px', marginLeft: '6px' }}>{t('copy', 'копировать')}</button>}</div>}
          <div style={panelActions}>
            <button type="button" disabled={pending || pwd.length < 6} onClick={doResetPassword} style={{ ...btnDark, opacity: pending || pwd.length < 6 ? 0.5 : 1 }}>{pending ? '…' : t('Save', 'Сохранить')}</button>
            <button type="button" onClick={reset} style={btnGhost}>{t('Close', 'Закрыть')}</button>
          </div>
          {msg && <div style={{ fontSize: '12px', marginTop: '8px', color: msg.kind === 'ok' ? 'var(--admin-success)' : 'var(--admin-danger)' }}>{msg.text}</div>}
        </div>
      )}

      {panel === 'email' && (
        <div style={panelBox}>
          <div style={panelTitle}>{t('Change owner login', 'Изменить логин владельца')}</div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@brand.com" style={inputStyle} />
          <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '6px' }}>{t('This is the login the owner signs in with.', 'Это email, которым владелец входит в систему.')}</div>
          <div style={panelActions}>
            <button type="button" disabled={pending || !email.includes('@')} onClick={doUpdateEmail} style={{ ...btnDark, opacity: pending || !email.includes('@') ? 0.5 : 1 }}>{pending ? '…' : t('Save', 'Сохранить')}</button>
            <button type="button" onClick={reset} style={btnGhost}>{t('Close', 'Закрыть')}</button>
          </div>
          {msg && <div style={{ fontSize: '12px', marginTop: '8px', color: msg.kind === 'ok' ? 'var(--admin-success)' : 'var(--admin-danger)' }}>{msg.text}</div>}
        </div>
      )}

      {panel === 'delete' && (
        <div style={{ ...panelBox, border: '1px solid var(--admin-danger)' }}>
          <div style={{ ...panelTitle, color: 'var(--admin-danger)' }}>{t('Delete brand — irreversible', 'Удалить бренд — безвозвратно')}</div>
          <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 8px', lineHeight: 1.5 }}>
            {t('This permanently removes the brand and ALL its data: logins, clients, requests, proposals, bookings, vouchers, library, accounting, tasks, Microsoft integration.',
              'Это навсегда удалит бренд и ВСЕ его данные: логины, клиентов, заявки, предложения, брони, ваучеры, библиотеку, бухгалтерию, задачи, интеграцию Microsoft.')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--admin-text)', marginBottom: '4px' }}>
            {t('Type the brand name to confirm:', 'Введите название бренда для подтверждения:')} <b>{c.name}</b>
          </div>
          <input type="text" value={delName} onChange={(e) => setDelName(e.target.value)} placeholder={c.name} style={{ ...inputStyle, borderColor: delName && !nameMatches ? 'var(--admin-danger)' : undefined }} />
          <div style={panelActions}>
            <button type="button" disabled={pending || !nameMatches} onClick={doDelete}
              style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 500, background: 'var(--admin-danger)', color: '#fff', border: 'none', borderRadius: '6px', cursor: pending || !nameMatches ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: pending || !nameMatches ? 0.5 : 1 }}>
              {pending ? '…' : t('Delete permanently', 'Удалить навсегда')}
            </button>
            <button type="button" onClick={reset} style={btnGhost}>{t('Cancel', 'Отмена')}</button>
          </div>
          {msg && <div style={{ fontSize: '12px', marginTop: '8px', color: 'var(--admin-danger)' }}>{msg.text}</div>}
        </div>
      )}
    </li>
  )
}

const menuItem: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent',
  border: 'none', color: 'inherit', fontSize: '13px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit',
}
const panelBox: React.CSSProperties = {
  marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--admin-border-card)',
}
const panelTitle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', marginBottom: '10px',
}
const panelActions: React.CSSProperties = {
  display: 'flex', gap: '8px', marginTop: '10px',
}

export default function CompaniesManager({ companies }: { companies: CompanyRow[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {companies.map((c) => <CompanyCard key={c.id} c={c} />)}
    </ul>
  )
}
