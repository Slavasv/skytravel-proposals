'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
    DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
    type DragEndEvent,
} from '@dnd-kit/core'
import { useT } from '@/lib/i18n-client'
import CreateTaskButton from '@/app/admin/_components/create-task-button'
import {
    getTasks, updateTask, deleteTask, syncPlannerNow,
    type TaskRow, type TaskFilters, type TaskStatus, type TaskPriority,
    type PersonLite, type ClientLite, type PartnerLite, type TaskEntityType,
} from './actions'

type Scope = 'mine' | 'assigned_by_me' | 'all' | 'done'
type View = 'list' | 'board'

const inputSt: React.CSSProperties = {
    padding: '8px 10px', fontSize: '13px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '6px', fontFamily: 'inherit', outline: 'none',
}

const PRIO_COLOR: Record<TaskPriority, string> = {
    urgent: 'var(--admin-danger)',
    important: 'var(--admin-warn, #e0a944)',
    medium: 'var(--admin-blue, #5b8def)',
    low: 'var(--admin-text-faint)',
}

const TYPE_LABEL: Record<TaskEntityType, [string, string]> = {
    general: ['General', 'Общая'],
    request: ['Request', 'Заявка'],
    proposal: ['Proposal', 'Предложение'],
    booking: ['Booking', 'Бронь'],
    voucher: ['Voucher', 'Ваучер'],
    hotel: ['Hotel', 'Отель'],
    transfer: ['Transfer', 'Трансфер'],
    activity: ['Activity', 'Активность'],
    city: ['City', 'Город'],
}

const STATUS_LABEL: Record<TaskStatus, [string, string]> = {
    open: ['Open', 'Открыта'],
    in_progress: ['In progress', 'В работе'],
    done: ['Done', 'Выполнена'],
    cancelled: ['Cancelled', 'Отменена'],
}

function initials(name: string | null): string {
    if (!name) return '—'
    const parts = name.trim().split(/\s+/).slice(0, 2)
    return parts.map((p) => p[0]?.toUpperCase() || '').join('') || '—'
}

type TFn = (en: string, ru: string) => string

function dueBadge(due: string | null, t: TFn): { text: string; tone: string } | null {
    if (!due) return null
    const d = new Date(due)
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startTomorrow = new Date(startToday); startTomorrow.setDate(startTomorrow.getDate() + 1)
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    const hasTime = time !== '00:00'
    if (d < now) return { text: t('overdue', 'просрочено'), tone: 'var(--admin-danger)' }
    if (d < startTomorrow) return { text: hasTime ? `${t('today', 'сегодня')} ${time}` : t('today', 'сегодня'), tone: 'var(--admin-warn, #e0a944)' }
    const date = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    return { text: hasTime ? `${date} ${time}` : date, tone: 'var(--admin-text-muted)' }
}

// колонки доски (по статусу); отменённые скрыты по умолчанию
const BOARD_COLUMNS: { status: TaskStatus; en: string; ru: string; color: string }[] = [
    { status: 'open', en: 'Open', ru: 'Открыта', color: '#9C988E' },
    { status: 'in_progress', en: 'In progress', ru: 'В работе', color: 'var(--admin-blue, #5b8def)' },
    { status: 'done', en: 'Done', ru: 'Выполнена', color: 'var(--admin-success)' },
]

