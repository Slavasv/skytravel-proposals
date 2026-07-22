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