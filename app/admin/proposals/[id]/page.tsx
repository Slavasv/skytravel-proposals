import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import EditPageClient from './edit-page-client'

export default async function EditProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createSupabaseServer()

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !proposal) {
    notFound()
  }

  const { data: days } = await supabase
    .from('days')
    .select(`
      *,
      day_blocks (
        id,
        sort_order,
        custom_note_ru,
        custom_note_en,
        content_blocks (
          id,
          type,
          title_ru,
          title_en,
          description_ru,
          description_en,
          image_url,
          location,
          tags
        )
      )
    `)
    .eq('proposal_id', proposal.id)
    .order('day_number', { ascending: true })

  const sortedDays = (days ?? []).map((day) => ({
    ...day,
    day_blocks: (day.day_blocks ?? []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    ),
  }))

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginBottom: '16px' }}>
        <Link href="/admin" style={{ color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
          ← Back to proposals
        </Link>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          {proposal.trip_title_ru || 'Untitled proposal'}
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
          For {proposal.client_name_ru || 'unknown client'}
        </p>
      </div>

      <EditPageClient proposal={proposal} days={sortedDays} />
    </div>
  )
}