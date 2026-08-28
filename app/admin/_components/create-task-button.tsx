'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n-client'
import {
    createTask, updateTask, getTaskDirectories,
    type PersonLite, type ClientLite, type PartnerLite,
    type TaskEntityType, type TaskPriority, type TaskStatus,
} from '@/app/admin/tasks/actions'

export type TaskContext = {
    entityType?: TaskEntityType
    entityId?: string | null
    label?: string | null
    url?: string | null
    clientId?: string | null
    partnerId?: string | null
}

// задача для режима просмотра/редактирования
export type EditTask = {
    id: string
    title: string
    description: string | null
    entity_type: TaskEntityType
    assignee_id: string | null
    priority: TaskPriority
    due_at: string | null
    client_id: string | null
    partner_id: string | null
    status: TaskStatus
    creator_name?: string | null
}

const inputSt: React.CSSProperties = {
    width: '100%', padding: '9px 11px', fontSize: '13px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}
const labelSt: React.CSSProperties = {
    fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--admin-text-muted)', fontWeight: 500, display: 'block', marginBottom: '4px',
}

const TYPES: { value: TaskEntityType; en: string; ru: string }[] = [
    { value: 'general', en: 'General', ru: 'Общая' },
    { value: 'request', en: 'Request', ru: 'Заявка' },
    { value: 'proposal', en: 'Proposal', ru: 'Предложение' },
    { value: 'booking', en: 'Booking', ru: 'Бронь' },
    { value: 'voucher', en: 'Voucher', ru: 'Ваучер' },
    { value: 'hotel', en: 'Hotel', ru: 'Отель' },
    { value: 'transfer', en: 'Transfer', ru: 'Трансфер' },
    { value: 'activity', en: 'Activity', ru: 'Активность' },
    { value: 'city', en: 'City', ru: 'Город' },
]

const STATUSES: { value: TaskStatus; en: string; ru: string }[] = [
    { value: 'open', en: 'Open', ru: 'Открыта' },
    { value: 'in_progress', en: 'In progress', ru: 'В работе' },
    { value: 'done', en: 'Done', ru: 'Выполнена' },
    { value: 'cancelled', en: 'Cancelled', ru: 'Отменена' },
]

