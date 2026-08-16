'use client'

import { useEffect, useState, useCallback } from 'react'
import { useT } from '@/lib/i18n-client'
import CreateTaskButton from './create-task-button'
import {
    getEntityTasks, getEntityContext, updateTask,
    type TaskRow, type TaskEntityType, type TaskPriority,
} from '@/app/admin/tasks/actions'

const PRIO_COLOR: Record<TaskPriority, string> = {
    high: 'var(--admin-danger)',
    normal: 'var(--admin-warn, #e0a944)',
    low: 'var(--admin-text-faint)',
}

function initials(name: string | null): string {
    if (!name) return '—'
    const parts = name.trim().split(/\s+/).slice(0, 2)
    return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '—'
}

export default function EntityTasks({ entityType, entityId, currentUserId }: {
    entityType: TaskEntityType
    entityId: string
    currentUserId: string
}) {
    const t = useT()
    const [tasks, setTasks] = useState<TaskRow[]>([])
    const [ctx, setCtx] = useState<{ label: string | null; url: string | null; clientId: string | null; partnerId: string | null }>({ label: null, url: null, clientId: null, partnerId: null })
    const [ready, setReady] = useState(false)

    const load = useCallback(async () => {
        const rows = await getEntityTasks(entityType, entityId)
        setTasks(rows)
        setReady(true)
    }, [entityType, entityId])

    useEffect(() => {
        load()
        getEntityContext(entityType, entityId)
            .then((r) => setCtx({ label: r.label, url: r.url, clientId: r.client_id, partnerId: r.partner_id }))
            .catch(() => { })
    }, [load, entityType, entityId])

    async function complete(id: string) {
        setTasks((p) => p.filter((x) => x.id !== id))
        await updateTask(id, { status: 'done' })
        load()
    }

    function fmtDue(due: string | null): { text: string; over: boolean } {
        if (!due) return { text: '', over: false }
        const d = new Date(due)
        const now = new Date()
        if (d < now) return { text: t('overdue', 'просрочено'), over: true }
        return { text: d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), over: false }
    }

    return (
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--admin-border-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', fontWeight: 500 }}>
                    {t('Tasks', 'Задачи')}{ready && tasks.length > 0 ? ` · ${tasks.length}` : ''}
                </div>
                <CreateTaskButton
                    variant="inline"
                    context={{ entityType, entityId, label: ctx.label, url: ctx.url, clientId: ctx.clientId, partnerId: ctx.partnerId }}
                    onCreated={load}
                />
            </div>

            {!ready ? null : tasks.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--admin-text-faint)' }}>
                    {t('No open tasks.', 'Открытых задач нет.')}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {tasks.map((task) => {
                            const due = fmtDue(task.due_at)
                            const editable = task.assignee_id === currentUserId || task.creator_id === currentUserId
                            return (
                                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-input)' }}>
                                    {editable ? (
                                        <button type="button" title={t('Mark done', 'Отметить выполненной')} onClick={() => complete(task.id)}
                                            style={{ width: '18px', height: '18px', borderRadius: '50%', flex: 'none', cursor: 'pointer', border: '1.6px solid var(--admin-text-faint)', background: 'transparent', fontFamily: 'inherit' }} />
                                    ) : (
                                        <span style={{ width: '18px', height: '18px', borderRadius: '50%', flex: 'none', border: '1.6px solid var(--admin-border-card)', background: 'transparent' }} />
                                    )}
                        
                                <span style={{ width: '5px', height: '24px', borderRadius: '3px', flex: 'none', background: PRIO_COLOR[task.priority] }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', color: 'var(--admin-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                                    {task.status === 'in_progress' && (
                                        <div style={{ fontSize: '11px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>{t('In progress', 'В работе')}</div>
                                    )}
                                </div>
                                {due.text && (
                                    <span style={{ fontSize: '12px', whiteSpace: 'nowrap', color: due.over ? 'var(--admin-danger)' : 'var(--admin-text-muted)' }}>{due.text}</span>
                                )}
                                <div title={task.assignee_name || t('Unassigned', 'Не назначено')}
                                    style={{ width: '24px', height: '24px', borderRadius: '50%', flex: 'none', background: task.assignee_name ? 'var(--admin-card)' : 'transparent', border: task.assignee_name ? 'none' : '1px dashed var(--admin-text-faint)', color: 'var(--admin-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                                    {task.assignee_name ? initials(task.assignee_name) : '?'}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}