'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProfile, canManageBrand } from '@/lib/get-profile'
import { revalidatePath } from 'next/cache'

export async function createUser(email: string, password: string, role: 'admin' | 'manager') {
  // Проверяем, что вызывающий — owner или admin, и узнаём его компанию
  const profile = await getProfile()
  if (!canManageBrand(profile?.role)) {
    throw new Error('Недостаточно прав')
  }

  // Находим company_id создателя — новый юзер попадёт в ту же компанию
  const server = await createSupabaseServer()
  const { data: { user: creator } } = await server.auth.getUser()
  if (!creator) throw new Error('Не авторизован')

  const { data: creatorProfile } = await server
    .from('profiles')
    .select('company_id')
    .eq('id', creator.id)
    .single()

  if (!creatorProfile?.company_id) throw new Error('Компания создателя не найдена')

  const admin = createSupabaseAdmin()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
  })

  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('User not created')

  // Ставим роль И привязываем к компании создателя
  await admin
    .from('profiles')
    .update({ role, company_id: creatorProfile.company_id })
    .eq('id', data.user.id)

  revalidatePath('/admin/users')
}

export async function deleteUser(id: string) {
  const admin = createSupabaseAdmin()

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
}

export async function resetPassword(id: string, newPassword: string) {
  const admin = createSupabaseAdmin()

  const { error } = await admin.auth.admin.updateUserById(id, {
    password: newPassword,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
}

export async function toggleRole(id: string, newRole: 'admin' | 'manager') {
  const admin = createSupabaseAdmin()

  const { error } = await admin.auth.admin.updateUserById(id, {
    user_metadata: { role: newRole },
  })

  if (error) throw new Error(error.message)

  await admin
    .from('profiles')
    .update({ role: newRole })
    .eq('id', id)

  revalidatePath('/admin/users')
}