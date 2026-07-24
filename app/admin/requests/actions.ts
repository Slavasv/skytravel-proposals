'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// Статусы, которые закрывают запрос
const CLOSING_STATUSES = ['confirmed', 'cancelled']

export type RequestUpdate = {
  client_id?: string | null
  destination?: string | null
  details?: string | null
  status?: string
  priority?: string | null
  cancel_reason?: string | null
  cancel_note?: string | null
  client_notes?: string | null
  agent_notes?: string | null
  trip_rating?: number | null
  trip_feedback?: string | null
}

export async function createRequest() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  let companyId: string | null = null
  if (user) {
    const { data: me } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()
    companyId = me?.company_id ?? null
  }

  if (!companyId) throw new Error('Компания не найдена')

  const { data: code } = await supabase.rpc('next_request_code', { p_company_id: companyId })

  const { data, error } = await supabase
    .from('requests')
    .insert({
      request_code: code ?? null,
      status: 'new',
      company_id: companyId,
      owner_id: user?.id ?? null,   // менеджер = кто создаёт
    })
    .select()
    .single()

  if (error || !data) throw new Error(error?.message || 'Failed to create request')

  revalidatePath('/admin/requests')
  redirect(`/admin/requests/${data.id}`)
}

export async function updateRequest(id: string, updates: RequestUpdate) {
  const supabase = await createSupabaseServer()

  // если статус меняется на закрывающий — ставим closed_at;
  // если уходит из закрывающего обратно — снимаем
  const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() }

  if (updates.status !== undefined) {
    if (CLOSING_STATUSES.includes(updates.status)) {
      // проставляем closed_at только если ещё не стоит
      const { data: current } = await supabase
        .from('requests')
        .select('closed_at')
        .eq('id', id)
        .single()
      if (!current?.closed_at) {
        patch.closed_at = new Date().toISOString()
      }
    } else {
      // вернули в работу — сбрасываем дату закрытия
      patch.closed_at = null
    }
  }

  const { error } = await supabase
    .from('requests')
    .update(patch)
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/requests')
  revalidatePath(`/admin/requests/${id}`)
}

export async function deleteRequest(id: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('requests')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/requests')
}

export async function duplicateRequest(id: string) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: original, error: fetchError } = await supabase
    .from('requests')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !original) throw new Error('Request not found')

  const { data: code } = await supabase.rpc('next_request_code', {
    p_company_id: original.company_id,
  })

  const { error: createError } = await supabase
    .from('requests')
    .insert({
      request_code: code ?? null,
      client_id: original.client_id,
      destination: original.destination,
      details: original.details,
      status: 'new',                 // копия — новый запрос, статус сбрасываем
      priority: original.priority,
      company_id: original.company_id,
      owner_id: user?.id ?? original.owner_id ?? null,
    })

  if (createError) throw new Error(createError.message)
  revalidatePath('/admin/requests')
}

// список клиентов для дропдауна (ClientPicker)
export type RequestClientOption = {
  id: string
  name: string
  client_code: string | null
}

export async function getClientsForRequest(): Promise<RequestClientOption[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, client_code')
    .order('name', { ascending: true })
  if (error || !data) return []
  return data as RequestClientOption[]
}

// ============ Создание предложения / дестинейшена из запроса ============

export type LinkedProposal = {
  id: string
  kind: string | null
  slug: string
  trip_title_ru: string | null
  trip_title_en: string | null
  status: string | null
  updated_at: string
  last_viewed_at: string | null
  is_selected?: boolean
}

// Что уже создано из этого запроса
export async function getRequestProposals(requestId: string): Promise<LinkedProposal[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('proposals')
    .select('id, kind, slug, trip_title_ru, trip_title_en, status, updated_at, last_viewed_at')
    .eq('request_id', requestId)
    .order('updated_at', { ascending: false })
  if (error || !data) return []
  return data as LinkedProposal[]
}

// Создать предложение или дестинейшн из запроса.
// Клиент и запрос переносятся сразу; направление агент дозаполнит сам.
async function createFromRequest(requestId: string, kind: 'individual' | 'destination') {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: request } = await supabase
    .from('requests')
    .select('client_id, company_id, traveller_ids')
    .eq('id', requestId)
    .single()

  if (!request) throw new Error('Request not found')

  // число гостей — из отмеченных travellers запроса
  const guestCount = Array.isArray(request.traveller_ids) && request.traveller_ids.length > 0
    ? request.traveller_ids.length
    : 1

  // имя клиента подставляем ТОЛЬКО в предложение.
  // Дестинейшн переиспользуемый — он не привязан к конкретному клиенту.
  let clientName = ''
  if (kind === 'individual' && request.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('name')
      .eq('id', request.client_id)
      .single()
    clientName = client?.name || ''
  }

  const slug = `untitled-${Date.now().toString(36)}`

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      slug,
      kind,
      client_id: kind === 'individual' ? request.client_id : null,
      request_id: requestId,
      client_name_ru: clientName || null,
      client_name_en: clientName || null,
      trip_title_ru: null,
      trip_title_en: null,
      guest_count: guestCount,
      status: 'draft',
      currency: 'USD',
      owner_id: user?.id ?? null,
    })
    .select()
    .single()

  if (error || !data) throw new Error(error?.message || 'Failed to create')

  // создали предложение — двигаем запрос в "Preparing proposal",
  // если он ещё в начале воронки (агент может поменять вручную)
  if (kind === 'individual') {
    const { data: req } = await supabase
      .from('requests')
      .select('status')
      .eq('id', requestId)
      .single()
    if (req && ['new', 'clients_review'].includes(req.status || '')) {
      await supabase
        .from('requests')
        .update({ status: 'preparing', updated_at: new Date().toISOString() })
        .eq('id', requestId)
    }
  }

  revalidatePath(`/admin/requests/${requestId}`)
  redirect(kind === 'destination' ? `/admin/destinations/${data.id}` : `/admin/proposals/${data.id}`)
}

