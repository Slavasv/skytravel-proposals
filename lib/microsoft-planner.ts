import 'server-only'
import { createSupabaseAdmin } from './supabase-admin'
import { graphFetch, getActingToken, getAccessTokenForCompany, rawGraphFetch } from './microsoft'

// наш статус → % выполнения Planner (0 / 50 / 100)
function statusToPercent(status: string): number {
    if (status === 'done') return 100
    if (status === 'cancelled') return 100 // у Planner нет «Отменена» — считаем закрытой
    if (status === 'in_progress') return 50
    return 0
}

// наш приоритет → приоритет Planner (1 urgent … 9 low; берём important/medium/low)
function priorityToPlanner(p: string): number {
    if (p === 'urgent') return 1
    if (p === 'important') return 3
    if (p === 'low') return 9
    return 5 // medium
}

// тип задачи ↔ название сегмента (бакета) Planner
const TYPE_TO_SEGMENT: Record<string, string> = {
    general: 'Общая', request: 'Заявка', proposal: 'Предложение', booking: 'Бронь',
    voucher: 'Ваучер', hotel: 'Отель', transfer: 'Трансфер', activity: 'Активность', city: 'Город',
}
const SEGMENT_TO_TYPE: Record<string, string> = Object.fromEntries(
    Object.entries(TYPE_TO_SEGMENT).map(([k, v]) => [v, k]),
)

// приоритет Planner (0..10) → наш (4 уровня)
function plannerPriorityToOurs(p: number | undefined): 'urgent' | 'important' | 'medium' | 'low' {
    const n = typeof p === 'number' ? p : 5
    if (n <= 1) return 'urgent'
    if (n <= 4) return 'important'
    if (n <= 6) return 'medium'
    return 'low'
}

// карты бакетов плана: name→id и id→name
async function getPlanBuckets(companyId: string, planId: string): Promise<{ byName: Map<string, string>; byId: Map<string, string> }> {
    const byName = new Map<string, string>()
    const byId = new Map<string, string>()
    try {
        const r = await graphFetch(companyId, `/planner/plans/${planId}/buckets`)
        if (r.ok) {
            const j = (await r.json()) as { value?: { id?: string; name?: string }[] }
            for (const b of j.value ?? []) {
                if (b.id && b.name) { byName.set(b.name, b.id); byId.set(b.id, b.name) }
            }
        }
    } catch { /* ignore */ }
    return { byName, byId }
}

// записать описание в детали задачи Planner (свой etag); не меняем зря
async function setPlannerTaskDescription(companyId: string, msTaskId: string, description: string): Promise<void> {
    try {
        const g = await graphFetch(companyId, `/planner/tasks/${msTaskId}/details`)
        if (!g.ok) return
        const cur = (await g.json()) as Record<string, unknown>
        const etag = cur['@odata.etag'] as string | undefined
        if (!etag) return
        if (((cur.description as string | undefined) ?? '') === description) return
        await graphFetch(companyId, `/planner/tasks/${msTaskId}/details`, {
            method: 'PATCH',
            headers: { 'If-Match': etag },
            body: JSON.stringify({ description }),
        })
    } catch { /* best-effort */ }
}

// прочитать описание из деталей задачи Planner
async function getPlannerTaskDescription(companyId: string, msTaskId: string): Promise<string> {
    try {
        const g = await graphFetch(companyId, `/planner/tasks/${msTaskId}/details`)
        if (!g.ok) return ''
        const cur = (await g.json()) as { description?: string }
        return (cur.description ?? '').trim()
    } catch {
        return ''
    }
}

// ---- Чеклист (подзадачи) ↔ Planner details.checklist ----
type PlannerChecklistEntry = { title?: string; isChecked?: boolean; orderHint?: string }

// Прочитать текущий чеклист задачи из Planner
async function readPlannerChecklist(companyId: string, msTaskId: string): Promise<Record<string, PlannerChecklistEntry>> {
    try {
        const g = await graphFetch(companyId, `/planner/tasks/${msTaskId}/details`)
        if (!g.ok) return {}
        const cur = (await g.json()) as { checklist?: Record<string, PlannerChecklistEntry> }
        return cur.checklist ?? {}
    } catch { return {} }
}

