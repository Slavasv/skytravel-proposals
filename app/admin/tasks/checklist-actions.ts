'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { pushTaskChecklist } from '@/lib/microsoft-planner'

export type ChecklistItem = {
    id: string
    task_id: string
    title: string
    done: boolean
    sort_order: number
}

// Пункты чеклиста задачи (по порядку)
export async function getChecklist(taskId: string): Promise<ChecklistItem[]> {
    const supabase = await createSupabaseServer()
    const { data, error } = await supabase
        .from('task_checklist_items')
        .select('id, task_id, title, done, sort_order')
        .eq('task_id', taskId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
    if (error || !data) return []
    return data as ChecklistItem[]
}

// Добавить пункт
export async function addChecklistItem(taskId: string, title: string): Promise<ChecklistItem | null> {
    const t = title.trim()
    if (!t) return null
    const supabase = await createSupabaseServer()

    const { data: last } = await supabase
        .from('task_checklist_items')
        .select('sort_order')
        .eq('task_id', taskId)
        .order('sort_order', { ascending: false })
        .limit(1)
    const nextOrder = last && last.length > 0 ? (last[0].sort_order as number) + 1 : 0

    const { data, error } = await supabase
        .from('task_checklist_items')
        .insert({ task_id: taskId, title: t, sort_order: nextOrder })
        .select('id, task_id, title, done, sort_order')
        .single()
    if (error || !data) return null

    await pushTaskChecklist(taskId) // зеркалим в Planner (best-effort)
    return data as ChecklistItem
}

// Переключить галочку
export async function toggleChecklistItem(id: string, done: boolean): Promise<{ ok: boolean }> {
    const supabase = await createSupabaseServer()
    const { data, error } = await supabase
        .from('task_checklist_items')
        .update({ done, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('task_id')
        .single()
    if (error) return { ok: false }
    if (data?.task_id) await pushTaskChecklist(data.task_id as string)
    return { ok: true }
}

// Переименовать пункт
export async function renameChecklistItem(id: string, title: string): Promise<{ ok: boolean }> {
    const t = title.trim()
    if (!t) return { ok: false }
    const supabase = await createSupabaseServer()
    const { data, error } = await supabase
        .from('task_checklist_items')
        .update({ title: t, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('task_id')
        .single()
    if (error) return { ok: false }
    if (data?.task_id) await pushTaskChecklist(data.task_id as string)
    return { ok: true }
}

// Удалить пункт
export async function deleteChecklistItem(id: string): Promise<{ ok: boolean }> {
    const supabase = await createSupabaseServer()
    const { data, error } = await supabase
        .from('task_checklist_items')
        .delete()
        .eq('id', id)
        .select('task_id')
        .single()
    if (error) return { ok: false }
    if (data?.task_id) await pushTaskChecklist(data.task_id as string)
    return { ok: true }
}
