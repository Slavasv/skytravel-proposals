import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProfile, canManageBrand } from '@/lib/get-profile'
import { createClient } from './actions'
import ClientsList, { type ClientRow } from './clients-list'

type SearchParams = { view?: string }

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { view } = await searchParams
  const profile = await getProfile()

  if (profile?.role === 'superadmin') {
    redirect('/admin/companies')
  }

  const isAdmin = canManageBrand(profile?.role)
  const showAll = isAdmin && view === 'all'

  const supabase = await createSupabaseServer()

  let query = supabase
    .from('clients')
    .select('id, name, client_code, client_type, client_status, lead_source, countries, phone, email, updated_at, owner_id, profiles(email)')
    .order('updated_at', { ascending: false })

  if (isAdmin && !showAll) {
    query = query.eq('owner_id', profile!.id)
  }

  const { data: allClients, error } = await query

  if (error) {
    return <div style={{ padding: '40px', color: 'red' }}>Error: {error.message}</div>
  }

  const clients = (allClients ?? []) as ClientRow[]

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Clients</h1>
          <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
            {clients.length} {clients.length === 1 ? 'client' : 'clients'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '2px', background: 'var(--admin-border-card)', borderRadius: '8px', padding: '3px' }}>
              <a href="/admin/clients" style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 500, borderRadius: '6px', textDecoration: 'none', letterSpacing: '0.03em', background: !showAll ? 'var(--admin-text-on-dark)' : 'transparent', color: !showAll ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)' }}>My</a>
              <a href="/admin/clients?view=all" style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 500, borderRadius: '6px', textDecoration: 'none', letterSpacing: '0.03em', background: showAll ? 'var(--admin-text-on-dark)' : 'transparent', color: showAll ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)' }}>All</a>
            </div>
          )}
          <form action={createClient}>
            <button type="submit" style={{ padding: '10px 18px', fontSize: '13px', fontWeight: 500, letterSpacing: '0.03em', background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
              + New client
            </button>
          </form>
        </div>
      </div>

      <ClientsList clients={clients} showOwner={showAll} />
    </div>
  )
}