import { createSupabaseServer } from './supabase-server'

export type Profile = {
  id: string
  email: string
  role: 'superadmin' | 'owner' | 'admin' | 'manager'
  company_name: string | null
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, email, role, companies(name)')
    .eq('id', user.id)
    .single()

  if (!data) return null

  // companies приходит как вложенный объект (или массив) — достаём название
  const company = Array.isArray(data.companies) ? data.companies[0] : data.companies
  return {
    id: data.id,
    email: data.email,
    role: data.role,
    company_name: company?.name ?? null,
  }
}

// Админский уровень внутри бренда: owner и admin (но НЕ manager, НЕ superadmin)
export function canManageBrand(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin'
}