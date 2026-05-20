import { supabase } from '@/lib/supabase'
import { createProposal } from './actions'
import ProposalCard from './proposal-card'
import StatusFilter from './status-filter'

type SearchParams = { status?: string }

export default async function AdminHome({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { status } = await searchParams
  const activeStatus = status ?? null

  const { data: allProposals, error } = await supabase
    .from('proposals')
    .select('*')
    .order('updated_at', { ascending: false })

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

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Proposals</h1>
          <p style={{ color: '#888780', margin: 0, fontSize: '14px' }}>
            {proposals.length} {proposals.length === 1 ? 'proposal' : 'proposals'}
            {activeStatus && ` · filtered by ${activeStatus}`}
          </p>
        </div>
        <form action={createProposal}>
          <button
            type="submit"
            style={{
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 500,
              letterSpacing: '0.03em',
              background: '#FAF8F4',
              color: '#2C2C2A',
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

      <StatusFilter current={activeStatus} counts={counts} />

      {proposals.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#888780', border: '1px dashed #555', borderRadius: '8px', fontSize: '14px' }}>
          {activeStatus
            ? `No proposals with status "${activeStatus}".`
            : 'No proposals yet. Click + New proposal to create one.'}
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} />
          ))}
        </ul>
      )}
    </div>
  )
}