// Наши пункты → Planner (при пуше наше приложение — источник правды).
// Planner держит максимум 20 пунктов на задачу.
async function pushChecklistToPlanner(companyId: string, taskId: string, msTaskId: string): Promise<void> {
    try {
        const admin = createSupabaseAdmin()
        const { data: items } = await admin
            .from('task_checklist_items')
            .select('id, title, done, sort_order, ms_item_id')
            .eq('task_id', taskId)
            .order('sort_order', { ascending: true })
        const list = (items ?? []).slice(0, 20)

        const g = await graphFetch(companyId, `/planner/tasks/${msTaskId}/details`)
        if (!g.ok) return
        const cur = (await g.json()) as Record<string, unknown>
        const etag = cur['@odata.etag'] as string | undefined
        if (!etag) return
        const existing = (cur.checklist as Record<string, PlannerChecklistEntry> | undefined) ?? {}

        const patchMap: Record<string, unknown> = {}
        const usedKeys = new Set<string>()
        const newKeys: { id: string; key: string }[] = []
        for (const it of list) {
            let key = (it.ms_item_id as string | null) || ''
            if (!key) { key = globalThis.crypto.randomUUID(); newKeys.push({ id: it.id as string, key }) }
            usedKeys.add(key)
            patchMap[key] = {
                '@odata.type': 'microsoft.graph.plannerChecklistItem',
                title: ((it.title as string) || '—').slice(0, 100),
                isChecked: !!it.done,
                orderHint: ' !',
            }
        }
        // удалённые у нас пункты — снять и в Planner
        for (const k of Object.keys(existing)) if (!usedKeys.has(k)) patchMap[k] = null
        if (Object.keys(patchMap).length === 0) return

        await graphFetch(companyId, `/planner/tasks/${msTaskId}/details`, {
            method: 'PATCH',
            headers: { 'If-Match': etag },
            body: JSON.stringify({ checklist: patchMap }),
        })
        // запомнить сгенерированные ключи Planner на наших пунктах
        for (const m of newKeys) {
            await admin.from('task_checklist_items').update({ ms_item_id: m.key }).eq('id', m.id)
        }
    } catch { /* best-effort */ }
}

// Publicная обёртка: синхронизировать чеклист задачи в Planner (зовём из экшенов).
export async function pushTaskChecklist(taskId: string): Promise<void> {
    try {
        const admin = createSupabaseAdmin()
        const { data: task } = await admin.from('tasks').select('company_id, ms_task_id').eq('id', taskId).single()
        if (!task?.company_id || !task.ms_task_id) return
        await pushChecklistToPlanner(task.company_id as string, taskId, task.ms_task_id as string)
    } catch { /* best-effort */ }
}

// Planner → наши пункты (при поллинге Planner — источник правды).
async function pullChecklistForTask(companyId: string, msTaskId: string, ourTaskId: string): Promise<void> {
    try {
        const admin = createSupabaseAdmin()
        const checklist = await readPlannerChecklist(companyId, msTaskId)
        const keys = Object.keys(checklist)
        const { data: local } = await admin
            .from('task_checklist_items')
            .select('id, title, done, ms_item_id')
            .eq('task_id', ourTaskId)
        const byKey = new Map<string, { id: string; title: string; done: boolean }>()
        for (const it of local ?? []) {
            const k = it.ms_item_id as string | null
            if (k) byKey.set(k, { id: it.id as string, title: (it.title as string) ?? '', done: !!it.done })
        }
        const now = new Date().toISOString()
        let order = 0
        for (const k of keys) {
            order++
            const e = checklist[k]
            const title = (e.title ?? '').trim() || '—'
            const done = !!e.isChecked
            const mine = byKey.get(k)
            if (mine) {
                if (mine.title !== title || mine.done !== done) {
                    await admin.from('task_checklist_items').update({ title, done, updated_at: now }).eq('id', mine.id)
                }
            } else {
                await admin.from('task_checklist_items').insert({ task_id: ourTaskId, title, done, ms_item_id: k, sort_order: order })
            }
        }
        // удалённые в Planner (были с ключом, ключа больше нет) — убрать у нас
        for (const [k, it] of byKey) if (!keys.includes(k)) await admin.from('task_checklist_items').delete().eq('id', it.id)
    } catch { /* best-effort */ }
}

