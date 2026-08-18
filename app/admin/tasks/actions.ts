'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { getUiLang } from '@/lib/get-profile'
import { sendPushToUser } from '@/lib/push'
import { pushTaskToPlanner } from '@/lib/microsoft-planner'
import { revalidatePath } from 'next/cache'

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'normal' | 'high'
export type TaskEntityType = 'general' | 'request' | 'proposal' | 'booking' | 'voucher' | 'library'

export type PersonLite = { id: string; name: string }
export type ClientLite = { id: string; name: string }
export type PartnerLite = { id: string; name: string }

export type TaskRow = {
    id: string
    title: string
    description: string | null
    status: TaskStatus
    priority: TaskPriority
    assignee_id: string | null
    assignee_name: string | null
    creator_id: string | null
    creator_name: string | null
    due_at: string | null
    client_id: string | null
    client_name: string | null
    partner_id: string | null
    partner_name: string | null
    entity_type: TaskEntityType
    entity_id: string | null
    context_label: string | null
    context_url: string | null
    completed_at: string | null
    completed_by: string | null
    completed_by_name: string | null
    created_at: string
}

export type NewTask = {
    title: string
    description?: string | null
    priority?: TaskPriority
    assignee_id?: string | null
    due_at?: string | null
    client_id?: string | null
    partner_id?: string | null
    entity_type?: TaskEntityType
    entity_id?: string | null
    context_label?: string | null
    context_url?: string | null
    context?: unknown
}

export type TaskUpdate = Partial<{
    title: string
    description: string | null
    status: TaskStatus
    priority: TaskPriority
    assignee_id: string | null
    due_at: string | null
    client_id: string | null
    partner_id: string | null
    entity_type: TaskEntityType
    entity_id: string | null
    context_label: string | null
    context_url: string | null
}>

export type TaskFilters = {
    scope?: 'mine' | 'assigned_by_me' | 'all' | 'done'
    q?: string
    status?: TaskStatus | null
    priority?: TaskPriority | null
    assignee_id?: string | null
    creator_id?: string | null
    client_id?: string | null
    partner_id?: string | null
    entity_type?: TaskEntityType | null
    entity_id?: string | null
    due?: 'overdue' | 'today' | 'week' | null
}

// ---- Справочники для модалки (исполнители/клиенты/партнёры) ----
export async function getTaskDirectories(): Promise<{ people: PersonLite[]; clients: ClientLite[]; partners: PartnerLite[] }> {
    const supabase = await createSupabaseServer()
    const [{ data: pr }, { data: cl }, { data: pt }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').order('full_name', { ascending: true }),
        supabase.from('clients').select('id, name').order('name', { ascending: true }),
        supabase.from('partners').select('id, name').order('name', { ascending: true }),
    ])
    const people: PersonLite[] = (pr ?? []).map((p) => ({
        id: p.id as string,
        name: ((p.full_name as string | null)?.trim() || (p.email as string | null) || '—') as string,
    }))
    const clients: ClientLite[] = (cl ?? []).map((c) => ({ id: c.id as string, name: (c.name as string | null) ?? '' }))
    const partners: PartnerLite[] = (pt ?? []).map((p) => ({ id: p.id as string, name: (p.name as string | null) ?? '' }))
    return { people, clients, partners }
}

// ---- Создать задачу ----
export async function createTask(input: NewTask): Promise<{ ok: boolean; error?: string; id?: string }> {
    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not authorized' }

    const { data: me } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    if (!me?.company_id) return { ok: false, error: 'Company not found' }

    const title = (input.title ?? '').trim()
    if (!title) return { ok: false, error: 'Title required' }

    const { data, error } = await supabase
        .from('tasks')
        .insert({
            company_id: me.company_id,
            title,
            description: input.description?.trim() || null,
            priority: input.priority ?? 'normal',
            assignee_id: input.assignee_id || null,
            creator_id: user.id,
            due_at: input.due_at || null,
            client_id: input.client_id || null,
            partner_id: input.partner_id || null,
            entity_type: input.entity_type ?? 'general',
            entity_id: input.entity_id || null,
            context_label: input.context_label || null,
            context_url: input.context_url || null,
            context: input.context ?? null,
        })
        .select('id')
        .single()

    if (error || !data) return { ok: false, error: error?.message }

    // пуш исполнителю, если задачу назначили кому-то другому
    const assignee = input.assignee_id || null
    if (assignee && assignee !== user.id) {
        const lang = await getUiLang()
        await sendPushToUser(assignee, {
            title: lang === 'ru' ? 'Новая задача' : 'New task',
            body: title,
            url: input.context_url || '/admin/tasks',
            tag: `task-${data.id}`,
        })
    }

    // зеркалим в Planner (best-effort; если синк выключен — тихо ничего не делает)
    await pushTaskToPlanner(data.id as string)

    revalidatePath('/admin/tasks')
    return { ok: true, id: data.id as string }
}

