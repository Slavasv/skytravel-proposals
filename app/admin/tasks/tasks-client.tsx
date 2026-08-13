'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n-client'
import CreateTaskButton from '@/app/admin/_components/create-task-button'
import {
    getTasks, updateTask,
    type TaskRow, type TaskFilters, type TaskStatus, type TaskPriority,
    type PersonLite, type ClientLite, type PartnerLite, type TaskEntityType,
} from './actions'

type Scope = 'mine' | 'assigned_by_me' | 'all' | 'done'

const inputSt: React.CSSProperties = {
    padding: '8px 10px', fontSize: '13px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '6px', fontFamily: 'inherit', outline: 'none',
}

const PRIO_COLOR: Record<TaskPriority, string> = {
    high: 'var(--admin-danger)',
    normal: 'var(--admin-warn, #e0a944)',
    low: 'var(--admin-text-faint)',
}

const TYPE_LABEL: Record<TaskEntityType, [string, string]> = {
    general: ['General', 'Общая'],
    request: ['Request', 'Заявка'],
    proposal: ['Proposal', 'Предложение'],
    booking: ['Booking', 'Бронь'],
    voucher: ['Voucher', 'Ваучер'],
    library: ['Library', 'Библиотека'],
}

function initials(name: string | null): string {
    if (!name) return '—'
    const parts = name.trim().split(/\s+/).slice(0, 2)
    return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '—'
}

