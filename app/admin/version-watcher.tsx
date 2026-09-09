'use client'

import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n-client'

// Версия сборки, вшитая в этот клиентский бандл.
const MY_BUILD = process.env.NEXT_PUBLIC_BUILD_ID || 'dev'

// Следит за деплоями: раз в 30с (и при возврате на вкладку) спрашивает у сервера
// текущую версию. Если она отличается от нашей — вышел новый деплой, и старые
// серверные экшены на этой странице уже «не найдутся». Показываем баннер с
// перезагрузкой, чтобы вкладка обновилась ДО того, как что-то сломается.
export default function VersionWatcher() {
    const t = useT()
    const [stale, setStale] = useState(false)
    const staleRef = useRef(false)

    useEffect(() => {
        if (MY_BUILD === 'dev') return // локально не мешаем
        let stopped = false

        async function check() {
            if (staleRef.current || stopped || document.hidden) return
            try {
                const res = await fetch('/api/version', { cache: 'no-store' })
                if (!res.ok) return
                const server = (await res.text()).trim()
                if (server && server !== MY_BUILD) {
                    staleRef.current = true
                    setStale(true)
                }
            } catch {
                /* оффлайн/сеть — молчим */
            }
        }

        const id = setInterval(check, 30000)
        const onVisible = () => { if (!document.hidden) check() }
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('focus', check)
        check()

        return () => {
            stopped = true
            clearInterval(id)
            document.removeEventListener('visibilitychange', onVisible)
            window.removeEventListener('focus', check)
        }
    }, [])

    if (!stale) return null

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: 'var(--admin-accent)', color: '#fff', padding: '10px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            fontSize: '13px', fontFamily: 'inherit', boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
        }}>
            <span>{t('A new version is available — reload to keep everything working.',
                'Вышла новая версия — обновите, чтобы всё работало.')}</span>
            <button type="button" onClick={() => location.reload()}
                style={{
                    background: '#fff', color: 'var(--admin-accent)', border: 'none',
                    borderRadius: '6px', padding: '6px 14px', fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                }}>
                {t('Reload', 'Обновить')}
            </button>
        </div>
    )
}
