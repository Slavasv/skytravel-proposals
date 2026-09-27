'use server'

import { getProfile } from '@/lib/get-profile'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

const BRAND_COLUMNS = 'id, name, slug, logo_url, accent_color, contact_email, contact_phone, website_url, office_address, tagline, greeting_message, footer_note, socials, voucher_template, voucher_bg_url'

export type OwnerBrand = {
  id: string
  name: string | null
  slug: string | null
  logo_url: string | null
  accent_color: string | null
  contact_email: string | null
  contact_phone: string | null
  website_url: string | null
  office_address: string | null
  tagline: string | null
  greeting_message: string | null
  footer_note: string | null
  socials: Record<string, string> | null
  voucher_template: number | null
  voucher_bg_url: string | null
}

// Бренды, к которым у текущего пользователя есть доступ (членства), с полными настройками.
// Фолбэк: если членств нет — основной бренд из profiles.company_id.
export async function getOwnerBrands(): Promise<OwnerBrand[]> {
  const server = await createSupabaseServer()
  const { data: { user } } = await server.auth.getUser()
  if (!user) return []

  const { data: members } = await server
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)

  let ids = (members ?? []).map((m) => m.company_id as string)
  if (ids.length === 0) {
    const { data: me } = await server.from('profiles').select('company_id').eq('id', user.id).single()
    if (me?.company_id) ids = [me.company_id]
  }
  if (ids.length === 0) return []

  const { data } = await server.from('companies').select(BRAND_COLUMNS).in('id', ids).order('name', { ascending: true })
  return (data ?? []) as OwnerBrand[]
}

async function assertOwnerMember(companyId: string): Promise<void> {
  const profile = await getProfile()
  if (profile?.role !== 'owner') throw new Error('Недостаточно прав')
  const server = await createSupabaseServer()
  const { data: { user } } = await server.auth.getUser()
  if (!user) throw new Error('Не авторизован')
  // членство ИЛИ основной бренд из профиля
  const { data: m } = await server.from('company_members').select('company_id').eq('user_id', user.id).eq('company_id', companyId).maybeSingle()
  if (m) return
  const { data: me } = await server.from('profiles').select('company_id').eq('id', user.id).single()
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

// Владелец сам заводит новый бренд в своём аккаунте (без нового пользователя).
// Создаёт компанию и членство текущего владельца в ней.
export async function createOwnerBrand(name: string, slug: string): Promise<{ id: string }> {
  const profile = await getProfile()
  if (profile?.role !== 'owner') throw new Error('Недостаточно прав')

  const server = await createSupabaseServer()
  const { data: { user } } = await server.auth.getUser()
  if (!user) throw new Error('Не авторизован')

  const cleanName = name.trim()
  const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  if (!cleanName || !cleanSlug) throw new Error('Название и slug обязательны')

  const admin = createSupabaseAdmin()
  const { data: company, error } = await admin
    .from('companies')
    .insert({ name: cleanName, slug: cleanSlug })
    .select('id')
    .single()
  if (error || !company) {
    if (error && (error.message.includes('duplicate') || error.code === '23505')) throw new Error(`Slug «${cleanSlug}» уже занят`)
    throw new Error(error?.message || 'Не удалось создать бренд')
  }

  const { error: mErr } = await admin.from('company_members').insert({ user_id: user.id, company_id: company.id })
  if (mErr) throw new Error(mErr.message)

  revalidatePath('/admin/settings')
  return { id: company.id }
}
