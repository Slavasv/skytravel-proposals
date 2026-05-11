import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ProposalForm from './proposal-form'
import ProposalActions from './proposal-actions'

export default async function EditProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !proposal) {
    notFound()
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ fontSize: '13px', color: '#888780', marginBottom: '16px' }}>
        <Link href="/admin" style={{ color: '#888780', textDecoration: 'none' }}>
          ← Back to proposals
        </Link>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          {proposal.trip_title_ru || 'Untitled proposal'}
        </h1>
        <p style={{ color: '#888780', margin: 0, fontSize: '14px' }}>
          For {proposal.client_name || 'unknown client'}
        </p>
      </div>

      <ProposalForm proposal={proposal} actions={<ProposalActions slug={proposal.slug} />} />
    </div>
  )
}