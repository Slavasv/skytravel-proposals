import 'server-only'
import { createSupabaseAdmin } from './supabase-admin'
import { graphFetch } from './microsoft'

// наш статус → % выполнения Planner (0 / 50 / 100)
function statusToPercent(status: string): number {
    if (status === 'done') return 100
    if (status === 'cancelled') return 100 // у Planner нет «Отменена» — считаем закрытой
    if (status === 'in_progress') return 50
    return 0
}

// наш приоритет → приоритет Planner (1 urgent … 9 low; берём important/medium/low)
function priorityToPlanner(p: string): number {
    if (p === 'high') return 3
    if (p === 'low') return 9
    return 5
}

// найти пользователя Azure по email (mail или UPN); null — если не нашли
async function resolveAzureUserId(companyId: string, email: string | null): Promise<string | null> {
    if (!email) return null
    const safe = email.replace(/'/g, "''")
    try {
        const res = await graphFetch(companyId, `/users?$filter=mail eq '${safe}' or userPrincipalName eq '${safe}'&$select=id&$top=1`)
        if (!res.ok) return null
        const j = (await res.json()) as { value?: { id: string }[] }
        return j.value?.[0]?.id ?? null
    } catch {
        return null
    }
}

// Отправить нашу задачу в Planner: создать (если ещё нет) или обновить.
// Полностью терпима к ошибкам — синхронизация не должна ронять создание задачи.
export async function pushTaskToPlanner(taskId: string): Promise<void> {
    try {
        const admin = createSupabaseAdmin()
        const { data: task } = await admin.from('tasks').select('*').eq('id', taskId).single()
        if (!task?.company_id) return

        const { data: integ } = await admin
            .from('microsoft_integration')
            .select('plan_id, refresh_token')
            .eq('company_id', task.company_id)
            .single()
        // синк выключен, если нет подключения или не выбран план
        if (!integ?.refresh_token || !integ.plan_id) return

        // исполнитель → пользователь Azure (по email профиля)
        let assignments: Record<string, unknown> | undefined
        if (task.assignee_id) {
            const { data: prof } = await admin.from('profiles').select('email').eq('id', task.assignee_id).single()
            const azureId = await resolveAzureUserId(task.company_id, (prof?.email as string | null) ?? null)
            if (azureId) {
                assignments = {
                    [azureId]: { '@odata.type': '#microsoft.graph.plannerAssignment', orderHint: ' !' },
                }
            }
        }

        const fields: Record<string, unknown> = {
            title: task.title,
            percentComplete: statusToPercent(task.status as string),
            priority: priorityToPlanner(task.priority as string),
        }
        if (task.due_at) fields.dueDateTime = task.due_at
        if (assignments) fields.assignments = assignments

        if (!task.ms_task_id) {
            // создать
            const res = await graphFetch(task.company_id, '/planner/tasks', {
                method: 'POST',
                body: JSON.stringify({ planId: integ.plan_id, ...fields }),
            })
            if (!res.ok) return
            const created = (await res.json()) as { id?: string }
            if (created.id) {
                await admin.from('tasks').update({ ms_task_id: created.id, ms_synced_at: new Date().toISOString() }).eq('id', taskId)
            }
        } else {
            // обновить — Planner требует If-Match с текущим etag
            const getRes = await graphFetch(task.company_id, `/planner/tasks/${task.ms_task_id}`)
            if (!getRes.ok) return
            const cur = (await getRes.json()) as Record<string, unknown>
            const etag = cur['@odata.etag'] as string | undefined
            if (!etag) return
            const patch = await graphFetch(task.company_id, `/planner/tasks/${task.ms_task_id}`, {
                method: 'PATCH',
                headers: { 'If-Match': etag },
                body: JSON.stringify(fields),
            })
            if (patch.ok) {
                await admin.from('tasks').update({ ms_synced_at: new Date().toISOString() }).eq('id', taskId)
            }
        }
    } catch {
        /* синк — best-effort, ошибки глотаем */
    }
}