// ---- Изменить/закрыть задачу (права проверяет RLS: автор/исполнитель/админ) ----
export async function updateTask(id: string, patch: TaskUpdate): Promise<{ ok: boolean; error?: string }> {
    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()

    const upd: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() }
    if (patch.status === 'done') {
        upd.completed_at = new Date().toISOString()
        upd.completed_by = user?.id ?? null
    } else if (patch.status) {
        // сняли выполнение / отменили — чистим отметку о закрытии по факту
        upd.completed_at = patch.status === 'cancelled' ? new Date().toISOString() : null
        upd.completed_by = patch.status === 'cancelled' ? (user?.id ?? null) : null
    }

    const { error } = await supabase.from('tasks').update(upd).eq('id', id)
    if (error) return { ok: false, error: error.message }

    // зеркалим изменения в Planner (best-effort)
    await pushTaskToPlanner(id)

    revalidatePath('/admin/tasks')
    return { ok: true }
}

// ---- Список задач с фильтрами ----
export async function getTasks(filters: TaskFilters = {}): Promise<TaskRow[]> {
    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    let query = supabase.from('tasks').select('*')

    const scope = filters.scope ?? 'all'
    if (scope === 'mine') query = query.eq('assignee_id', user.id)
    else if (scope === 'assigned_by_me') query = query.eq('creator_id', user.id).neq('assignee_id', user.id)

    // активные вкладки показывают open/in_progress, «Выполненные» — done/cancelled
    if (scope === 'done') query = query.in('status', ['done', 'cancelled'])
    else query = query.in('status', ['open', 'in_progress'])
    // явный фильтр статуса перекрывает
    if (filters.status) query = query.eq('status', filters.status)

    if (filters.priority) query = query.eq('priority', filters.priority)
    if (filters.assignee_id) query = query.eq('assignee_id', filters.assignee_id)
    if (filters.creator_id) query = query.eq('creator_id', filters.creator_id)
    if (filters.client_id) query = query.eq('client_id', filters.client_id)
    if (filters.partner_id) query = query.eq('partner_id', filters.partner_id)
    if (filters.entity_type) query = query.eq('entity_type', filters.entity_type)
    if (filters.entity_id) query = query.eq('entity_id', filters.entity_id)

    if (filters.q && filters.q.trim()) {
        const q = filters.q.trim().replace(/[,()%]/g, ' ')
        query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,context_label.ilike.%${q}%`)
    }

    if (filters.due) {
        const now = new Date()
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        if (filters.due === 'overdue') {
            query = query.lt('due_at', now.toISOString())
        } else if (filters.due === 'today') {
            const startTomorrow = new Date(startToday); startTomorrow.setDate(startTomorrow.getDate() + 1)
            query = query.gte('due_at', startToday.toISOString()).lt('due_at', startTomorrow.toISOString())
        } else if (filters.due === 'week') {
            const in7 = new Date(startToday); in7.setDate(in7.getDate() + 7)
            query = query.gte('due_at', startToday.toISOString()).lt('due_at', in7.toISOString())
        }
    }

    query = query
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

    const { data: rows } = await query
    const list = (rows ?? []) as Record<string, unknown>[]
    if (list.length === 0) return []

    // имена — одним махом (profiles/clients/partners), без хрупких embed-джойнов
    const [{ data: pr }, { data: cl }, { data: pt }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email'),
        supabase.from('clients').select('id, name'),
        supabase.from('partners').select('id, name'),
    ])
    const personName = new Map<string, string>()
    for (const p of pr ?? []) {
        personName.set(p.id as string, ((p.full_name as string | null)?.trim() || (p.email as string | null) || '—') as string)
    }
    const clientName = new Map<string, string>()
    for (const c of cl ?? []) clientName.set(c.id as string, (c.name as string | null) ?? '')
    const partnerName = new Map<string, string>()
    for (const p of pt ?? []) partnerName.set(p.id as string, (p.name as string | null) ?? '')

    const nm = (m: Map<string, string>, id: unknown): string | null =>
        typeof id === 'string' && m.has(id) ? m.get(id)! : null

    return list.map((t) => ({
        id: t.id as string,
        title: t.title as string,
        description: (t.description as string | null) ?? null,
        status: t.status as TaskStatus,
        priority: t.priority as TaskPriority,
        assignee_id: (t.assignee_id as string | null) ?? null,
        assignee_name: nm(personName, t.assignee_id),
        creator_id: (t.creator_id as string | null) ?? null,
        creator_name: nm(personName, t.creator_id),
        due_at: (t.due_at as string | null) ?? null,
        client_id: (t.client_id as string | null) ?? null,
        client_name: nm(clientName, t.client_id),
        partner_id: (t.partner_id as string | null) ?? null,
        partner_name: nm(partnerName, t.partner_id),
        entity_type: t.entity_type as TaskEntityType,
        entity_id: (t.entity_id as string | null) ?? null,
        context_label: (t.context_label as string | null) ?? null,
        context_url: (t.context_url as string | null) ?? null,
        completed_at: (t.completed_at as string | null) ?? null,
        completed_by: (t.completed_by as string | null) ?? null,
        completed_by_name: nm(personName, t.completed_by),
        created_at: t.created_at as string,
    }))
}

// ---- Открытые задачи конкретной сущности (мини-список на карточке) ----
export async function getEntityTasks(entityType: TaskEntityType, entityId: string): Promise<TaskRow[]> {
    return getTasks({ scope: 'all', entity_type: entityType, entity_id: entityId })
}

// ---- Колокольчик: назначено мне И (просрочено или срок сегодня) И не закрыто ----
export async function getMyBellTasks(): Promise<TaskRow[]> {
    const rows = await getTasks({ scope: 'mine' })
    const now = new Date()
    const startTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    return rows.filter((r) => r.due_at && new Date(r.due_at) < startTomorrow)
}

// ---- Контекст сущности по id (для авто-подстановки в FAB: подпись, клиент, ссылка) ----
export type EntityContext = { label: string | null; client_id: string | null; partner_id: string | null; url: string | null }

export async function getEntityContext(entityType: TaskEntityType, entityId: string): Promise<EntityContext> {
    const none: EntityContext = { label: null, client_id: null, partner_id: null, url: null }
    if (!entityId) return none
    const supabase = await createSupabaseServer()
    const lang = await getUiLang()
    const L = (en: string, ru: string) => (lang === 'ru' ? ru : en)

    if (entityType === 'request') {
        const { data } = await supabase.from('requests').select('request_code, client_id').eq('id', entityId).single()
        if (!data) return none
        return {
            label: data.request_code ? `${L('Request', 'Заявка')} ${data.request_code}` : L('Request', 'Заявка'),
            client_id: (data.client_id as string | null) ?? null, partner_id: null,
            url: `/admin/requests/${entityId}`,
        }
    }
    if (entityType === 'booking') {
        const { data } = await supabase.from('bookings').select('booking_code, client_id').eq('id', entityId).single()
        if (!data) return none
        return {
            label: data.booking_code ? `${L('Booking', 'Бронь')} ${data.booking_code}` : L('Booking', 'Бронь'),
            client_id: (data.client_id as string | null) ?? null, partner_id: null,
            url: `/admin/bookings/${entityId}`,
        }
    }
    if (entityType === 'proposal') {
        const { data } = await supabase.from('proposals').select('trip_title_ru, trip_title_en, client_name_ru, client_name_en').eq('id', entityId).single()
        if (!data) return none
        const title = (lang === 'ru' ? data.trip_title_ru : data.trip_title_en) || data.trip_title_ru || data.trip_title_en
            || (lang === 'ru' ? data.client_name_ru : data.client_name_en) || data.client_name_ru || data.client_name_en || ''
        return {
            label: title ? `${L('Proposal', 'Предложение')} · ${title}` : L('Proposal', 'Предложение'),
            client_id: null, partner_id: null, url: `/admin/proposals/${entityId}`,
        }
    }
    if (entityType === 'voucher') {
        const { data } = await supabase.from('vouchers').select('voucher_no').eq('id', entityId).single()
        if (!data) return none
        return {
            label: data.voucher_no ? `${L('Voucher', 'Ваучер')} ${data.voucher_no}` : L('Voucher', 'Ваучер'),
            client_id: null, partner_id: null, url: `/admin/vouchers/${entityId}`,
        }
    }
    if (entityType === 'library') {
        const { data } = await supabase.from('content_blocks').select('title_ru, title_en').eq('id', entityId).single()
        if (!data) return none
        const title = (lang === 'ru' ? data.title_ru : data.title_en) || data.title_ru || data.title_en || ''
        return {
            label: title ? `${L('Library', 'Библиотека')} · ${title}` : L('Library', 'Библиотека'),
            client_id: null, partner_id: null, url: `/admin/library/${entityId}`,
        }
    }
    return none
}