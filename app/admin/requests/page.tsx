import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProfile, canManageBrand } from '@/lib/get-profile'
import { createRequest } from './actions'
import { getDestinationsSummary } from './destinations-actions'
import RequestsList, { type RequestRow } from './requests-list'

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams
  const profile = await getProfile()

  if (profile?.role === 'superadmin') redirect('/admin/companies')

  const isAdmin = canManageBrand(profile?.role)
  const showAll = isAdmin && view === 'all'

  const supabase = await createSupabaseServer()

  let query = supabase
    .from('requests')
    .select('id, request_code, destination, details, status, priority, created_at, closed_at, owner_id, clients(name, client_code), profiles(email)')
    .order('created_at', { ascending: false })

  if (isAdmin && !showAll) {
    query = query.eq('owner_id', profile!.id)
  }

  const { data, error } = await query

  if (error) return <div style={{ padding: '40px', color: 'red' }}>Error: {error.message}</div>

  const requests = (data ?? []) as RequestRow[]
  const destSummary = await getDestinationsSummary(requests.map((r) => r.id))

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Requests</h1>
          <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
            {requests.length} {requests.length === 1 ? 'request' : 'requests'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '2px', background: 'var(--admin-border-card)', borderRadius: '8px', padding: '3px' }}>
              <a href="/admin/requests" style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 500, borderRadius: '6px', textDecoration: 'none', letterSpacing: '0.03em', background: !showAll ? 'var(--admin-text-on-dark)' : 'transparent', color: !showAll ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)' }}>My</a>
              <a href="/admin/requests?view=all" style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 500, borderRadius: '6px', textDecoration: 'none', letterSpacing: '0.03em', background: showAll ? 'var(--admin-text-on-dark)' : 'transparent', color: showAll ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)' }}>All</a>
            </div>
          )}
          <form action={createRequest}>
            <button type="submit" style={{ padding: '10px 18px', fontSize: '13px', fontWeight: 500, letterSpacing: '0.03em', background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
              + New request
            </button>
          </form>
        </div>
      </div>

      <RequestsList requests={requests} showOwner={showAll} destSummary={destSummary} />
    </div>
  )
}