import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProfile } from '@/lib/get-profile'
import { getActiveBrandId, getUserBrands } from '@/lib/brand-filter'
import { createPartner } from './actions'
import PartnersList, { type PartnerRow } from './partners-list'

export default async function PartnersPage() {
  const profile = await getProfile()

  if (profile?.role === 'superadmin') {
    redirect('/admin/companies')
  }

  const brandId = await getActiveBrandId()
  const showBrand = (await getUserBrands()).length > 1
  const supabase = await createSupabaseServer()

  let query = supabase
    .from('partners')
    .select('id, name, service_type, destination, operator_group, updated_at, companies(name)')
    .order('name', { ascending: true })
  if (brandId) query = query.eq('company_id', brandId)
  const { data: allPartners, error } = await query

  if (error) {
    return <div style={{ padding: '40px', color: 'red' }}>Error: {error.message}</div>
  }

  const partners = (allPartners ?? []) as PartnerRow[]

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Partners</h1>
          <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
            {partners.length} {partners.length === 1 ? 'partner' : 'partners'}
          </p>
        </div>

        <form action={createPartner}>
          <button type="submit" style={{ padding: '10px 18px', fontSize: '13px', fontWeight: 500, letterSpacing: '0.03em', background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
            + New partner
          </button>
        </form>
      </div>

      <PartnersList partners={partners} showBrand={showBrand} />
    </div>
  )
}