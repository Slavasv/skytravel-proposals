'use client'

import { useState, useEffect, useCallback } from 'react'
import { useT } from '@/lib/i18n-client'
import {
    getChecklist, addChecklistItem, toggleChecklistItem, renameChecklistItem, deleteChecklistItem,
    type ChecklistItem,
} from './checklist-actions'

const inputSt: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: '13px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

// Подзадачи-чеклист внутри задачи (как в Planner): текст + галочка, прогресс N/M.
export default function TaskChecklist({ taskId, readOnly = false }: { taskId: string; readOnly?: boolean }) {
    const t = useT()
    const [items, setItems] = useState<ChecklistItem[]>([])
    const [loading, setLoading] = useState(true)
    const [newTitle, setNewTitle] = useState('')
    const [adding, setAdding] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        setItems(await getChecklist(taskId))
        setLoading(false)
    }, [taskId])

    useEffect(() => { load() }, [load])

    const doneCount = items.filter((i) => i.done).length

    async function handleAdd() {
        const title = newTitle.trim()
        if (!title || adding) return
        setAdding(true)
        const created = await addChecklistItem(taskId, title)
        setAdding(false)
        if (created) { setItems((p) => [...p, created]); setNewTitle('') }
    }

    async function handleToggle(item: ChecklistItem) {
        const next = !item.done
        setItems((p) => p.map((x) => (x.id === item.id ? { ...x, done: next } : x)))
        await toggleChecklistItem(item.id, next)
    }

    async function handleDelete(id: string) {
        setItems((p) => p.filter((x) => x.id !== id))
        await deleteChecklistItem(id)
    }

    function startEdit(item: ChecklistItem) {
        setEditingId(item.id); setEditTitle(item.title)
    }
    async function saveEdit(id: string) {
        const title = editTitle.trim()
        setEditingId(null)
        if (!title) return
        setItems((p) => p.map((x) => (x.id === id ? { ...x, title } : x)))
        await renameChecklistItem(id, title)
    }

    return (
        <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', fontWeight: 500 }}>
                    {t('Subtasks', 'Подзадачи')}
                </label>
                {items.length > 0 && (
                    <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>{doneCount}/{items.length}</span>
                )}
            </div>

            {/* прогресс-бар */}
            {items.length > 0 && (
                <div style={{ height: '4px', borderRadius: '3px', background: 'var(--admin-border-card)', overflow: 'hidden', marginBottom: '10px' }}>
                    <div style={{ height: '100%', width: `${Math.round((doneCount / items.length) * 100)}%`, background: 'var(--admin-success)', transition: 'width 0.15s' }} />
                </div>
            )}

            {loading ? (
                <div style={{ fontSize: '12px', color: 'var(--admin-text-faint)' }}>{t('Loading…', 'Загрузка…')}</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {items.map((item) => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '4px 2px' }}>
                            <button type="button" onClick={() => !readOnly && handleToggle(item)} disabled={readOnly}
                                style={{ width: '18px', height: '18px', borderRadius: '5px', flex: 'none', cursor: readOnly ? 'default' : 'pointer', border: `1.6px solid ${item.done ? 'var(--admin-success)' : 'var(--admin-text-faint)'}`, background: item.done ? 'var(--admin-success)' : 'transparent', color: '#12201a', fontSize: '11px', lineHeight: 1, fontFamily: 'inherit' }}>
                                {item.done ? '✓' : ''}
                            </button>

                            {editingId === item.id ? (
                                <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                                    onBlur={() => saveEdit(item.id)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') setEditingId(null) }}
                                    style={{ ...inputSt, flex: 1, padding: '5px 8px' }} />
                            ) : (
                                <span onClick={() => !readOnly && startEdit(item)}
                                    style={{ flex: 1, fontSize: '13px', color: item.done ? 'var(--admin-text-muted)' : 'var(--admin-text)', textDecoration: item.done ? 'line-through' : 'none', cursor: readOnly ? 'default' : 'text' }}>
                                    {item.title}
                                </span>
                            )}

                            {!readOnly && editingId !== item.id && (
                                <button type="button" onClick={() => handleDelete(item.id)} title={t('Delete', 'Удалить')}
                                    style={{ background: 'none', border: 'none', color: 'var(--admin-text-faint)', cursor: 'pointer', fontSize: '15px', lineHeight: 1, padding: '2px 4px', fontFamily: 'inherit' }}>×</button>
                            )}
                        </div>
                    ))}
                    {items.length === 0 && (
                        <div style={{ fontSize: '12px', color: 'var(--admin-text-faint)', padding: '2px' }}>
                            {t('No subtasks yet.', 'Подзадач пока нет.')}
                        </div>
                    )}
                </div>
            )}

            {!readOnly && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
                        placeholder={t('Add a subtask…', 'Добавить подзадачу…')} style={{ ...inputSt, flex: 1 }} />
                    <button type="button" onClick={handleAdd} disabled={adding || !newTitle.trim()}
                        style={{ padding: '8px 14px', fontSize: '13px', background: 'var(--admin-input)', color: 'var(--admin-accent)', border: '1px solid var(--admin-border)', borderRadius: '6px', cursor: adding || !newTitle.trim() ? 'default' : 'pointer', opacity: adding || !newTitle.trim() ? 0.5 : 1, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                        {t('Add', 'Добавить')}
                    </button>
                </div>
            )}
        </div>
    )
}
