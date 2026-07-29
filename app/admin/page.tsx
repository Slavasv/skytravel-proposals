import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProfile, canManageBrand } from '@/lib/get-profile'
import { createProposal } from './actions'
import ProposalCard from './proposal-card'
import StatusFilter from './status-filter'

type SearchParams = { status?: string; view?: string }

export default async function AdminHome({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { status, view } = await searchParams
  const activeStatus = status ?? null

  const profile = await getProfile()

  // Superadmin не работает с proposals — его место в кабинете компаний
  if (profile?.role === 'superadmin') {
    redirect('/admin/companies')
  }

  // Бухгалтер видит только финансы — сразу в кабинет
  if (profile?.role === 'accountant') {
    redirect('/admin/accounting')
  }

  const isAdmin = canManageBrand(profile?.role)
  const showAll = isAdmin && view === 'all'

  const supabase = await createSupabaseServer()

  let query = supabase
    .from('proposals')
    .select('*, profiles(email)')
    .eq('kind', 'individual')
    .order('updated_at', { ascending: false })

  if (isAdmin && !showAll) {
    query = query.eq('owner_id', profile!.id)
  }

  const { data: allProposals, error } = await query

  if (error) {
    return <div style={{ padding: '40px', color: 'red' }}>Ошибка: {error.message}</div>
  }

  const counts: Record<string, number> = {}
  for (const p of allProposals ?? []) {
    const s = p.status || 'draft'
    counts[s] = (counts[s] ?? 0) + 1
  }

  const proposals = activeStatus
    ? (allProposals ?? []).filter((p) => p.status === activeStatus)
    : allProposals ?? []

  const myLinkStyle: React.CSSProperties = {
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 500,
    borderRadius: '6px',
    textDecoration: 'none',
    letterSpacing: '0.03em',
    background: !showAll ? 'var(--admin-text-on-dark)' : 'transparent',
    color: !showAll ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)',
  }

  const allLinkStyle: React.CSSProperties = {
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 500,
    borderRadius: '6px',
    textDecoration: 'none',
    letterSpacing: '0.03em',
    background: showAll ? 'var(--admin-text-on-dark)' : 'transparent',
    color: showAll ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)',
  }

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            Proposals
          </h1>
          <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
            {proposals.length} {proposals.length === 1 ? 'proposal' : 'proposals'}
            {activeStatus && ` · filtered by ${activeStatus}`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '2px', background: 'var(--admin-border-card)', borderRadius: '8px', padding: '3px' }}>
              <a href="/admin" style={myLinkStyle}>My</a>
              <a href="/admin?view=all" style={allLinkStyle}>All</a>
            </div>
          )}

          <form action={createProposal}>
            <button
              type="submit"
              style={{
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: 500,
                letterSpacing: '0.03em',
                background: 'var(--admin-text-on-dark)',
                color: 'var(--admin-dark-panel)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              + New proposal
            </button>
          </form>
        </div>
      </div>

      <StatusFilter current={activeStatus} counts={counts} />

      {proposals.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
          {activeStatus
            ? `No proposals with status "${activeStatus}".`
            : 'No proposals yet. Click + New proposal to create one.'}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {proposals.map((p) => {
            const ownerEmail = Array.isArray(p.profiles)
              ? p.profiles[0]?.email
              : (p.profiles as { email: string } | null)?.email
            return (
              <ProposalCard
                key={p.id}
                proposal={{ ...p, owner_email: ownerEmail ?? null }}
                showOwner={showAll}
              />
            )
          })}
        </ul>
      )}
    </div>
  )
}