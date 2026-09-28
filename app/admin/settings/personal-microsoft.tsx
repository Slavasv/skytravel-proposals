'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useT } from '@/lib/i18n-client'
import { getMyMicrosoftStatus, disconnectMyMicrosoft } from './microsoft-actions'

const btnDark: React.CSSProperties = {
    padding: '10px 16px', fontSize: '13px', fontWeight: 500,
    background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)',
    border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
    textDecoration: 'none', display: 'inline-block',
}

// Личное подключение Microsoft: чтобы задачи, которые ТЫ назначаешь,
// уходили в Planner и на почту от твоего имени (Вариант А).
export default function PersonalMicrosoft() {
    const t = useT()
    const params = useSearchParams()
    const [status, setStatus] = useState<{ connected: boolean; email: string | null } | null>(null)
    const [busy, setBusy] = useState(false)

    const flag = params.get('ms') // me_connected | ...

    async function load() {
        setStatus(await getMyMicrosoftStatus())
    }
    useEffect(() => { load() }, [])

    async function handleDisconnect() {
        if (!confirm(t('Disconnect your Microsoft?', 'Отключить твой Microsoft?'))) return
        setBusy(true)
        await disconnectMyMicrosoft()
        await load()
        setBusy(false)
    }

    return (
        <div style={{ border: '1px solid var(--admin-border-card)', borderRadius: '8px', padding: '18px', background: 'var(--admin-input)' }}>
            {flag === 'me_connected' && (
                <div style={{ color: 'var(--admin-success)', fontSize: '13px', marginBottom: '12px' }}>
                    {t('Your Microsoft is connected ✅', 'Твой Microsoft подключён ✅')}
                </div>
            )}

            <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '14px' }}>
                {t('Connect your work Microsoft so tasks you assign go to Planner and email from your name.',
                    'Подключи свой рабочий Microsoft, чтобы задачи, которые ты назначаешь, уходили в Planner и на почту от твоего имени.')}
            </div>

            {status === null ? (
                <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>{t('Loading…', 'Загрузка…')}</div>
            ) : status.connected ? (
                <>
                    <div style={{ fontSize: '14px', color: 'var(--admin-text)', marginBottom: '14px' }}>
                        {t('Connected', 'Подключено')}{status.email ? `: ${status.email}` : ''}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <a href="/api/microsoft/connect?target=user" style={btnDark}>
                            {t('Reconnect', 'Переподключить')}
                        </a>
                        <button type="button" onClick={handleDisconnect} disabled={busy}
                            style={{ padding: '8px 14px', fontSize: '13px', background: 'transparent', color: 'var(--admin-danger)', border: '1px solid var(--admin-border)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                            {t('Disconnect', 'Отключить')}
                        </button>
                    </div>
                </>
            ) : (
                <a href="/api/microsoft/connect?target=user" style={btnDark}>
                    {t('Connect my Microsoft', 'Подключить мой Microsoft')}
                </a>
            )}
        </div>
    )
}
