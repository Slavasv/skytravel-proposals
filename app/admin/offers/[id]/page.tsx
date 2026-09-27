import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase-server'
import OfferEditor from './offer-editor'

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServer()

  const { data: offer, error } = await supabase
    .from('admin_offers')
    .select('*, offer_rooms(*, offer_room_quotes(*))')
    .eq('id', id)
    .single()

  if (error || !offer) notFound()

  const { data: partners } = await supabase
    .from('partners')
    .select('id, name')
    .order('name', { ascending: true })

  return (
    <div className="page-pad-40" style={{ padding: '40px', maxWidth: '1080px', margin: '0 auto' }}>
      <div style={{ marginBottom: '18px' }}>
        <Link href="/admin/offers" style={{ fontSize: '13px', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>← Офферы</Link>
      </div>
      <OfferEditor offer={offer} partners={(partners ?? []) as { id: string; name: string }[]} />
    </div>
  )
}