export default function TasksClient({ initial, people, clients, partners }: {
    initial: TaskRow[]
    people: PersonLite[]
    clients: ClientLite[]
    partners: PartnerLite[]
}) {
    const t = useT()
    const [scope, setScope] = useState<Scope>('all')
    const [tasks, setTasks] = useState<TaskRow[]>(initial)
    const [loading, setLoading] = useState(false)

    // фильтры
    const [q, setQ] = useState('')
    const [priority, setPriority] = useState<TaskPriority | ''>('')
    const [assignee, setAssignee] = useState('')
    const [creator, setCreator] = useState('')
    const [clientId, setClientId] = useState('')
    const [partnerId, setPartnerId] = useState('')
    const [entityType, setEntityType] = useState<TaskEntityType | ''>('')

    const load = useCallback(async () => {
        setLoading(true)
        const filters: TaskFilters = {
            scope,
            q: q || undefined,
            priority: priority || null,
            assignee_id: assignee || null,
            creator_id: creator || null,
            client_id: clientId || null,
            partner_id: partnerId || null,
            entity_type: entityType || null,
        }
        const rows = await getTasks(filters)
        setTasks(rows)
        setLoading(false)
    }, [scope, q, priority, assignee, creator, clientId, partnerId, entityType])

    useEffect(() => {
        const timer = setTimeout(load, 250)
        return () => clearTimeout(timer)
    }, [load])

    async function setStatus(id: string, status: TaskStatus) {
        setTasks((p) => p.map((x) => (x.id === id ? { ...x, status } : x)))
        await updateTask(id, { status })
        load()
    }

    const resetFilters = () => {
        setQ(''); setPriority(''); setAssignee(''); setCreator(''); setClientId(''); setPartnerId(''); setEntityType('')
    }
    const hasFilters = q || priority || assignee || creator || clientId || partnerId || entityType

    // группировка по срочности (для активных вкладок)
    const groups = useMemo(() => {
        if (scope === 'done') return [{ key: 'done', label: t('Completed', 'Выполненные'), color: 'var(--admin-success)', items: tasks }]
        const now = new Date()
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const startTomorrow = new Date(startToday); startTomorrow.setDate(startTomorrow.getDate() + 1)
        const in7 = new Date(startToday); in7.setDate(in7.getDate() + 7)
        const buckets: Record<string, TaskRow[]> = { overdue: [], today: [], week: [], later: [], none: [] }
        for (const task of tasks) {
            if (!task.due_at) { buckets.none.push(task); continue }
            const d = new Date(task.due_at)
            if (d < now) buckets.overdue.push(task)
            else if (d < startTomorrow) buckets.today.push(task)
            else if (d < in7) buckets.week.push(task)
            else buckets.later.push(task)
        }
        return [
            { key: 'overdue', label: t('Overdue', 'Просрочено'), color: 'var(--admin-danger)', items: buckets.overdue },
            { key: 'today', label: t('Today', 'Сегодня'), color: 'var(--admin-warn, #e0a944)', items: buckets.today },
            { key: 'week', label: t('This week', 'На этой неделе'), color: 'var(--admin-blue, #5b8def)', items: buckets.week },
            { key: 'later', label: t('Later', 'Позже'), color: 'var(--admin-text-muted)', items: buckets.later },
            { key: 'none', label: t('No date', 'Без срока'), color: 'var(--admin-text-faint)', items: buckets.none },
        ].filter((g) => g.items.length > 0)
    }, [tasks, scope, t])

    const tabs: { value: Scope; label: string }[] = [
        { value: 'mine', label: t('Mine', 'Мои') },
        { value: 'assigned_by_me', label: t('Assigned by me', 'Я назначил') },
        { value: 'all', label: t('All', 'Все') },
        { value: 'done', label: t('Completed', 'Выполненные') },
    ]

    function fmtDue(due: string | null): { text: string; over: boolean; today: boolean } {
        if (!due) return { text: '—', over: false, today: false }
        const d = new Date(due)
        const now = new Date()
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const startTomorrow = new Date(startToday); startTomorrow.setDate(startTomorrow.getDate() + 1)
        const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        const hasTime = time !== '00:00'
        if (d < now) return { text: t('overdue', 'просрочено'), over: true, today: false }
        if (d < startTomorrow) return { text: hasTime ? `${t('today', 'сегодня')} ${time}` : t('today', 'сегодня'), over: false, today: true }
        const date = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
        return { text: hasTime ? `${date} ${time}` : date, over: false, today: false }
    }

    return (
        <div style={{ maxWidth: '1060px', margin: '0 auto', padding: '26px 22px 60px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '18px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 600, margin: 0 }}>{t('Tasks', 'Задачи')}</h1>
                <CreateTaskButton variant="button" onCreated={load} />
            </div>

            {/* вкладки */}
            <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--admin-border-card)', marginBottom: '16px', flexWrap: 'wrap' }}>
                {tabs.map((tab) => {
                    const active = scope === tab.value
                    return (
                        <button key={tab.value} type="button" onClick={() => setScope(tab.value)}
                            style={{ padding: '9px 14px', fontSize: '13px', background: 'transparent', border: 'none', color: active ? 'var(--admin-text)' : 'var(--admin-text-muted)', borderBottom: `2px solid ${active ? 'var(--admin-accent)' : 'transparent'}`, marginBottom: '-1px', cursor: 'pointer', fontWeight: active ? 600 : 400, fontFamily: 'inherit' }}>
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* поиск + фильтры */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '18px' }}>
                <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
                    placeholder={t('Search tasks…', 'Поиск задач…')} style={{ ...inputSt, flex: 1, minWidth: '180px' }} />
                <select value={entityType} onChange={(e) => setEntityType(e.target.value as TaskEntityType | '')} style={inputSt}>
                    <option value="">{t('Any type', 'Любой тип')}</option>
                    {(Object.keys(TYPE_LABEL) as TaskEntityType[]).map((k) => <option key={k} value={k}>{t(TYPE_LABEL[k][0], TYPE_LABEL[k][1])}</option>)}
                </select>
                <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority | '')} style={inputSt}>
                    <option value="">{t('Any priority', 'Любой приоритет')}</option>
                    <option value="high">{t('High', 'Высокий')}</option>
                    <option value="normal">{t('Normal', 'Обычный')}</option>
                    <option value="low">{t('Low', 'Низкий')}</option>
                </select>
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={inputSt}>
                    <option value="">{t('Any assignee', 'Любой исполнитель')}</option>
                    {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={creator} onChange={(e) => setCreator(e.target.value)} style={inputSt}>
                    <option value="">{t('Any author', 'Любой автор')}</option>
                    {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={inputSt}>
                    <option value="">{t('Any client', 'Любой клиент')}</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} style={inputSt}>
                    <option value="">{t('Any partner', 'Любой партнёр')}</option>
                    {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {hasFilters && (
                    <button type="button" onClick={resetFilters} style={{ ...inputSt, cursor: 'pointer', color: 'var(--admin-accent)' }}>
                        {t('Reset', 'Сбросить')}
                    </button>
                )}
            </div>

            {/* список */}
            {tasks.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '10px', fontSize: '14px' }}>
                    {loading ? t('Loading…', 'Загрузка…') : t('No tasks here.', 'Задач нет.')}
                </div>
            ) : (
                groups.map((g) => (
                    <div key={g.key} style={{ marginBottom: '22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', margin: '0 2px 9px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--admin-text-muted)' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: g.color }} />
                            {g.label} <span style={{ color: 'var(--admin-text-faint)' }}>· {g.items.length}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {g.items.map((task) => {
                                const isClosed = task.status === 'done' || task.status === 'cancelled'
                                const due = fmtDue(task.due_at)
                                return (
                                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'var(--admin-card)', border: '1px solid var(--admin-border-card)', borderRadius: '10px', padding: '12px 14px', opacity: isClosed ? 0.65 : 1 }}>
                                        <button type="button" title={t('Mark done', 'Отметить выполненной')}
                                            onClick={() => setStatus(task.id, task.status === 'done' ? 'open' : 'done')}
                                            style={{ width: '20px', height: '20px', borderRadius: '50%', flex: 'none', cursor: 'pointer', border: `1.6px solid ${task.status === 'done' ? 'var(--admin-success)' : 'var(--admin-text-faint)'}`, background: task.status === 'done' ? 'var(--admin-success)' : 'transparent', color: '#12201a', fontSize: '12px', lineHeight: 1, fontFamily: 'inherit' }}>
                                            {task.status === 'done' ? '✓' : ''}
                                        </button>

                                        <span style={{ width: '6px', height: '34px', borderRadius: '3px', flex: 'none', background: PRIO_COLOR[task.priority] }} />

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '14px', color: 'var(--admin-text)', textDecoration: isClosed ? 'line-through' : 'none' }}>{task.title}</div>
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '5px', fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                                                {task.context_url ? (
                                                    <Link href={task.context_url} style={{ color: 'var(--admin-blue, #5b8def)', textDecoration: 'none' }}>
                                                        {task.context_label || t(TYPE_LABEL[task.entity_type][0], TYPE_LABEL[task.entity_type][1])}
                                                    </Link>
                                                ) : task.entity_type !== 'general' ? (
                                                    <span>{task.context_label || t(TYPE_LABEL[task.entity_type][0], TYPE_LABEL[task.entity_type][1])}</span>
                                                ) : null}
                                                {task.client_name && <span>· {task.client_name}</span>}
                                                {task.partner_name && <span>· {task.partner_name}</span>}
                                                {task.status === 'done' && task.completed_by_name && (
                                                    <span>· {t('done by', 'закрыл(а)')} {task.completed_by_name}</span>
                                                )}
                                            </div>
                                        </div>

                                        {!isClosed && (
                                            <span style={{ fontSize: '12px', whiteSpace: 'nowrap', color: due.over ? 'var(--admin-danger)' : due.today ? 'var(--admin-warn, #e0a944)' : 'var(--admin-text-muted)' }}>
                                                {due.text}
                                            </span>
                                        )}

                                        <select value={task.status} onChange={(e) => setStatus(task.id, e.target.value as TaskStatus)}
                                            style={{ ...inputSt, fontSize: '12px', padding: '5px 8px' }}>
                                            <option value="open">{t('Open', 'Открыта')}</option>
                                            <option value="in_progress">{t('In progress', 'В работе')}</option>
                                            <option value="done">{t('Done', 'Выполнена')}</option>
                                            <option value="cancelled">{t('Cancelled', 'Отменена')}</option>
                                        </select>

                                        <div title={task.assignee_name || t('Unassigned', 'Не назначено')}
                                            style={{ width: '28px', height: '28px', borderRadius: '50%', flex: 'none', background: task.assignee_name ? 'var(--admin-input)' : 'transparent', border: task.assignee_name ? 'none' : '1px dashed var(--admin-text-faint)', color: 'var(--admin-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                                            {task.assignee_name ? initials(task.assignee_name) : '?'}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}