export async function createProposalFromRequest(requestId: string) {
  return createFromRequest(requestId, 'individual')
}

export async function createDestinationFromRequest(requestId: string) {
  return createFromRequest(requestId, 'destination')
}

// ============ Прикрепление существующих (many-to-many) ============

// Всё, что прикреплено к запросу (созданное из него + прикреплённое вручную)
export async function getLinkedProposals(requestId: string): Promise<LinkedProposal[]> {
  const supabase = await createSupabaseServer()

  // созданные из этого запроса
  const { data: created } = await supabase
    .from('proposals')
    .select('id, kind, slug, trip_title_ru, trip_title_en, status, updated_at, last_viewed_at')
    .eq('request_id', requestId)

  // прикреплённые через таблицу связей
  const { data: links } = await supabase
    .from('request_proposal_links')
    .select('proposal_id, sort_order, is_selected')
    .eq('request_id', requestId)
    .order('sort_order', { ascending: true })

  const linkedIds = (links ?? []).map((l) => l.proposal_id)
  const selectedMap = new Map((links ?? []).map((l) => [l.proposal_id, l.is_selected]))
  let attached: LinkedProposal[] = []
  if (linkedIds.length > 0) {
    const { data } = await supabase
      .from('proposals')
      .select('id, kind, slug, trip_title_ru, trip_title_en, status, updated_at, last_viewed_at')
      .in('id', linkedIds)
    attached = (data ?? []) as LinkedProposal[]
  }

  // объединяем без дублей, проставляем флаг выбора
  const map = new Map<string, LinkedProposal>()
  ;(created ?? []).forEach((p) => map.set(p.id, { ...(p as LinkedProposal), is_selected: selectedMap.get(p.id) ?? false }))
  attached.forEach((p) => map.set(p.id, { ...p, is_selected: selectedMap.get(p.id) ?? false }))
  return Array.from(map.values())
}

// Дестинейшены, доступные для прикрепления (все в компании)
export type DestinationOption = {
  id: string
  trip_title_ru: string | null
  trip_title_en: string | null
}

export async function getAvailableDestinations(): Promise<DestinationOption[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('proposals')
    .select('id, trip_title_ru, trip_title_en')
    .eq('kind', 'destination')
    .order('updated_at', { ascending: false })
  if (error || !data) return []
  return data as DestinationOption[]
}

export async function attachProposalToRequest(requestId: string, proposalId: string) {
  const supabase = await createSupabaseServer()

  const { data: existing } = await supabase
    .from('request_proposal_links')
    .select('sort_order')
    .eq('request_id', requestId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

  const { error } = await supabase
    .from('request_proposal_links')
    .insert({ request_id: requestId, proposal_id: proposalId, sort_order: nextOrder })

  // unique нарушен = уже прикреплён, это не ошибка
  if (error && !error.message.includes('duplicate')) throw new Error(error.message)

  revalidatePath(`/admin/requests/${requestId}`)
}

export async function detachProposalFromRequest(requestId: string, proposalId: string) {
  const supabase = await createSupabaseServer()

  // убираем связь
  await supabase
    .from('request_proposal_links')
    .delete()
    .eq('request_id', requestId)
    .eq('proposal_id', proposalId)

  // если был создан из этого запроса — снимаем и request_id
  await supabase
    .from('proposals')
    .update({ request_id: null })
    .eq('id', proposalId)
    .eq('request_id', requestId)

  revalidatePath(`/admin/requests/${requestId}`)
}

// Отметить дестинейшн как выбранный клиентом.
// Выбранный может быть только один — с остальных отметка снимается.
export async function selectDestination(requestId: string, proposalId: string) {
  const supabase = await createSupabaseServer()

  await supabase
    .from('request_proposal_links')
    .update({ is_selected: false })
    .eq('request_id', requestId)

  const { error } = await supabase
    .from('request_proposal_links')
    .update({ is_selected: true })
    .eq('request_id', requestId)
    .eq('proposal_id', proposalId)

  if (error) throw new Error(error.message)
  revalidatePath(`/admin/requests/${requestId}`)
}

// Снять отметку (клиент передумал)
export async function unselectDestination(requestId: string, proposalId: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('request_proposal_links')
    .update({ is_selected: false })
    .eq('request_id', requestId)
    .eq('proposal_id', proposalId)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/requests/${requestId}`)
}