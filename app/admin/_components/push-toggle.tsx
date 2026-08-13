'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/i18n-client'
import { savePushSubscription, deletePushSubscription } from '@/app/admin/tasks/push-actions'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = atob(base64)
    const arr = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
    return arr
}

type State = 'unsupported' | 'default' | 'granted' | 'denied' | 'busy'

const rowSt: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
    background: 'transparent', border: 'none', borderTop: '1px solid var(--admin-border-card)',
    fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
}

export default function PushToggle() {
    const t = useT()
    const [state, setState] = useState<State>('default')

    useEffect(() => {
        if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            setState('unsupported'); return
        }
        setState(Notification.permission as State)
    }, [])

    async function enable() {
        const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!key) { alert(t('Push notifications are not configured yet.', 'Пуш-уведомления ещё не настроены (нет ключа).')); return }
        setState('busy')
        try {
            const perm = await Notification.requestPermission()
            if (perm !== 'granted') { setState(perm as State); return }
            const reg = await navigator.serviceWorker.register('/sw.js')
            await navigator.serviceWorker.ready
            const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) as BufferSource })
            const json = sub.toJSON()
            await savePushSubscription({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh || '', auth: json.keys?.auth || '' })
            setState('granted')
        } catch {
            setState('default')
        }
    }

    async function disable() {
        setState('busy')
        try {
            const reg = await navigator.serviceWorker.getRegistration()
            const sub = await reg?.pushManager.getSubscription()
            if (sub) { await deletePushSubscription(sub.endpoint); await sub.unsubscribe() }
        } catch { /* ignore */ }
        setState('default')
    }

    if (state === 'unsupported') return null

    if (state === 'granted') {
        return (
            <button type="button" onClick={disable} style={{ ...rowSt, color: 'var(--admin-text-muted)' }}>
                🔔 {t('Notifications on — turn off here', 'Уведомления включены — выключить')}
            </button>
        )
    }
    if (state === 'denied') {
        return (
            <div style={{ ...rowSt, color: 'var(--admin-text-faint)', cursor: 'default' }}>
                {t('Notifications blocked in browser settings', 'Уведомления заблокированы в настройках браузера')}
            </div>
        )
    }
    return (
        <button type="button" onClick={enable} disabled={state === 'busy'} style={{ ...rowSt, color: 'var(--admin-accent)' }}>
            {state === 'busy' ? t('Enabling…', 'Включаю…') : `🔔 ${t('Enable push in this browser', 'Включить уведомления в этом браузере')}`}
        </button>
    )
}