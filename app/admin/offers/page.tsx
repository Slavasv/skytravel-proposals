import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProfile } from '@/lib/get-profile'
import { createOffer } from './actions'
import OffersList, { type OfferListRow } from './offers-list'

export default async function OffersPage() {
  const profile = await getProfile()
  if (profile?.role === 'superadmin') redirect('/admin/companies')

  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('admin_offers')
    .select('id, title, hotel_name, date_from, date_to, occupancy, meal, status, updated_at, offer_rooms(room_type, sale_price, sale_currency, is_recommended, sort_order), requests(request_code), clients(name)')
    .order('updated_at', { ascending: false })

  if (error) {
    return <div className="page-pad-40" style={{ padding: '40px', color: 'var(--admin-danger)' }}>Ошибка: {error.message}</div>
  }

  const rows = (data ?? []) as unknown as OfferListRow[]

  return (
    <div className="page-pad-40" style={{ padding: '40px', maxWidth: '1080px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, margin: 0 }}>Офферы</h1>
          <p style={{ color: 'var(--admin-text-muted)', margin: '4px 0 0', fontSize: '13px' }}>
            Внутренние офферы со сравнением цен · {rows.length}
          </p>
        </div>
        <form action={createOffer}>
          <button type="submit" style={{ padding: '10px 18px', fontSize: '13px', fontWeight: 600, background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '9px', cursor: 'pointer', fontFamily: 'inherit' }}>
            + Новый оффер
          </button>
        </form>
      </div>
      <OffersList rows={rows} />
    </div>
  )
}
