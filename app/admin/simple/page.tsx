import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProfile, getUiLang } from '@/lib/get-profile'
import { getActiveBrandId, getUserBrands } from '@/lib/brand-filter'
import SimpleList, { type SimpleListRow } from './simple-list'

export default async function SimplePage() {
  const profile = await getProfile()
  if (profile?.role === 'superadmin') redirect('/admin/companies')
  const lang = await getUiLang()
  const T = (en: string, ru: string) => (lang === 'ru' ? ru : en)

  const brandId = await getActiveBrandId()
  const showBrand = (await getUserBrands()).length > 1
  const supabase = await createSupabaseServer()
  let query = supabase
    .from('simple_proposals')
    .select('id, title, hotel_name, date_from, date_to, occupancy, meal, status, updated_at, simple_rooms(room_type, price, currency, sort_order), requests(request_code), clients(name), companies(name)')
    .order('updated_at', { ascending: false })
  if (brandId) query = query.eq('company_id', brandId)
  const { data, error } = await query

  if (error) {
    return <div className="page-pad-40" style={{ padding: '40px', color: 'var(--admin-danger)' }}>Ошибка: {error.message}</div>
  }
  const rows = (data ?? []) as unknown as SimpleListRow[]

  return (
    <div className="page-pad-40" style={{ padding: '40px', maxWidth: '1080px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600, margin: 0 }}>{T('Simple proposals', 'Симпл-пропозалы')}</h1>
        <p style={{ color: 'var(--admin-text-muted)', margin: '4px 0 0', fontSize: '13px' }}>
          {T('Client texts for WhatsApp — created from an offer', 'Клиентские тексты для WhatsApp — создаются из оффера')} · {rows.length}
        </p>
      </div>
      <SimpleList rows={rows} lang={lang} showBrand={showBrand} />
    </div>
  )
}
