import { cookies } from 'next/headers'
import { createSupabaseServer } from './supabase-server'

export const BRAND_COOKIE = 'brand_filter'

export type BrandLite = { id: string; name: string }

// Бренды текущего пользователя: основной (profiles.company_id) + из членств.
export async function getUserBrands(): Promise<BrandLite[]> {
  try {
    const server = await createSupabaseServer()
    const { data: { user } } = await server.auth.getUser()
    if (!user) return []
    const ids = new Set<string>()
    const { data: me } = await server.from('profiles').select('company_id').eq('id', user.id).single()
    if (me?.company_id) ids.add(me.company_id as string)
    try {
      const { data: members } = await server.from('company_members').select('company_id').eq('user_id', user.id)
      for (const m of members ?? []) if (m.company_id) ids.add(m.company_id as string)
    } catch { /* ignore */ }
    if (ids.size === 0) return []
    const { data } = await server.from('companies').select('id, name').in('id', [...ids]).order('name', { ascending: true })
    return (data ?? []).map((c) => ({ id: c.id as string, name: (c.name as string) || '—' }))
  } catch {
    return []
  }
}

// Контекст бренда: список брендов + активный фильтр (или null = «Все бренды»).
export async function getBrandContext(): Promise<{ brands: BrandLite[]; activeId: string | null; multi: boolean }> {
  const brands = await getUserBrands()
  let activeId: string | null = null
  try {
    const c = (await cookies()).get(BRAND_COOKIE)?.value
    if (c && c !== 'all' && brands.some((b) => b.id === c)) activeId = c
  } catch { /* ignore */ }
  return { brands, activeId, multi: brands.length > 1 }
}

// Только активный бренд-фильтр (для запросов списков). null = все бренды.
export async function getActiveBrandId(): Promise<string | null> {
  return (await getBrandContext()).activeId
}

// К какому бренду отнести создаваемое: активный бренд, иначе основной, иначе первый доступный.
export async function resolveCreateCompanyId(): Promise<string | null> {
  const { brands, activeId } = await getBrandContext()
  if (activeId) return activeId
  try {
    const server = await createSupabaseServer()
    const { data: { user } } = await server.auth.getUser()
    if (user) {
      const { data: me } = await server.from('profiles').select('company_id').eq('id', user.id).single()
      if (me?.company_id) return me.company_id as string
    }
  } catch { /* ignore */ }
  return brands[0]?.id ?? null
}
