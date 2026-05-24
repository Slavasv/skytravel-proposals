import { createSupabaseServer } from './supabase-server'

export type Profile = {
  id: string
  email: string
  role: 'admin' | 'manager'
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('id', user.id)
    .single()

  return data ?? null
}