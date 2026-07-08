import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { type Hotel } from './templates/shared'
import Design1 from './templates/design-1'
import Design2 from './templates/design-2'

type Params = { slug: string }

export default async function VoucherPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ print?: string }> }) {
  const { slug } = await params
  const { print } = await searchParams
  const isPrint = print === '1'

  const { data: voucher, error } = await supabase.from('vouchers').select('*').eq('slug', slug).single()
  if (error || !voucher) notFound()

  const { data: company } = await supabase
    .from('companies')
    .select('name, logo_url, accent_color, tagline, greeting_message, contact_email, contact_phone, website_url, office_address, footer_note, voucher_template')
    .eq('id', voucher.company_id).single()

  const { data: hotelsRaw } = await supabase
    .from('voucher_hotels').select('*').eq('voucher_id', voucher.id).order('sort_order', { ascending: true })

  const hotelsData = (hotelsRaw ?? []) as Hotel[]

  // выбор дизайна ваучера по бренду (номер шаблона); дефолт — 1 (текущий кремовый)
  const template = company?.voucher_template ?? 1

  switch (template) {
    case 2: return <Design2 voucher={voucher} company={company} hotelsData={hotelsData} isPrint={isPrint} />
    // case 3: return <Design3 voucher={voucher} company={company} hotelsData={hotelsData} isPrint={isPrint} />
    default:
      return <Design1 voucher={voucher} company={company} hotelsData={hotelsData} isPrint={isPrint} />
  }
}