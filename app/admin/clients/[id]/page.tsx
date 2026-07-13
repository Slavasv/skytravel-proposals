import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getTravellers, getClientProposals, getClientVouchers } from '../actions'
import ClientForm from './client-form'

type Params = { id: string }

export default async function ClientPage({ params }: { params: Promise<Params> }) {
  const { id } = await params
  const supabase = await createSupabaseServer()

  const { data: client, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !client) notFound()

  const travellers = await getTravellers(id)
  const proposals = await getClientProposals(id)
  const vouchers = await getClientVouchers(id)

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/admin/clients" style={{ fontSize: '13px', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
          ← Clients
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '8px 0 0', letterSpacing: '-0.01em' }}>
          {client.name || 'Untitled client'}
        </h1>
        {client.client_code && (
          <p style={{ color: 'var(--admin-text-muted)', margin: '4px 0 0', fontSize: '13px' }}>
            {client.client_code}
          </p>
        )}
      </div>

      <ClientForm client={client} travellers={travellers} proposals={proposals} vouchers={vouchers} />
    </div>
  )
}