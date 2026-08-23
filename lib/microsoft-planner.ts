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

// Удалить задачу в Planner (нужен If-Match с текущим etag). Best-effort.
async function deletePlannerTask(companyId: string, msTaskId: string): Promise<void> {
    try {
        const getRes = await graphFetch(companyId, `/planner/tasks/${msTaskId}`)
        if (!getRes.ok) return
        const cur = (await getRes.json()) as Record<string, unknown>
        const etag = cur['@odata.etag'] as string | undefined
        if (!etag) return
        await graphFetch(companyId, `/planner/tasks/${msTaskId}`, {
            method: 'DELETE',
            headers: { 'If-Match': etag },
        })
    } catch { /* best-effort */ }
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

        // отменённую задачу зеркалим удалением — у Planner нет статуса «Отменена».
        // ms_task_id чистим, чтобы входящая синхра не приняла это за «удалили в Planner».
        if ((task.status as string) === 'cancelled') {
            if (task.ms_task_id) {
                await deletePlannerTask(task.company_id as string, task.ms_task_id as string)
                await admin.from('tasks').update({ ms_task_id: null, ms_synced_at: new Date().toISOString() }).eq('id', taskId)
            }
            return
        }

        // исполнитель → пользователь Azure (по email профиля)
        let assignments: Record<string, unknown> | undefined
        if (task.assignee_id) {
            const { data: prof } = await admin.from('profiles').select('email, ms_email').eq('id', task.assignee_id).single()
            // рабочий email для Microsoft приоритетнее логина; если пусто — обычный email
            const lookupEmail = ((prof?.ms_email as string | null) || (prof?.email as string | null)) ?? null
            const azureId = await resolveAzureUserId(task.company_id, lookupEmail)
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

// ---------- ВХОДЯЩАЯ синхронизация: Planner → наша система ----------

// % выполнения Planner → наш статус
function percentToStatus(percent: number | undefined): 'open' | 'in_progress' | 'done' {
    const p = typeof percent === 'number' ? percent : 0
    if (p >= 100) return 'done'
    if (p > 0) return 'in_progress'
    return 'open'
}

type PlannerTask = {
    id: string
    title?: string
    percentComplete?: number
    dueDateTime?: string | null
}

// Сравниваем «то, что в Planner» с «тем, что у нас», и приводим наше к Planner.
// Правило конфликта: любое НАШЕ изменение мгновенно уходит в Planner (pushTaskToPlanner),
// поэтому если на опросе Planner отличается — значит правку сделали в Planner, берём её.
export async function pullPlannerForCompany(companyId: string): Promise<{ updated: number; created: number; error?: string }> {
    try {
        const admin = createSupabaseAdmin()
        const { data: integ } = await admin
            .from('microsoft_integration')
            .select('plan_id, refresh_token')
            .eq('company_id', companyId)
            .single()
        if (!integ?.refresh_token || !integ.plan_id) return { updated: 0, created: 0, error: 'not_connected_or_no_plan' }

        // все задачи выбранного плана
        const res = await graphFetch(companyId, `/planner/plans/${integ.plan_id}/tasks`)
        if (!res.ok) return { updated: 0, created: 0, error: `graph_${res.status}` }
        const json = (await res.json()) as { value?: PlannerTask[] }
        const plannerTasks = json.value ?? []

        // наши задачи этой компании, уже связанные с Planner
        const { data: ours } = await admin
            .from('tasks')
            .select('id, title, status, due_at, ms_task_id')
            .eq('company_id', companyId)
            .not('ms_task_id', 'is', null)
        const byMsId = new Map<string, { id: string; title: string; status: string; due_at: string | null }>()
        for (const t of ours ?? []) {
            if (t.ms_task_id) byMsId.set(t.ms_task_id as string, { id: t.id as string, title: (t.title as string) ?? '', status: t.status as string, due_at: (t.due_at as string | null) ?? null })
        }

        let updated = 0
        let created = 0
        const now = new Date().toISOString()

        for (const pt of plannerTasks) {
            if (!pt.id) continue
            const nextStatus = percentToStatus(pt.percentComplete)
            const nextTitle = (pt.title ?? '').trim() || '—'
            const nextDue = pt.dueDateTime ? new Date(pt.dueDateTime).toISOString() : null

            const mine = byMsId.get(pt.id)
            if (mine) {
                // сравниваем; due приводим к ISO с обеих сторон, чтобы не ловить ложные различия
                const myDue = mine.due_at ? new Date(mine.due_at).toISOString() : null
                const diff = mine.title !== nextTitle || mine.status !== nextStatus || myDue !== nextDue
                if (diff) {
                    const patch: Record<string, unknown> = {
                        title: nextTitle,
                        status: nextStatus,
                        due_at: nextDue,
                        ms_synced_at: now,
                        updated_at: now,
                    }
                    // статус закрыт → проставим completed_at, открыт → снимем
                    if (nextStatus === 'done') patch.completed_at = now
                    else patch.completed_at = null
                    await admin.from('tasks').update(patch).eq('id', mine.id)
                    updated++
                }
            } else {
                // задача создана прямо в Planner — заводим у нас
                const insert: Record<string, unknown> = {
                    company_id: companyId,
                    title: nextTitle,
                    status: nextStatus,
                    priority: 'normal',
                    entity_type: 'general',
                    due_at: nextDue,
                    ms_task_id: pt.id,
                    ms_synced_at: now,
                    external_source: 'planner',
                }
                if (nextStatus === 'done') insert.completed_at = now
                await admin.from('tasks').insert(insert)
                created++
            }
        }

        // удалили в Planner → удаляем и у нас (Planner для связанных задач — зеркало).
        // считаем удаления как изменения, чтобы список обновился и синхра отметилась.
        const plannerIds = new Set(plannerTasks.map((p) => p.id).filter(Boolean))
        for (const [msId, mine] of byMsId) {
            if (!plannerIds.has(msId)) {
                await admin.from('tasks').delete().eq('id', mine.id)
                updated++
            }
        }

        return { updated, created }
    } catch (e) {
        return { updated: 0, created: 0, error: e instanceof Error ? e.message : 'unknown' }
    }
}

// Пройтись по всем компаниям с подключённым планом (для крона).
export async function pullPlannerAllCompanies(): Promise<{ companies: number; updated: number; created: number }> {
    const admin = createSupabaseAdmin()
    const { data: rows } = await admin
        .from('microsoft_integration')
        .select('company_id')
        .not('plan_id', 'is', null)
        .not('refresh_token', 'is', null)

    let updated = 0
    let created = 0
    let companies = 0
    for (const r of rows ?? []) {
        const cid = r.company_id as string | undefined
        if (!cid) continue
        companies++
        const res = await pullPlannerForCompany(cid)
        updated += res.updated
        created += res.created
    }
    return { companies, updated, created }
}