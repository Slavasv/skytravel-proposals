'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

async function companyAndUser() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  let companyId: string | null = null
  if (user) {
    const { data: me } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    companyId = me?.company_id ?? null
  }
  return { supabase, user, companyId }
}

export async function createOffer() {
  const { supabase, user, companyId } = await companyAndUser()
  if (!companyId) throw new Error('Компания не найдена')
  const { data, error } = await supabase
    .from('admin_offers')
    .insert({ title: '', status: 'draft', company_id: companyId, owner_id: user?.id ?? null })
    .select()
    .single()
  if (error || !data) throw new Error(error?.message || 'Не удалось создать оффер')
  revalidatePath('/admin/offers')
  redirect(`/admin/offers/${data.id}`)
}

export async function deleteOffer(id: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('admin_offers').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/offers')
}
