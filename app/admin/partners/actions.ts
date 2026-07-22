'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export type PartnerUpdate = {
  name?: string
  service_type?: string | null
  destination?: string | null
  operator_group?: string | null
  useful_links?: string | null
  comments?: string | null
}

export async function createPartner() {
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

  const { data, error } = await supabase
    .from('partners')
    .insert({
      name: '',
      service_type: 'Accomodation',
      company_id: companyId,
      owner_id: user?.id ?? null,
    })
    .select()
    .single()

  if (error || !data) throw new Error(error?.message || 'Failed to create partner')

  revalidatePath('/admin/partners')
  redirect(`/admin/partners/${data.id}`)
}

export async function updatePartner(id: string, updates: PartnerUpdate) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('partners')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/partners')
  revalidatePath(`/admin/partners/${id}`)
}

export async function deletePartner(id: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('partners')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/partners')
}

export async function duplicatePartner(id: string) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: original, error: fetchError } = await supabase
    .from('partners')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !original) throw new Error('Partner not found')

  const { error: createError } = await supabase
    .from('partners')
    .insert({
      name: original.name ? `${original.name} (copy)` : '',
      service_type: original.service_type,
      destination: original.destination,
      operator_group: original.operator_group,
      useful_links: original.useful_links,
      comments: original.comments,
      company_id: original.company_id,
      owner_id: user?.id ?? original.owner_id ?? null,
    })

  if (createError) throw new Error(createError.message)
  revalidatePath('/admin/partners')
}