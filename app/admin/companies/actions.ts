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