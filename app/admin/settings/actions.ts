'use server'

import { getProfile } from '@/lib/get-profile'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export async function updateCompany(formData: FormData) {
  // 1. Проверяем, что вызывающий — owner (только он правит настройки бренда)
  const profile = await getProfile()
  if (profile?.role !== 'owner') {
    throw new Error('Недостаточно прав')
  }

  // 2. Находим company_id текущего owner'а (через его профиль)
  const server = await createSupabaseServer()
  const { data: { user } } = await server.auth.getUser()
  if (!user) throw new Error('Не авторизован')

  const { data: me } = await server
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!me?.company_id) throw new Error('Компания не найдена')

  // 3. Собираем соцсети в JSON (пустые строки не сохраняем)
  const socials: Record<string, string> = {}
  for (const key of ['whatsapp', 'instagram', 'telegram', 'facebook']) {
    const val = (formData.get(`social_${key}`) as string)?.trim()
    if (val) socials[key] = val
  }

  // 4. Сохраняем (через admin-клиент, т.к. на companies нет политики записи)
  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('companies')
    .update({
      logo_url: (formData.get('logo_url') as string)?.trim() || null,
      accent_color: (formData.get('accent_color') as string)?.trim() || null,
      contact_email: (formData.get('contact_email') as string)?.trim() || null,
      contact_phone: (formData.get('contact_phone') as string)?.trim() || null,
      website_url: (formData.get('website_url') as string)?.trim() || null,
      office_address: (formData.get('office_address') as string)?.trim() || null,
      tagline: (formData.get('tagline') as string)?.trim() || null,
      greeting_message: (formData.get('greeting_message') as string)?.trim() || null,
      footer_note: (formData.get('footer_note') as string)?.trim() || null,
      socials,
    })
    .eq('id', me.company_id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/settings')
}