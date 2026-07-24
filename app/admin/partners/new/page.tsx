import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'

export default async function NewPartnerPage({
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
      .from('profiles').select('company_id').eq('id', user.id).single()
    companyId = me?.company_id ?? null
  }

  if (!companyId) redirect('/admin/partners')

  const { data, error } = await supabase
    .from('partners')
    .insert({
      name: '',
      service_type: 'Accomodation',
      company_id: companyId,
      owner_id: user?.id ?? null,
    })
    .select().single()

  if (error || !data) redirect('/admin/partners')

  const target = returnTo
    ? `/admin/partners/${data.id}?returnTo=${encodeURIComponent(returnTo)}`
    : `/admin/partners/${data.id}`

  redirect(target)
}