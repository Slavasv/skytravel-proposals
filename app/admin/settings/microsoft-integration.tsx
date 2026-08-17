'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useT } from '@/lib/i18n-client'
import { getMicrosoftStatus, disconnectMicrosoft, sendTestEmail } from './microsoft-actions'

const btnDark: React.CSSProperties = {
    padding: '10px 16px', fontSize: '13px', fontWeight: 500,
    background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)',
    border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block',
}
const inputSt: React.CSSProperties = {
    padding: '10px 12px', fontSize: '14px', background: 'var(--admin-card)',
    border: '1px solid var(--admin-border)', borderRadius: '6px', color: 'var(--admin-text)',
    fontFamily: 'inherit', outline: 'none', flex: 1, minWidth: '180px',
}

export default function MicrosoftIntegration() {
    const t = useT()
    const params = useSearchParams()
    const [status, setStatus] = useState<{ connected: boolean; email: string | null } | null>(null)
    const [testTo, setTestTo] = useState('')
    const [testMsg, setTestMsg] = useState('')
    const [busy, setBusy] = useState(false)

    const flag = params.get('ms') // connected | error | notconfigured
    const reason = params.get('reason')

    async function load() {
        const s = await getMicrosoftStatus()
        setStatus(s)
    }
    useEffect(() => { load() }, [])

    async function handleDisconnect() {
        if (!confirm(t('Disconnect Microsoft?', 'Отключить Microsoft?'))) return
        setBusy(true)
        await disconnectMicrosoft()
        await load()
        setBusy(false)
    }

    async function handleTest() {
        setTestMsg(''); setBusy(true)
        const res = await sendTestEmail(testTo)
        setBusy(false)
        setTestMsg(res.ok ? t('Sent ✅', 'Отправлено ✅') : `${t('Error', 'Ошибка')}: ${res.error || ''}`)
    }

    return (
        <div style={{ border: '1px solid var(--admin-border-card)', borderRadius: '8px', padding: '18px', background: 'var(--admin-input)' }}>
            {flag === 'connected' && <div style={{ color: 'var(--admin-success)', fontSize: '13px', marginBottom: '12px' }}>{t('Microsoft connected ✅', 'Microsoft подключён ✅')}</div>}
            {flag === 'error' && <div style={{ color: 'var(--admin-danger)', fontSize: '13px', marginBottom: '12px' }}>{t('Connection failed, try again.', 'Не удалось подключить, попробуйте ещё раз.')}{reason ? ` (${reason})` : ''}</div>}
            {flag === 'notconfigured' && <div style={{ color: 'var(--admin-danger)', fontSize: '13px', marginBottom: '12px' }}>{t('Microsoft keys are not set on the server.', 'Ключи Microsoft не заданы на сервере.')}</div>}

            {status === null ? (
                <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>{t('Loading…', 'Загрузка…')}</div>
            ) : status.connected ? (
                <>
                    <div style={{ fontSize: '14px', color: 'var(--admin-text)', marginBottom: '4px' }}>
                        {t('Connected', 'Подключено')}{status.email ? `: ${status.email}` : ''}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '14px' }}>
                        {t('This account sends emails and syncs Planner.', 'От этого аккаунта уходят письма и синхронизация Planner.')}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
                        <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)}
                            placeholder={t('Email for a test message', 'Email для тестового письма')} style={inputSt} />
                        <button type="button" onClick={handleTest} disabled={busy || !testTo} style={{ ...btnDark, opacity: busy || !testTo ? 0.5 : 1, cursor: busy ? 'wait' : 'pointer' }}>
                            {t('Send test', 'Отправить тест')}
                        </button>
                    </div>
                    {testMsg && <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '10px' }}>{testMsg}</div>}

                    <button type="button" onClick={handleDisconnect} disabled={busy}
                        style={{ padding: '8px 14px', fontSize: '13px', background: 'transparent', color: 'var(--admin-danger)', border: '1px solid var(--admin-border)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {t('Disconnect', 'Отключить')}
                    </button>
                </>
            ) : (
                <>
                    <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginBottom: '14px' }}>
                        {t('Connect the corporate Microsoft account for email and Planner sync.', 'Подключите корпоративный аккаунт Microsoft для писем и синхронизации Planner.')}
                    </div>
                    <a href="/api/microsoft/connect" style={btnDark}>{t('Connect Microsoft', 'Подключить Microsoft')}</a>
                </>
            )}
        </div>
    )
}