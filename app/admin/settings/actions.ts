'use server'

import { getProfile } from '@/lib/get-profile'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

async function currentUserId(): Promise<string> {
  const server = await createSupabaseServer()
  const { data: { user } } = await server.auth.getUser()
  if (!user) throw new Error('Не авторизован')
  return user.id
}

// доступ владельца к бренду: членство ИЛИ основной бренд из профиля (через admin-клиент)
async function assertOwnerMember(companyId: string): Promise<void> {
  const profile = await getProfile()
  if (profile?.role !== 'owner') throw new Error('Недостаточно прав')
  const uid = await currentUserId()
  const admin = createSupabaseAdmin()
  const { data: m } = await admin.from('company_members').select('company_id').eq('user_id', uid).eq('company_id', companyId).maybeSingle()
  if (m) return
  const { data: me } = await admin.from('profiles').select('company_id').eq('id', uid).single()
  if (me?.company_id === companyId) return
  throw new Error('Нет доступа к этому бренду')
}

export async function updateCompany(formData: FormData) {
  const companyId = (formData.get('company_id') as string)?.trim()
  if (!companyId) throw new Error('Не указан бренд')
  await assertOwnerMember(companyId)

  const socials: Record<string, string> = {}
  for (const key of ['whatsapp', 'instagram', 'telegram', 'facebook']) {
    const val = (formData.get(`social_${key}`) as string)?.trim()
    if (val) socials[key] = val
  }

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
      voucher_template: Number(formData.get('voucher_template')) || 1,
      voucher_bg_url: (formData.get('voucher_bg_url') as string)?.trim() || null,
      socials,
    })
    .eq('id', companyId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/settings')
}

// Владелец сам заводит новый бренд (без нового пользователя): компания + членство, затем возврат в настройки.
export async function createOwnerBrand(formData: FormData) {
  const profile = await getProfile()
  if (profile?.role !== 'owner') throw new Error('Недостаточно прав')
  const uid = await currentUserId()

  const cleanName = ((formData.get('name') as string) || '').trim()
  const cleanSlug = ((formData.get('slug') as string) || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  if (!cleanName || !cleanSlug) throw new Error('Название и slug обязательны')

  const admin = createSupabaseAdmin()
  const { data: company, error } = await admin.from('companies').insert({ name: cleanName, slug: cleanSlug }).select('id').single()
  if (error || !company) {
    if (error && (error.message.includes('duplicate') || error.code === '23505')) throw new Error(`Slug «${cleanSlug}» уже занят`)
    throw new Error(error?.message || 'Не удалось создать бренд')
  }
  const { error: mErr } = await admin.from('company_members').insert({ user_id: uid, company_id: company.id })
  if (mErr) throw new Error(mErr.message)

  revalidatePath('/admin/settings')
  redirect('/admin/settings')
}
