'use client'

import { useEffect } from 'react'

// Граница ошибок админки. Главная задача — самовосстановление после деплоя:
// если сработал «устаревший» серверный экшен (Server Action not found), вместо
// мёртвого экрана «This page couldn't load» страница один раз сама перезагружается
// и подтягивает свежую сборку. Защита от петли — не чаще раза в 20 секунд.
export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        try {
            const key = 'admin-error-reloaded-at'
            const last = Number(sessionStorage.getItem(key) || '0')
            if (Date.now() - last > 20000) {
                sessionStorage.setItem(key, String(Date.now()))
                location.reload()
                return
            }
        } catch {
            /* sessionStorage недоступен — просто покажем экран ниже */
        }
        // намеренно один раз, при монтировании
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'system-ui' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>
                Обновляем приложение…
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--admin-text-muted)', margin: '0 0 20px' }}>
                Если страница не обновилась сама — нажмите «Обновить».
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button type="button" onClick={() => location.reload()}
                    style={{ padding: '10px 20px', fontSize: '14px', border: 'none', borderRadius: '8px', background: 'var(--admin-text-on-dark, #111)', color: 'var(--admin-dark-panel, #fff)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Обновить
                </button>
                <button type="button" onClick={() => reset()}
                    style={{ padding: '10px 20px', fontSize: '14px', border: '1px solid var(--admin-border, #ccc)', borderRadius: '8px', background: 'transparent', color: 'var(--admin-text, inherit)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Повторить
                </button>
            </div>
        </div>
    )
}
