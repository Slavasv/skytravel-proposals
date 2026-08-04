import { createSupabaseServer } from './supabase-server'
import { normalizeLang, type UiLang } from './i18n'

export type Profile = {
  id: string
  email: string
  role: 'superadmin' | 'owner' | 'admin' | 'manager' | 'accountant'
  company_name: string | null
  ui_language: UiLang
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, email, role, ui_language, companies(name)')
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
    ui_language: normalizeLang(data.ui_language),
  }
}

// Язык интерфейса текущего пользователя (для серверных компонентов). По умолчанию 'en'.
export async function getUiLang(): Promise<UiLang> {
  const profile = await getProfile()
  return profile?.ui_language ?? 'en'
}

// Админский уровень внутри бренда: owner и admin (но НЕ manager, НЕ superadmin)
export function canManageBrand(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin'
}

// Доступ к кабинету бухгалтера: owner, admin и бухгалтер
export function canSeeAccounting(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'accountant'
}