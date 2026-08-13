'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useT } from '@/lib/i18n-client'
import { getMyBellTasks, type TaskRow } from '@/app/admin/tasks/actions'

export default function TaskBell() {
    const t = useT()
    const pathname = usePathname()
    const [items, setItems] = useState<TaskRow[]>([])
    const [open, setOpen] = useState(false)

    useEffect(() => {
        let cancelled = false
        getMyBellTasks().then((rows) => { if (!cancelled) setItems(rows) }).catch(() => { })
        return () => { cancelled = true }
    }, [pathname])

    const count = items.length

    function fmtDue(due: string | null): { text: string; over: boolean } {
        if (!due) return { text: '', over: false }
        const d = new Date(due)
        if (d < new Date()) return { text: t('overdue', 'просрочено'), over: true }
        const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        return { text: time !== '00:00' ? `${t('today', 'сегодня')} ${time}` : t('today', 'сегодня'), over: false }
    }

    return (
        <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setOpen((v) => !v)} aria-label={t('Notifications', 'Уведомления')}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--admin-text-muted)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {count > 0 && (
                    <span style={{ position: 'absolute', top: '2px', right: '2px', minWidth: '15px', height: '15px', padding: '0 3px', borderRadius: '999px', background: 'var(--admin-danger)', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                        {count}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', zIndex: 41, width: '320px', maxHeight: '400px', overflowY: 'auto', background: 'var(--admin-card)', border: '1px solid var(--admin-border-card)', borderRadius: '10px', boxShadow: '0 16px 40px rgba(0,0,0,0.5)', padding: '6px' }}>
                        <div style={{ padding: '8px 12px', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', fontWeight: 500 }}>
                            {t('Due & overdue', 'Горит и просрочено')}
                        </div>
                        {count === 0 ? (
                            <div style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--admin-text-faint)' }}>
                                {t('Nothing urgent. ', 'Ничего срочного. ')}🎉
                            </div>
                        ) : (
                            items.slice(0, 7).map((task) => {
                                const due = fmtDue(task.due_at)
                                return (
                                    <Link key={task.id} href={task.context_url || '/admin/tasks'} onClick={() => setOpen(false)}
                                        style={{ display: 'block', padding: '9px 12px', borderRadius: '6px', textDecoration: 'none', color: 'var(--admin-text)' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-input)' }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                                        <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                                        <div style={{ fontSize: '11px', marginTop: '2px', color: due.over ? 'var(--admin-danger)' : 'var(--admin-warn, #e0a944)' }}>
                                            {due.text}{task.context_label ? ` · ${task.context_label}` : ''}
                                        </div>
                                    </Link>
                                )
                            })
                        )}
                        <Link href="/admin/tasks" onClick={() => setOpen(false)}
                            style={{ display: 'block', padding: '10px 12px', marginTop: '4px', borderTop: '1px solid var(--admin-border-card)', fontSize: '12px', color: 'var(--admin-accent)', textDecoration: 'none' }}>
                            {t('All my tasks →', 'Все мои задачи →')}
                        </Link>
                    </div>
                </>
            )}
        </div>
    )
}