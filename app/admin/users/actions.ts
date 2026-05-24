'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'

export async function createUser(email: string, password: string, role: 'admin' | 'manager') {
  const admin = createSupabaseAdmin()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
  })

  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('User not created')

  await admin
    .from('profiles')
    .update({ role })
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