// azure-user-id → id нашего профиля в компании (по ms_email/email). null — не нашли
async function resolveProfileByAzureId(companyId: string, azureId: string): Promise<string | null> {
    try {
        const r = await graphFetch(companyId, `/users/${azureId}?$select=mail,userPrincipalName`)
        if (!r.ok) return null
        const u = (await r.json()) as { mail?: string; userPrincipalName?: string }
        const email = (u.mail || u.userPrincipalName || '').toLowerCase()
        if (!email) return null
        const admin = createSupabaseAdmin()
        const byMs = await admin.from('profiles').select('id').eq('company_id', companyId).eq('ms_email', email).limit(1).maybeSingle()
        if (byMs.data?.id) return byMs.data.id as string
        const byEmail = await admin.from('profiles').select('id').eq('company_id', companyId).eq('email', email).limit(1).maybeSingle()
        return (byEmail.data?.id as string | undefined) ?? null
    } catch {
        return null
    }
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

// Снести зеркало задачи в Planner. Вызывать ПЕРЕД физическим удалением у нас,
// иначе входящая синхра увидит «есть в Planner, нет у нас» и воскресит задачу.
export async function deleteTaskFromPlanner(taskId: string): Promise<void> {
    try {
        const admin = createSupabaseAdmin()
        const { data: task } = await admin.from('tasks').select('company_id, ms_task_id').eq('id', taskId).single()
        if (!task?.company_id || !task.ms_task_id) return
        await deletePlannerTask(task.company_id as string, task.ms_task_id as string)
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

        // сегмент (бакет) по типу задачи
        const segName = TYPE_TO_SEGMENT[task.entity_type as string]
        if (segName) {
            const { byName } = await getPlanBuckets(task.company_id, integ.plan_id as string)
            const bucketId = byName.get(segName)
            if (bucketId) fields.bucketId = bucketId
        }
        // метки: Клиент (category1) / Партнёр (category2)
        fields.appliedCategories = {
            category1: !!task.client_id,
            category2: !!task.partner_id,
        }

        if (!task.ms_task_id) {
            // создать — от имени НАЗНАЧИВШЕГО (creator), чтобы в Planner «создал: он».
            // Если у него нет личного токена — getActingToken вернёт общий аккаунт.
            const body = JSON.stringify({ planId: integ.plan_id, ...fields })
            const acting = await getActingToken(task.company_id, (task.creator_id as string | null) ?? null)
            if (!acting) return
            let res = await rawGraphFetch(acting.token, '/planner/tasks', { method: 'POST', body })
            // личный аккаунт может не иметь доступа к плану (не в группе) → пробуем общий
            if (!res.ok && acting.source === 'user') {
                const companyTok = await getAccessTokenForCompany(task.company_id)
                if (companyTok) res = await rawGraphFetch(companyTok, '/planner/tasks', { method: 'POST', body })
            }
            if (!res.ok) return
            const created = (await res.json()) as { id?: string }
            if (created.id) {
                await admin.from('tasks').update({ ms_task_id: created.id, ms_synced_at: new Date().toISOString() }).eq('id', taskId)
                await setPlannerTaskDescription(task.company_id, created.id, (task.description as string) || '')
                await pushChecklistToPlanner(task.company_id, taskId, created.id)
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
                await setPlannerTaskDescription(task.company_id, task.ms_task_id as string, (task.description as string) || '')
            }
            await pushChecklistToPlanner(task.company_id, task.ms_task_id as string, task.ms_task_id as string)
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
    priority?: number
    bucketId?: string | null
    hasDescription?: boolean
    checklistItemCount?: number
    assignments?: Record<string, unknown>
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
        const { byId: bucketNameById } = await getPlanBuckets(companyId, integ.plan_id as string)

        // наши задачи этой компании, уже связанные с Planner
        const { data: ours } = await admin
            .from('tasks')
            .select('id, title, status, due_at, priority, entity_type, description, assignee_id, ms_task_id')
            .eq('company_id', companyId)
            .not('ms_task_id', 'is', null)
        const byMsId = new Map<string, { id: string; title: string; status: string; due_at: string | null; priority: string; entity_type: string; description: string; assignee_id: string | null }>()
        for (const t of ours ?? []) {
            if (t.ms_task_id) byMsId.set(t.ms_task_id as string, { id: t.id as string, title: (t.title as string) ?? '', status: t.status as string, due_at: (t.due_at as string | null) ?? null, priority: (t.priority as string) ?? 'medium', entity_type: (t.entity_type as string) ?? 'general', description: (t.description as string | null) ?? '', assignee_id: (t.assignee_id as string | null) ?? null })
        }

        // наши задачи, у которых уже есть пункты чеклиста (чтобы не дёргать details зря)
        const ourIds = Array.from(byMsId.values()).map((v) => v.id)
        const hasLocalChecklist = new Set<string>()
        if (ourIds.length > 0) {
            const { data: clRows } = await admin
                .from('task_checklist_items')
                .select('task_id')
                .in('task_id', ourIds)
            for (const r of clRows ?? []) hasLocalChecklist.add(r.task_id as string)
        }

        let updated = 0
        let created = 0
        const now = new Date().toISOString()

        for (const pt of plannerTasks) {
            if (!pt.id) continue
            const nextStatus = percentToStatus(pt.percentComplete)
            const nextTitle = (pt.title ?? '').trim() || '—'
            const nextDue = pt.dueDateTime ? new Date(pt.dueDateTime).toISOString() : null
            const nextPriority = plannerPriorityToOurs(pt.priority)
            const bucketName = pt.bucketId ? bucketNameById.get(pt.bucketId) : undefined
            const nextType = bucketName ? SEGMENT_TO_TYPE[bucketName] : undefined

            const mine = byMsId.get(pt.id)
            // отменённую у нас не трогаем: в Planner она висит как 100%
            if (mine && mine.status === 'cancelled') continue

            // описание — только если в Planner оно есть; исполнитель — только если назначен и распознан
            const nextDescription = pt.hasDescription ? await getPlannerTaskDescription(companyId, pt.id) : ''
            let nextAssignee: string | null = null
            const azureIds = pt.assignments ? Object.keys(pt.assignments) : []
            if (azureIds.length > 0) nextAssignee = await resolveProfileByAzureId(companyId, azureIds[0])

            if (mine) {
                const myDue = mine.due_at ? new Date(mine.due_at).toISOString() : null
                const typeChanged = !!nextType && nextType !== mine.entity_type
                const descChanged = (mine.description ?? '') !== nextDescription
                // исполнителя только адоптируем (никогда не чистим: у исполнителя может не быть MS-аккаунта)
                const assigneeChanged = !!nextAssignee && nextAssignee !== mine.assignee_id
                const diff = mine.title !== nextTitle || mine.status !== nextStatus || myDue !== nextDue
                    || mine.priority !== nextPriority || typeChanged || descChanged || assigneeChanged
                if (diff) {
                    const patch: Record<string, unknown> = {
                        title: nextTitle,
                        status: nextStatus,
                        due_at: nextDue,
                        priority: nextPriority,
                        ms_synced_at: now,
                        updated_at: now,
                    }
                    if (nextType) patch.entity_type = nextType
                    if (descChanged) patch.description = nextDescription || null
                    if (assigneeChanged) patch.assignee_id = nextAssignee
                    // статус закрыт → проставим completed_at, открыт → снимем
                    if (nextStatus === 'done') patch.completed_at = now
                    else patch.completed_at = null
                    await admin.from('tasks').update(patch).eq('id', mine.id)
                    updated++
                }
                // чеклист: подтягиваем из Planner, если там есть пункты или они есть у нас
                if ((pt.checklistItemCount ?? 0) > 0 || hasLocalChecklist.has(mine.id)) {
                    await pullChecklistForTask(companyId, pt.id, mine.id)
                }
            } else {
                // задача создана прямо в Planner — заводим у нас
                const insert: Record<string, unknown> = {
                    company_id: companyId,
                    title: nextTitle,
                    status: nextStatus,
                    priority: nextPriority,
                    entity_type: nextType || 'general',
                    due_at: nextDue,
                    ms_task_id: pt.id,
                    ms_synced_at: now,
                    external_source: 'planner',
                }
                if (nextDescription) insert.description = nextDescription
                if (nextAssignee) insert.assignee_id = nextAssignee
                if (nextStatus === 'done') insert.completed_at = now
                const { data: ins } = await admin.from('tasks').insert(insert).select('id').single()
                created++
                // чеклист новой (созданной в Planner) задачи — подтянуть сразу
                if (ins?.id && (pt.checklistItemCount ?? 0) > 0) {
                    await pullChecklistForTask(companyId, pt.id, ins.id as string)
                }
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