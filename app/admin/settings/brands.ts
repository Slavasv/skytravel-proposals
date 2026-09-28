import { createSupabaseServer } from '@/lib/supabase-server'

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

// Бренды владельца: гарантированно основной (profiles.company_id) + бренды из членств.
// Обычный серверный клиент (проверенный путь). Никогда не бросает — на ошибке [].
export async function getOwnerBrands(): Promise<OwnerBrand[]> {
  try {
    const server = await createSupabaseServer()
    const { data: { user } } = await server.auth.getUser()
    if (!user) return []

    const ids = new Set<string>()

    // основной бренд (как в старых настройках — проверенный путь)
    const { data: me } = await server.from('profiles').select('company_id').eq('id', user.id).single()
    if (me?.company_id) ids.add(me.company_id as string)

    // дополнительные бренды из членств (best-effort — не ломаем основной)
    try {
      const { data: members } = await server.from('company_members').select('company_id').eq('user_id', user.id)
      for (const m of members ?? []) if (m.company_id) ids.add(m.company_id as string)
    } catch { /* ignore */ }

    if (ids.size === 0) return []

    const { data } = await server.from('companies').select(BRAND_COLUMNS).in('id', [...ids]).order('name', { ascending: true })
    return (data ?? []) as OwnerBrand[]
  } catch {
    return []
  }
}