function toDateInput(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function toTimeInput(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(d.getHours())}:${p(d.getMinutes())}`
}

// лёгкий поисковый селект (исполнитель/клиент/партнёр)
function PickSelect({ options, value, onChange, placeholder, disabled }: {
    options: { id: string; name: string }[]
    value: string
    onChange: (id: string) => void
    placeholder: string
    disabled?: boolean
}) {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState('')
    const boxRef = useRef<HTMLDivElement>(null)
    const selected = options.find((o) => o.id === value) || null
    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase()
        return s ? options.filter((o) => o.name.toLowerCase().includes(s)) : options
    }, [q, options])

    useEffect(() => {
        function onDoc(e: MouseEvent) {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onDoc)
        return () => document.removeEventListener('mousedown', onDoc)
    }, [])

    return (
        <div ref={boxRef} style={{ position: 'relative' }}>
            <button type="button" onClick={() => { if (!disabled) setOpen((v) => !v) }}
                style={{ ...inputSt, textAlign: 'left', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.7 : 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: selected ? 'var(--admin-text)' : 'var(--admin-text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selected ? selected.name : placeholder}
                </span>
                {!disabled && <span style={{ color: 'var(--admin-text-faint)', fontSize: '11px' }}>▾</span>}
            </button>
            {open && !disabled && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30, background: 'var(--admin-input)', border: '1px solid var(--admin-border)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', padding: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="…" style={{ ...inputSt, marginBottom: '6px' }} />
                    <button type="button" onClick={() => { onChange(''); setOpen(false); setQ('') }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', color: 'var(--admin-text-muted)', fontFamily: 'inherit', fontSize: '13px' }}>
                        —
                    </button>
                    {filtered.map((o) => (
                        <button key={o.id} type="button" onClick={() => { onChange(o.id); setOpen(false); setQ('') }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: o.id === value ? 'var(--admin-card)' : 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', color: 'var(--admin-text)', fontFamily: 'inherit', fontSize: '13px' }}>
                            {o.name}
                        </button>
                    ))}
                    {filtered.length === 0 && <div style={{ padding: '8px 10px', color: 'var(--admin-text-faint)', fontSize: '12px' }}>—</div>}
                </div>
            )}
        </div>
    )
}

export default function CreateTaskButton({ context, variant = 'button', label, onCreated, editTask, canEdit = false, onClose, onSaved }: {
    context?: TaskContext
    variant?: 'button' | 'plus' | 'inline' | 'fab'
    label?: string
    onCreated?: () => void
    // режим просмотра/редактирования существующей задачи
    editTask?: EditTask
    canEdit?: boolean
    onClose?: () => void
    onSaved?: () => void
}) {
    const t = useT()
    const router = useRouter()
    const isEdit = !!editTask
    const readOnly = isEdit && !canEdit

    const [open, setOpen] = useState(isEdit)
    const [dirs, setDirs] = useState<{ people: PersonLite[]; clients: ClientLite[]; partners: PartnerLite[] } | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const initDue = editTask?.due_at ? new Date(editTask.due_at) : null
    const [title, setTitle] = useState(editTask?.title ?? '')
    const [description, setDescription] = useState(editTask?.description ?? '')
    const [entityType, setEntityType] = useState<TaskEntityType>(editTask?.entity_type ?? context?.entityType ?? 'general')
    const [assignee, setAssignee] = useState(editTask?.assignee_id ?? '')
    const [priority, setPriority] = useState<TaskPriority>(editTask?.priority ?? 'medium')
    const [dueDate, setDueDate] = useState(initDue ? toDateInput(initDue) : '')
    const [dueTime, setDueTime] = useState(initDue ? toTimeInput(initDue) : '')
    const [clientId, setClientId] = useState(editTask?.client_id ?? context?.clientId ?? '')
    const [partnerId, setPartnerId] = useState(editTask?.partner_id ?? context?.partnerId ?? '')
    const [status, setStatus] = useState<TaskStatus>(editTask?.status ?? 'open')

    useEffect(() => {
        if (open && !dirs) {
            getTaskDirectories().then(setDirs).catch(() => setDirs({ people: [], clients: [], partners: [] }))
        }
    }, [open, dirs])

    function close() {
        if (isEdit) { onClose?.(); return }
        setOpen(false)
        setTitle(''); setDescription(''); setAssignee(''); setPriority('medium')
        setDueDate(''); setDueTime(''); setError('')
        setEntityType(context?.entityType ?? 'general')
        setClientId(context?.clientId ?? ''); setPartnerId(context?.partnerId ?? '')
    }

    async function submit() {
        const ttl = title.trim()
        if (!ttl) { setError(t('Title required', 'Нужно название')); return }
        const due_at = dueDate ? new Date(`${dueDate}T${dueTime || '09:00'}`).toISOString() : null

        if (isEdit) {
            // причину спрашиваем только при НОВОЙ отмене
            let cancel_reason: string | undefined
            if (status === 'cancelled' && editTask!.status !== 'cancelled') {
                const r = prompt(t('Reason for cancellation:', 'Причина отмены:'), '')
                if (r === null) return
                cancel_reason = r.trim()
            }
            setSaving(true); setError('')
            const patch: Record<string, unknown> = {
                title: ttl, description: description || null, priority,
                assignee_id: assignee || null, due_at,
                client_id: clientId || null, partner_id: partnerId || null,
                entity_type: entityType, status,
            }
            if (cancel_reason !== undefined) patch.cancel_reason = cancel_reason
            const res = await updateTask(editTask!.id, patch)
            setSaving(false)
            if (!res.ok) { setError(res.error || t('Error', 'Ошибка')); return }
            onSaved?.(); close()
            return
        }

        setSaving(true); setError('')
        const res = await createTask({
            title: ttl, description: description || null, priority,
            assignee_id: assignee || null, due_at,
            client_id: clientId || null, partner_id: partnerId || null,
            entity_type: entityType, entity_id: context?.entityId ?? null,
            context_label: context?.label ?? null, context_url: context?.url ?? null,
        })
        setSaving(false)
        if (!res.ok) { setError(res.error || t('Error', 'Ошибка')); return }
        close(); router.refresh(); onCreated?.()
    }

    const priorities: { value: TaskPriority; en: string; ru: string; color: string }[] = [
        { value: 'urgent', en: 'Urgent', ru: 'Срочно', color: 'var(--admin-danger)' },
        { value: 'important', en: 'Important', ru: 'Важно', color: 'var(--admin-warn, #e0a944)' },
        { value: 'medium', en: 'Medium', ru: 'Средне', color: 'var(--admin-blue, #5b8def)' },
        { value: 'low', en: 'Low', ru: 'Низко', color: 'var(--admin-text-faint)' },
    ]

    const trigger = variant === 'fab' ? (
        <button type="button" onClick={() => setOpen(true)} aria-label={t('Create task', 'Создать задачу')}
            title={t('Create task', 'Создать задачу')}
            style={{ position: 'fixed', right: '20px', bottom: '20px', zIndex: 80, display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', borderRadius: '999px', border: 'none', background: 'var(--admin-accent)', color: '#20242c', cursor: 'pointer', fontSize: '13px', fontWeight: 600, lineHeight: 1, fontFamily: 'inherit', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
            <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> {t('Create task', 'Создать задачу')}
        </button>
    ) : variant === 'plus' ? (
        <button type="button" onClick={() => setOpen(true)} aria-label={t('New task', 'Новая задача')}
            style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-accent)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, fontFamily: 'inherit' }}>
            +
        </button>
    ) : variant === 'inline' ? (
        <button type="button" onClick={() => setOpen(true)}
            style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-accent)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '5px 10px', fontFamily: 'inherit' }}>
            {label || t('+ Task', '+ Задача')}
        </button>
    ) : (
        <button type="button" onClick={() => setOpen(true)}
            style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {label || t('+ New task', '+ Новая задача')}
        </button>
    )

    const heading = isEdit
        ? (readOnly ? t('Task', 'Задача') : t('Edit task', 'Редактирование задачи'))
        : t('New task', 'Новая задача')

    return (
        <>
            {!isEdit && trigger}
            {open && (
                <>
                    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 90 }} />
                    <div style={{ position: 'fixed', zIndex: 91, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(560px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', background: 'var(--admin-card)', border: '1px solid var(--admin-border-card)', borderRadius: '12px', padding: '20px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
                        <h2 style={{ fontSize: '17px', fontWeight: 600, margin: '0 0 16px' }}>{heading}</h2>

                        {isEdit && editTask?.creator_name && (
                            <div style={{ marginBottom: '14px', fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                                {t('Created by', 'Автор')}: {editTask.creator_name}
                            </div>
                        )}

                        {context?.label && !isEdit && (
                            <div style={{ marginBottom: '14px', fontSize: '12px', color: 'var(--admin-text-muted)' }}>
                                <span style={{ background: 'var(--admin-input)', border: '1px solid var(--admin-border-card)', borderRadius: '6px', padding: '4px 9px' }}>
                                    🔗 {context.label}
                                </span>
                            </div>
                        )}

                        <div style={{ marginBottom: '12px' }}>
                            <label style={labelSt}>{t('Task', 'Задача')}</label>
                            <input autoFocus={!readOnly} type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={readOnly}
                                placeholder={t('What needs to be done?', 'Что нужно сделать?')} style={inputSt} />
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                            <label style={labelSt}>{t('Details', 'Описание')}</label>
                            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={readOnly}
                                placeholder={t('Optional', 'Необязательно')} style={{ ...inputSt, resize: 'vertical' }} />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            <div style={{ flex: 1, minWidth: '150px' }}>
                                <label style={labelSt}>{t('Type', 'Тип')}</label>
                                <select value={entityType} onChange={(e) => setEntityType(e.target.value as TaskEntityType)} disabled={readOnly} style={inputSt}>
                                    {TYPES.map((ty) => <option key={ty.value} value={ty.value}>{t(ty.en, ty.ru)}</option>)}
                                </select>
                            </div>
                            <div style={{ flex: 1, minWidth: '150px' }}>
                                <label style={labelSt}>{t('Assignee', 'Исполнитель')}</label>
                                <PickSelect options={dirs?.people ?? []} value={assignee} onChange={setAssignee} disabled={readOnly}
                                    placeholder={t('Anyone / choose…', 'Любой / выбрать…')} />
                            </div>
                        </div>

                        {isEdit && (
                            <div style={{ marginBottom: '12px' }}>
                                <label style={labelSt}>{t('Status', 'Статус')}</label>
                                <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} disabled={readOnly} style={inputSt}>
                                    {STATUSES.map((st) => <option key={st.value} value={st.value}>{t(st.en, st.ru)}</option>)}
                                </select>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'flex-end' }}>
                            <div style={{ width: '150px' }}>
                                <label style={labelSt}>{t('Due date', 'Срок')}</label>
                                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={readOnly} style={inputSt} />
                            </div>
                            <div style={{ width: '110px' }}>
                                <label style={labelSt}>{t('Time', 'Время')}</label>
                                <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} disabled={readOnly} style={inputSt} />
                            </div>
                            <div style={{ flex: 1, minWidth: '160px' }}>
                                <label style={labelSt}>{t('Priority', 'Приоритет')}</label>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {priorities.map((p) => {
                                        const on = priority === p.value
                                        return (
                                            <button key={p.value} type="button" onClick={() => { if (!readOnly) setPriority(p.value) }}
                                                style={{ flex: 1, fontSize: '12px', padding: '8px 6px', borderRadius: '6px', cursor: readOnly ? 'default' : 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? p.color : 'var(--admin-border-card)'}`, background: on ? p.color : 'transparent', color: on ? '#20242c' : 'var(--admin-text)' }}>
                                                {t(p.en, p.ru)}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
                            <div style={{ flex: 1, minWidth: '150px' }}>
                                <label style={labelSt}>{t('Client', 'Клиент')}</label>
                                <PickSelect options={dirs?.clients ?? []} value={clientId} onChange={setClientId} disabled={readOnly}
                                    placeholder={t('Attach client…', 'Привязать клиента…')} />
                            </div>
                            <div style={{ flex: 1, minWidth: '150px' }}>
                                <label style={labelSt}>{t('Partner', 'Партнёр')}</label>
                                <PickSelect options={dirs?.partners ?? []} value={partnerId} onChange={setPartnerId} disabled={readOnly}
                                    placeholder={t('Attach partner…', 'Привязать партнёра…')} />
                            </div>
                        </div>

                        {error && <div style={{ color: 'var(--admin-danger)', fontSize: '13px', marginBottom: '12px' }}>{error}</div>}

                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={close}
                                style={{ padding: '10px 16px', fontSize: '13px', background: 'transparent', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                                {readOnly ? t('Close', 'Закрыть') : t('Cancel', 'Отмена')}
                            </button>
                            {!readOnly && (
                                <button type="button" onClick={submit} disabled={saving || !title.trim()}
                                    style={{ padding: '10px 18px', fontSize: '13px', fontWeight: 600, background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '8px', cursor: saving ? 'wait' : 'pointer', opacity: saving || !title.trim() ? 0.4 : 1, fontFamily: 'inherit' }}>
                                    {saving ? t('Saving…', 'Сохранение…') : isEdit ? t('Save', 'Сохранить') : t('Create task', 'Создать задачу')}
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </>
    )
}