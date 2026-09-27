'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getProfile } from '@/lib/get-profile'
import { tr } from '@/lib/i18n'
import { revalidatePath } from 'next/cache'

export async function createBrand(
  name: string,
  slug: string,
  ownerEmail: string,
  ownerPassword: string
) {
  // Только superadmin может создавать бренды
  const profile = await getProfile()
  const lang = profile?.ui_language ?? 'en'
  if (profile?.role !== 'superadmin') {
    throw new Error(tr(lang, 'Insufficient permissions', 'Недостаточно прав'))
  }

  const cleanName = name.trim()
  const cleanSlug = slug.trim().toLowerCase()

  if (!cleanName || !cleanSlug) throw new Error(tr(lang, 'Name and slug are required', 'Имя и slug обязательны'))
  if (!ownerEmail.trim() || ownerPassword.length < 6) {
    throw new Error(tr(lang, 'Owner email and password are required (password at least 6 characters)', 'Email и пароль владельца обязательны (пароль от 6 символов)'))
  }

  const admin = createSupabaseAdmin()

  // 1. Создаём компанию
  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({ name: cleanName, slug: cleanSlug })
    .select('id')
    .single()

  if (companyError) {
    // Скорее всего slug занят (unique)
    if (companyError.message.includes('duplicate') || companyError.code === '23505') {
      throw new Error(tr(lang, `Slug "${cleanSlug}" is already taken`, `Slug "${cleanSlug}" уже занят`))
    }
    throw new Error(companyError.message)
  }

  // 2. Создаём auth-юзера (будущий owner)
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: ownerEmail.trim(),
    password: ownerPassword,
    email_confirm: true,
    user_metadata: { role: 'owner' },
  })

  if (userError || !userData.user) {
    // Бренд уже создан, но owner не создался — сообщаем явно
    const reason = userError?.message ?? tr(lang, 'unknown error', 'неизвестная ошибка')
    throw new Error(tr(lang, `Brand created, but owner was not: ${reason}. Delete the brand and try again.`, `Бренд создан, но владелец не создан: ${reason}. Удалите бренд и попробуйте снова.`))
  }

  // 3. Прописываем владельцу роль owner + привязку к новой компании
  await admin
    .from('profiles')
    .update({ role: 'owner', company_id: company.id })
    .eq('id', userData.user.id)

  revalidatePath('/admin/companies')
}

// ============ Суперадмин: управление брендами ============

// Проверяет, что вызывающий — superadmin. Возвращает admin-клиент.
async function assertSuperadmin() {
  const profile = await getProfile()
  const lang = profile?.ui_language ?? 'en'
  if (profile?.role !== 'superadmin') {
    throw new Error(tr(lang, 'Insufficient permissions', 'Недостаточно прав'))
  }
  return { admin: createSupabaseAdmin(), lang, meId: profile.id }
}

// id владельца бренда (роль owner). Если owner не найден — первый профиль компании.
async function getOwnerId(
  admin: ReturnType<typeof createSupabaseAdmin>,
  companyId: string
): Promise<string | null> {
  const { data } = await admin
    .from('profiles')
    .select('id, role, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
  const list = data ?? []
  const owner = list.find((p) => p.role === 'owner') ?? list[0]
  return owner?.id ?? null
}

// Сбросить пароль владельца бренда (superadmin, любой бренд).
export async function superadminResetPassword(
  companyId: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { admin, lang } = await assertSuperadmin()
    if (newPassword.length < 6) {
      return { ok: false, error: tr(lang, 'Password must be at least 6 characters', 'Пароль должен быть не короче 6 символов') }
    }
    const ownerId = await getOwnerId(admin, companyId)
    if (!ownerId) return { ok: false, error: tr(lang, 'Owner not found', 'Владелец бренда не найден') }

    const { error } = await admin.auth.admin.updateUserById(ownerId, { password: newPassword })
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin/companies')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// Сменить логин-email владельца бренда (superadmin). Меняем и auth-логин, и profiles.email.
export async function superadminUpdateOwnerEmail(
  companyId: string,
  newEmail: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { admin, lang } = await assertSuperadmin()
    const email = newEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      return { ok: false, error: tr(lang, 'Enter a valid email', 'Введите корректный email') }
    }
    const ownerId = await getOwnerId(admin, companyId)
    if (!ownerId) return { ok: false, error: tr(lang, 'Owner not found', 'Владелец бренда не найден') }

    // email в auth уникален глобально — проверим, не занят ли другим аккаунтом
    try {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      const clash = list?.users?.find((u) => (u.email || '').toLowerCase() === email && u.id !== ownerId)
      if (clash) {
        return { ok: false, error: tr(lang, 'Email is already used by another account', 'Email уже занят другим аккаунтом') }
      }
    } catch { /* проверка необязательна */ }

    const { error: authErr } = await admin.auth.admin.updateUserById(ownerId, { email, email_confirm: true })
    if (authErr) return { ok: false, error: `auth: ${authErr.message}` }

    const { error: profErr } = await admin.from('profiles').update({ email }).eq('id', ownerId)
    if (profErr) return { ok: false, error: `profiles: ${profErr.message}` }

    revalidatePath('/admin/companies')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// Полностью удалить бренд со всеми данными (superadmin). Необратимо.
// Порядок важен: profiles и proposals ссылаются на companies БЕЗ каскада.
// 1) удаляем auth-юзеров бренда (каскадит profiles), 2) предложения (каскадит дни/блоки/варианты),
// 3) сам бренд — всё остальное (клиенты, заявки, брони, ваучеры, партнёры, задачи, бухгалтерия,
//    Microsoft, библиотека) уходит каскадом по company_id.
export async function deleteCompany(
  companyId: string,
  confirmName: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { admin, lang } = await assertSuperadmin()

    const { data: company } = await admin
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single()
    if (!company) return { ok: false, error: tr(lang, 'Company not found', 'Компания не найдена') }

    // защита: имя должно совпасть точно
    if ((confirmName || '').trim().toLowerCase() !== (company.name || '').trim().toLowerCase()) {
      return { ok: false, error: tr(lang, 'Brand name does not match', 'Название бренда не совпадает') }
    }

    // 1) auth-юзеры бренда (суперадминов не трогаем) → удаление каскадит их profiles
    const { data: members } = await admin
      .from('profiles')
      .select('id, role')
      .eq('company_id', companyId)
    for (const m of members ?? []) {
      if (m.role === 'superadmin') continue
      await admin.auth.admin.deleteUser(m.id).catch(() => { /* best-effort */ })
    }

    // подчищаем возможные остатки profiles (иначе FK без каскада заблокирует удаление бренда)
    await admin.from('profiles').update({ company_id: null }).eq('company_id', companyId)

    // 2) предложения (companies FK без каскада) — дети (дни/блоки/варианты) уходят каскадом
    await admin.from('proposals').delete().eq('company_id', companyId)

    // 3) сам бренд — остальные данные каскадом
    const { error } = await admin.from('companies').delete().eq('id', companyId)
    if (error) return { ok: false, error: error.message }

    revalidatePath('/admin/companies')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}