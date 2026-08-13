'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import CreateTaskButton, { type TaskContext } from './create-task-button'
import { getEntityContext, type TaskEntityType } from '@/app/admin/tasks/actions'

// какой сегмент маршрута → какой тип задачи
const BASE_TO_TYPE: Record<string, TaskEntityType> = {
    requests: 'request',
    bookings: 'booking',
    proposals: 'proposal',
    vouchers: 'voucher',
    library: 'library',
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function TaskFab() {
    const pathname = usePathname()
    const [ctx, setCtx] = useState<TaskContext>({ entityType: 'general' })

    useEffect(() => {
        const parts = (pathname || '').split('/').filter(Boolean) // ['admin','bookings','<uuid>', ...]
        const base = parts[1]
        const seg = parts[2]
        const type = base ? BASE_TO_TYPE[base] : undefined

        if (type && seg && UUID_RE.test(seg)) {
            let cancelled = false
            getEntityContext(type, seg)
                .then((res) => {
                    if (cancelled) return
                    setCtx({ entityType: type, entityId: seg, label: res.label, url: res.url, clientId: res.client_id, partnerId: res.partner_id })
                })
                .catch(() => { if (!cancelled) setCtx({ entityType: type, entityId: seg }) })
            return () => { cancelled = true }
        }
        setCtx({ entityType: 'general' })
    }, [pathname])

    // ключ включает подпись: как только контекст догрузился, кнопка пересобирается
    // с уже готовыми начальными значениями формы
    const key = `${ctx.entityType}:${ctx.entityId ?? ''}:${ctx.label ?? ''}`
    return <CreateTaskButton key={key} variant="fab" context={ctx} />
}