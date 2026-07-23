import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getBookingServices, getPartnerOptions, getClientsForBooking } from '../actions'
import BookingForm from './booking-form'

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServer()

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !booking) notFound()

  const services = await getBookingServices(id)
  const partners = await getPartnerOptions()
  const clients = await getClientsForBooking()

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <Link href="/admin/bookings" style={{ fontSize: '13px', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
          ← Bookings
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '8px 0 0', letterSpacing: '-0.01em' }}>
          {booking.booking_code || 'Booking'}
        </h1>
      </div>

      <BookingForm booking={booking} services={services} partners={partners} clients={clients} />
    </div>
  )
}

