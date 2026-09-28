import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

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

// Бренды, доступные текущему пользователю (членства), с полными настройками.
// Читаем через admin-клиент (обходим RLS и кэш схемы), с фолбэком на profiles.company_id.
// НИКОГДА не бросает — при любой ошибке возвращает [], чтобы страница настроек не падала.
export async function getOwnerBrands(): Promise<OwnerBrand[]> {
  try {
    const server = await createSupabaseServer()
    const { data: { user } } = await server.auth.getUser()
    if (!user) return []

    const admin = createSupabaseAdmin()

    let ids: string[] = []
    const { data: members } = await admin.from('company_members').select('company_id').eq('user_id', user.id)
    ids = (members ?? []).map((m) => m.company_id as string)

    if (ids.length === 0) {
      const { data: me } = await admin.from('profiles').select('company_id').eq('id', user.id).single()
      if (me?.company_id) ids = [me.company_id as string]
    }
    if (ids.length === 0) return []

    const { data } = await admin.from('companies').select(BRAND_COLUMNS).in('id', ids).order('name', { ascending: true })
    return (data ?? []) as OwnerBrand[]
  } catch {
    return []
  }
}
