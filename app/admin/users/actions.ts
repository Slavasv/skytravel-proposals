'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProfile, canManageBrand } from '@/lib/get-profile'
import { tr } from '@/lib/i18n'
import { revalidatePath } from 'next/cache'

export async function createUser(email: string, password: string, role: 'admin' | 'manager' | 'accountant', fullName?: string) {
  // Проверяем, что вызывающий — owner или admin, и узнаём его компанию
  const profile = await getProfile()
  const lang = profile?.ui_language ?? 'en'
  if (!canManageBrand(profile?.role)) {
    throw new Error(tr(lang, 'Insufficient permissions', 'Недостаточно прав'))
  }

  // Находим company_id создателя — новый юзер попадёт в ту же компанию
  const server = await createSupabaseServer()
  const { data: { user: creator } } = await server.auth.getUser()
  if (!creator) throw new Error(tr(lang, 'Not authorized', 'Не авторизован'))

  const { data: creatorProfile } = await server
    .from('profiles')
    .select('company_id')
    .eq('id', creator.id)
    .single()

  if (!creatorProfile?.company_id) throw new Error(tr(lang, 'Creator company not found', 'Компания создателя не найдена'))

  const admin = createSupabaseAdmin()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
  })

  if (error) throw new Error(error.message)
  if (!data.user) throw new Error(tr(lang, 'User not created', 'Пользователь не создан'))

  // Ставим роль И привязываем к компании создателя
  await admin
    .from('profiles')
    .update({ role, company_id: creatorProfile.company_id, full_name: fullName?.trim() || null })
    .eq('id', data.user.id)

  revalidatePath('/admin/users')
}

// Задать/изменить имя сотрудника (owner/admin, в своей компании).
export async function updateUserName(id: string, fullName: string) {
  const { admin } = await assertCanManageUser(id)
  const { error } = await admin
    .from('profiles')
    .update({ full_name: fullName.trim() || null })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/users')
}

// Сменить email-логин пользователя (owner/admin, в своей компании; можно и себе).
// Меняем и auth-логин, и profiles.email — последний читает синхронизация
// исполнителя с Microsoft (resolveAzureUserId по email профиля).
export async function updateUserEmail(id: string, newEmail: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { admin, lang } = await assertCanManageUser(id)
    const email = newEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      return { ok: false, error: tr(lang, 'Enter a valid email', 'Введите корректный email') }
    }

    // Проверим, не занят ли этот email другим auth-аккаунтом (глобально, по всем компаниям).
    // Supabase на такой конфликт отдаёт невнятное «Error updating user».
    try {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      const clash = list?.users?.find((u) => (u.email || '').toLowerCase() === email && u.id !== id)
      if (clash) {
        return { ok: false, error: tr(lang, `Email is already used by another account (id ${clash.id})`, `Email уже занят другим аккаунтом (id ${clash.id})`) }
      }
    } catch { /* проверка необязательна */ }

    // 1) сам логин входа (auth)
    const { error: authErr } = await admin.auth.admin.updateUserById(id, {
      email,
      email_confirm: true,
    })
    if (authErr) {
      const status = (authErr as { status?: number }).status
      const code = (authErr as { code?: string }).code
      return { ok: false, error: `auth: ${authErr.message}${status ? ` [${status}]` : ''}${code ? ` (${code})` : ''}` }
    }

    // 2) держим profiles.email в синхроне (его читает пуш задач в Planner)
    const { error: profErr } = await admin.from('profiles').update({ email }).eq('id', id)
    if (profErr) return { ok: false, error: `profiles: ${profErr.message}` }

    revalidatePath('/admin/users')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// Задать/очистить рабочий email для синхронизации с Microsoft (Azure/Planner).
// Это НЕ логин входа — просто поле профиля, не обязано быть уникальным.
export async function updateUserMsEmail(id: string, msEmail: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { admin } = await assertCanManageUser(id)
    const email = msEmail.trim().toLowerCase()
    if (email && !email.includes('@')) {
      return { ok: false, error: 'Введите корректный email' }
    }
    const { error } = await admin.from('profiles').update({ ms_email: email || null }).eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin/users')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// Проверяет: вызывающий — owner/admin, и целевой юзер в ТОЙ ЖЕ компании.
// Возвращает admin-клиент для дальнейших операций. Бросает ошибку, если нельзя.
async function assertCanManageUser(targetId: string) {
  const profile = await getProfile()
  const lang = profile?.ui_language ?? 'en'
  if (!canManageBrand(profile?.role)) {
    throw new Error(tr(lang, 'Insufficient permissions', 'Недостаточно прав'))
  }

  const admin = createSupabaseAdmin()

  // Компания вызывающего
  const { data: me } = await admin
    .from('profiles')
    .select('company_id')
    .eq('id', profile!.id)
    .single()

  if (!me?.company_id) throw new Error(tr(lang, 'Company not found', 'Компания не найдена'))

  // Компания целевого юзера
  const { data: target } = await admin
    .from('profiles')
    .select('company_id')
    .eq('id', targetId)
    .single()

  if (!target) throw new Error(tr(lang, 'User not found', 'Пользователь не найден'))
  if (target.company_id !== me.company_id) {
    throw new Error(tr(lang, 'You cannot manage a user from another brand', 'Нельзя управлять пользователем другого бренда'))
  }

  return { admin, myId: profile!.id, lang }
}

export async function deleteUser(id: string) {
  const { admin, myId, lang } = await assertCanManageUser(id)

  // Защита от удаления самого себя
  if (id === myId) throw new Error(tr(lang, 'You cannot delete your own account', 'Нельзя удалить собственный аккаунт'))

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
}

export async function resetPassword(id: string, newPassword: string) {
  const { admin, lang } = await assertCanManageUser(id)

  if (newPassword.length < 6) {
    throw new Error(tr(lang, 'Password must be at least 6 characters', 'Пароль должен быть не короче 6 символов'))
  }

  const { error } = await admin.auth.admin.updateUserById(id, {
    password: newPassword,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
}

export async function toggleRole(id: string, newRole: 'admin' | 'manager' | 'accountant') {
  // Проверяем права вызывающего — менять роли может только owner/admin
  const profile = await getProfile()
  const lang = profile?.ui_language ?? 'en'
  if (!canManageBrand(profile?.role)) {
    throw new Error(tr(lang, 'Insufficient permissions', 'Недостаточно прав'))
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