function BoardCard({ task, currentUserId, t, onEdit }: {
    task: TaskRow; currentUserId: string; t: TFn; onEdit: (task: TaskRow) => void
}) {
    const editable = task.assignee_id === currentUserId || task.creator_id === currentUserId
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: !editable })
    const due = dueBadge(task.due_at, t)
    const isClosed = task.status === 'done' || task.status === 'cancelled'
    return (
        <div ref={setNodeRef}
            style={{
                display: 'flex', gap: '10px', background: 'var(--admin-card)', border: '1px solid var(--admin-border-card)',
                borderRadius: '10px', padding: '10px 11px', marginBottom: '8px',
                opacity: isDragging ? 0.4 : (isClosed ? 0.7 : 1),
                boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.18)' : 'none',
                cursor: editable ? 'grab' : 'default',
                ...(transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : {}),
            }}
            {...(editable ? { ...listeners, ...attributes } : {})}>
            <span style={{ width: '5px', borderRadius: '3px', flex: 'none', background: PRIO_COLOR[task.priority] }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <button type="button" onClick={() => onEdit(task)}
                    style={{ display: 'block', textAlign: 'left', background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', fontSize: '13.5px', fontWeight: 500, color: 'var(--admin-text)', textDecoration: isClosed ? 'line-through' : 'none', fontFamily: 'inherit' }}>
                    {task.title}
                </button>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px', fontSize: '11.5px', color: 'var(--admin-text-muted)' }}>
                    {task.context_url ? (
                        <Link href={task.context_url} onPointerDown={(e) => e.stopPropagation()} style={{ color: 'var(--admin-blue, #5b8def)', textDecoration: 'none' }}>
                            {task.context_label || t(TYPE_LABEL[task.entity_type][0], TYPE_LABEL[task.entity_type][1])}
                        </Link>
                    ) : task.context_label ? <span>{task.context_label}</span> : null}
                    {due && <span style={{ color: due.tone, fontWeight: 600 }}>{due.text}</span>}
                    <span title={task.assignee_name || t('Unassigned', 'Не назначено')}
                        style={{ marginLeft: 'auto', width: '22px', height: '22px', borderRadius: '50%', flex: 'none', background: task.assignee_name ? 'var(--admin-input)' : 'transparent', border: task.assignee_name ? 'none' : '1px dashed var(--admin-text-faint)', color: 'var(--admin-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                        {task.assignee_name ? initials(task.assignee_name) : '?'}
                    </span>
                </div>
            </div>
        </div>
    )
}

function BoardColumn({ status, label, color, count, children }: {
    status: TaskStatus; label: string; color: string; count: number; children: React.ReactNode
}) {
    const { setNodeRef, isOver } = useDroppable({ id: status })
    return (
        <div ref={setNodeRef}
            style={{ background: isOver ? 'var(--admin-hover)' : 'var(--admin-head)', border: `1px solid ${isOver ? 'var(--admin-border-hover)' : 'var(--admin-border-card)'}`, borderRadius: '12px', padding: '10px', transition: 'background 0.12s, border-color 0.12s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', padding: '4px 6px 12px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                {label} <span style={{ color: 'var(--admin-text-faint)', fontWeight: 600 }}>· {count}</span>
            </div>
            {children}
        </div>
    )
}

export default function TasksClient({ initial, people, clients, partners, currentUserId }: {
    initial: TaskRow[]
    people: PersonLite[]
    clients: ClientLite[]
    partners: PartnerLite[]
    currentUserId: string
}) {
    const t = useT()
    const [scope, setScope] = useState<Scope>('all')
    const [view, setView] = useState<View>('list')
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

    // синхронизация из Planner: кнопка + один автозапуск при открытии страницы
    const [syncing, setSyncing] = useState(false)
    const [syncNote, setSyncNote] = useState('')
    const doSync = useCallback(async (manual: boolean) => {
        setSyncing(true)
        if (manual) setSyncNote('')
        const res = await syncPlannerNow()
        setSyncing(false)
        if (res.ok && (res.updated > 0 || res.created > 0)) {
            await load()
            setSyncNote(t(`Synced: +${res.created} new, ${res.updated} updated`, `Синхронизировано: +${res.created} новых, ${res.updated} обновлено`))
        } else if (manual) {
            setSyncNote(res.ok ? t('Up to date', 'Всё актуально') : `${t('Error', 'Ошибка')}: ${res.error || ''}`)
        }
    }, [load, t])

    useEffect(() => { doSync(false) }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const [menuFor, setMenuFor] = useState<string | null>(null)
    const [editing, setEditing] = useState<TaskRow | null>(null)

    async function setStatus(id: string, status: TaskStatus) {
        // при отмене — спрашиваем причину (сохраняем и показываем в Planner-заметке)
        let cancel_reason: string | undefined
        if (status === 'cancelled') {
            const r = prompt(t('Reason for cancellation:', 'Причина отмены:'), '')
            if (r === null) return // передумал — статус не меняем
            cancel_reason = r.trim()
        }
        setTasks((p) => p.map((x) => (x.id === id ? { ...x, status } : x)))
        await updateTask(id, cancel_reason !== undefined ? { status, cancel_reason } : { status })
        load()
    }

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
    function onDragEnd(e: DragEndEvent) {
        const id = String(e.active.id)
        const target = e.over?.id ? (String(e.over.id) as TaskStatus) : null
        if (!target) return
        const task = tasks.find((x) => x.id === id)
        if (!task || task.status === target) return
        setStatus(id, target)
    }

    async function handleDelete(id: string) {
        setMenuFor(null)
        if (!confirm(t('Delete this task? This cannot be undone.', 'Удалить задачу? Действие необратимо.'))) return
        setTasks((p) => p.filter((x) => x.id !== id))
        await deleteTask(id)
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* переключатель Список / Доска */}
                    <div style={{ display: 'inline-flex', gap: '2px', background: 'var(--admin-head)', border: '1px solid var(--admin-border-card)', borderRadius: '9px', padding: '3px' }}>
                        {([['list', t('List', 'Список')], ['board', t('Board', 'Доска')]] as [View, string][]).map(([v, label]) => (
                            <button key={v} type="button" onClick={() => setView(v)}
                                style={{ padding: '6px 14px', fontSize: '12.5px', fontWeight: 600, border: 'none', borderRadius: '7px', cursor: 'pointer', fontFamily: 'inherit', background: view === v ? 'var(--admin-text-on-dark)' : 'transparent', color: view === v ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)' }}>
                                {label}
                            </button>
                        ))}
                    </div>
                    {syncNote && <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>{syncNote}</span>}
                    <button type="button" onClick={() => doSync(true)} disabled={syncing}
                        style={{ ...inputSt, cursor: syncing ? 'wait' : 'pointer', opacity: syncing ? 0.6 : 1 }}>
                        {syncing ? t('Syncing…', 'Синхронизация…') : t('Sync from Planner', 'Синхронизировать')}
                    </button>
                    <CreateTaskButton variant="button" onCreated={load} />
                </div>
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
                    <option value="urgent">{t('Urgent', 'Срочно')}</option>
                    <option value="important">{t('Important', 'Важно')}</option>
                    <option value="medium">{t('Medium', 'Средне')}</option>
                    <option value="low">{t('Low', 'Низко')}</option>
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
            ) : view === 'board' ? (
                <DndContext sensors={sensors} onDragEnd={onDragEnd}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', alignItems: 'start' }}>
                        {BOARD_COLUMNS.map((col) => {
                            const items = tasks.filter((x) => x.status === col.status)
                            return (
                                <BoardColumn key={col.status} status={col.status} label={t(col.en, col.ru)} color={col.color} count={items.length}>
                                    {items.map((task) => (
                                        <BoardCard key={task.id} task={task} currentUserId={currentUserId} t={t} onEdit={setEditing} />
                                    ))}
                                    {items.length === 0 && (
                                        <div style={{ padding: '16px 8px', fontSize: '12px', color: 'var(--admin-text-faint)', textAlign: 'center' }}>—</div>
                                    )}
                                </BoardColumn>
                            )
                        })}
                    </div>
                    <p style={{ marginTop: '14px', fontSize: '12px', color: 'var(--admin-text-faint)' }}>
                        {t('Drag a card to another column to change its status.', 'Перетащите карточку в другую колонку, чтобы сменить статус.')}
                    </p>
                </DndContext>
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
                                const editable = task.assignee_id === currentUserId || task.creator_id === currentUserId
                                const due = fmtDue(task.due_at)
                                return (
                                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'var(--admin-card)', border: '1px solid var(--admin-border-card)', borderRadius: '10px', padding: '12px 14px', opacity: isClosed ? 0.65 : 1 }}>
                                        {editable ? (
                                            <button type="button" title={t('Mark done', 'Отметить выполненной')}
                                                onClick={() => setStatus(task.id, task.status === 'done' ? 'open' : 'done')}
                                                style={{ width: '20px', height: '20px', borderRadius: '50%', flex: 'none', cursor: 'pointer', border: `1.6px solid ${task.status === 'done' ? 'var(--admin-success)' : 'var(--admin-text-faint)'}`, background: task.status === 'done' ? 'var(--admin-success)' : 'transparent', color: '#12201a', fontSize: '12px', lineHeight: 1, fontFamily: 'inherit' }}>
                                                {task.status === 'done' ? '✓' : ''}
                                            </button>
                                        ) : (
                                            <span style={{ width: '20px', height: '20px', borderRadius: '50%', flex: 'none', border: `1.6px solid ${task.status === 'done' ? 'var(--admin-success)' : 'var(--admin-border-card)'}`, background: task.status === 'done' ? 'var(--admin-success)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#12201a', fontSize: '12px' }}>
                                                {task.status === 'done' ? '✓' : ''}
                                            </span>
                                        )}

                                        <span style={{ width: '6px', height: '34px', borderRadius: '3px', flex: 'none', background: PRIO_COLOR[task.priority] }} />

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <button type="button" onClick={() => setEditing(task)}
                                                style={{ display: 'block', textAlign: 'left', background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', fontSize: '14px', color: 'var(--admin-text)', textDecoration: isClosed ? 'line-through' : 'none', fontFamily: 'inherit' }}>
                                                {task.title}
                                            </button>
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
                                                {task.creator_name && <span>· {t('by', 'от')} {task.creator_name}</span>}
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

                                        {editable ? (
                                            <select value={task.status} onChange={(e) => setStatus(task.id, e.target.value as TaskStatus)}
                                                style={{ ...inputSt, fontSize: '12px', padding: '5px 8px' }}>
                                                <option value="open">{t('Open', 'Открыта')}</option>
                                                <option value="in_progress">{t('In progress', 'В работе')}</option>
                                                <option value="done">{t('Done', 'Выполнена')}</option>
                                                <option value="cancelled">{t('Cancelled', 'Отменена')}</option>
                                            </select>
                                        ) : (
                                            <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border-card)', borderRadius: '6px', padding: '4px 9px', whiteSpace: 'nowrap' }}>
                                                {t(STATUS_LABEL[task.status][0], STATUS_LABEL[task.status][1])}
                                            </span>
                                        )}

                                        <div title={task.assignee_name || t('Unassigned', 'Не назначено')}
                                            style={{ width: '28px', height: '28px', borderRadius: '50%', flex: 'none', background: task.assignee_name ? 'var(--admin-input)' : 'transparent', border: task.assignee_name ? 'none' : '1px dashed var(--admin-text-faint)', color: 'var(--admin-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                                            {task.assignee_name ? initials(task.assignee_name) : '?'}
                                        </div>

                                        {(task.creator_id === currentUserId || task.assignee_id === currentUserId) && (
                                            <div style={{ position: 'relative', flex: 'none' }}>
                                                <button type="button" onClick={() => setMenuFor(menuFor === task.id ? null : task.id)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', padding: '2px 6px', fontSize: '18px', lineHeight: 1, fontFamily: 'inherit' }}>⋯</button>
                                                {menuFor === task.id && (
                                                    <>
                                                        <div onClick={() => setMenuFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                                                        <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 20, background: 'var(--admin-input)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '4px', minWidth: '150px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                                                            <button type="button" onClick={() => handleDelete(task.id)}
                                                                style={{ width: '100%', padding: '8px 12px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--admin-danger)', fontSize: '13px', cursor: 'pointer', borderRadius: '6px', fontFamily: 'inherit' }}>
                                                                {t('Delete', 'Удалить')}
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))
            )}

            {editing && (
                <CreateTaskButton
                    editTask={editing}
                    canEdit={editing.assignee_id === currentUserId || editing.creator_id === currentUserId}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); load() }}
                />
            )}
        </div>
    )
}