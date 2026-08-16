import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getClientsForRequest, getLinkedProposals, getAvailableDestinations } from '../actions'
import { getRequestDestinations } from '../destinations-actions'
import { getBookingsForRequest } from '@/app/admin/bookings/actions'
import { getUiLang, getProfile } from '@/lib/get-profile'
import { tr } from '@/lib/i18n'
import RequestForm from './request-form'
import EntityTasks from '@/app/admin/_components/entity-tasks'

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lang = await getUiLang()
  const profile = await getProfile()
  const supabase = await createSupabaseServer()

  const { data: request, error } = await supabase
    .from('requests')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !request) notFound()

  const clients = await getClientsForRequest()
  const destinations = await getRequestDestinations(id)
  const linked = await getLinkedProposals(id)
  const availableDestinations = await getAvailableDestinations()
  const bookings = await getBookingsForRequest(id)

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/admin/requests" style={{ fontSize: '13px', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
          ← {tr(lang, 'Requests', 'Заявки')}
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '8px 0 0', letterSpacing: '-0.01em' }}>
          {request.request_code || tr(lang, 'Request', 'Заявка')}
        </h1>
      </div>

      <RequestForm request={request} clients={clients} destinations={destinations} linked={linked} availableDestinations={availableDestinations} bookings={bookings} />

      <EntityTasks entityType="request" entityId={id} currentUserId={profile?.id || ''} />
    </div>
  )
}