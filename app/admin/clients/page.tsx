import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProfile } from '@/lib/get-profile'
import { createClient } from './actions'
import ClientsList, { type ClientRow } from './clients-list'

export default async function ClientsPage() {
  const profile = await getProfile()

  if (profile?.role === 'superadmin') {
    redirect('/admin/companies')
  }

  const supabase = await createSupabaseServer()

  // Клиенты — общий справочник компании: одного клиента в разное время
  // могут вести разные агенты, поэтому список видят все.
  const { data: allClients, error } = await supabase
    .from('clients')
    .select('id, name, client_code, client_type, client_status, lead_source, countries, phone, email, updated_at, owner_id, profiles(email)')
    .order('updated_at', { ascending: false })

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

        <form action={createClient}>
          <button type="submit" style={{ padding: '10px 18px', fontSize: '13px', fontWeight: 500, letterSpacing: '0.03em', background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
            + New client
          </button>
        </form>
      </div>

      <ClientsList clients={clients} showOwner={true} />
    </div>
  )
}