import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import DestinationForm from './destination-form'
import { getSections } from './destination-actions'

export default async function EditDestinationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createSupabaseServer()

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .eq('kind', 'destination')
    .single()

  if (error || !proposal) {
    notFound()
  }

  const sections = await getSections(proposal.id)

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginBottom: '16px' }}>
        <Link href="/admin/destinations" style={{ color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
          ← Back to destinations
        </Link>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          {proposal.trip_title_ru || 'Untitled destination'}
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
          Destination showcase
        </p>
      </div>

      <DestinationForm proposal={proposal} sections={sections} />
    </div>
  )
}