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

// Проверяет: вызывающий — owner/admin, и целевой юзер в ТОЙ ЖЕ компании.
// Возвращает admin-клиент для дальнейших операций. Бросает ошибку, если нельзя.
async function assertCanManageUser(targetId: string) {
  const profile = await getProfile()
  if (!canManageBrand(profile?.role)) {
    throw new Error('Недостаточно прав')
  }

  const admin = createSupabaseAdmin()

  // Компания вызывающего
  const { data: me } = await admin
    .from('profiles')
    .select('company_id')
    .eq('id', profile!.id)
    .single()

  if (!me?.company_id) throw new Error('Компания не найдена')

  // Компания целевого юзера
  const { data: target } = await admin
    .from('profiles')
    .select('company_id')
    .eq('id', targetId)
    .single()

  if (!target) throw new Error('Пользователь не найден')
  if (target.company_id !== me.company_id) {
    throw new Error('Нельзя управлять пользователем другого бренда')
  }

  return { admin, myId: profile!.id }
}

export async function deleteUser(id: string) {
  const { admin, myId } = await assertCanManageUser(id)

  // Защита от удаления самого себя
  if (id === myId) throw new Error('Нельзя удалить собственный аккаунт')

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
}

export async function resetPassword(id: string, newPassword: string) {
  const { admin } = await assertCanManageUser(id)

  if (newPassword.length < 6) {
    throw new Error('Пароль должен быть не короче 6 символов')
  }

  const { error } = await admin.auth.admin.updateUserById(id, {
    password: newPassword,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
}

export async function toggleRole(id: string, newRole: 'admin' | 'manager') {
  // Проверяем права вызывающего — менять роли может только owner/admin
  const profile = await getProfile()
  if (!canManageBrand(profile?.role)) {
    throw new Error('Недостаточно прав')
  }

  const admin = createSupabaseAdmin()

  // Единственный источник правды по роли — profiles.role.
  // user_metadata.role триггер читает ТОЛЬКО при создании юзера (INSERT),
  // при смене роли она бесполезна и лишь плодит рассинхрон — поэтому не трогаем.
  const { error } = await admin
    .from('profiles')
    .update({ role: newRole })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
}