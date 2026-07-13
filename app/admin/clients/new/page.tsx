import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'

// Создаёт пустого клиента и сразу открывает его карточку.
// Если передан returnTo — прокидываем дальше, чтобы вернуться после Done.
export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>
}) {
  const { returnTo } = await searchParams

  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  let companyId: string | null = null
  if (user) {
    const { data: me } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()
    companyId = me?.company_id ?? null
  }

  if (!companyId) redirect('/admin/clients')

  const { data: code } = await supabase.rpc('next_client_code', { p_company_id: companyId })

  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: '',
      client_code: code ?? null,
      client_type: 'individual',
      client_status: 'new',
      countries: [],
      balance_usd: 0,
      balance_eur: 0,
      company_id: companyId,
      owner_id: user?.id ?? null,
    })
    .select()
    .single()

  if (error || !data) redirect('/admin/clients')

  const target = returnTo
    ? `/admin/clients/${data.id}?returnTo=${encodeURIComponent(returnTo)}`
    : `/admin/clients/${data.id}`

  redirect(target)
}