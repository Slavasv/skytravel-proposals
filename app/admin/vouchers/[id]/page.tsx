import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import VoucherForm from './voucher-form'
import { getHotels, getClientOptions } from './voucher-actions'
import { syncVoucherFromBooking } from '@/app/admin/bookings/actions'
import { tr } from '@/lib/i18n'
import { getUiLang } from '@/lib/get-profile'

// парсинг ДД/ММ/ГГГГ (или ДД.ММ.ГГГГ) → Date | null
function parseDMY(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = s.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (!m) return null
  const d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10)
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

export default async function EditVoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const lang = await getUiLang()
  const supabase = await createSupabaseServer()

  const { data: voucher, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !voucher) {
    notFound()
  }

  // подтягиваем актуальное из брони: название отеля, conf#, даты, ночи, гости
  if (voucher.booking_id) {
    await syncVoucherFromBooking(voucher.id)
  }

  const hotels = await getHotels(voucher.id)
  const clients = await getClientOptions()

  // последний check-out (для расчёта возраста детей)
  let lastCheckout: string | null = null
  let lastDate: Date | null = null
  for (const h of hotels) {
    const d = parseDMY(h.check_out)
    if (d && (!lastDate || d > lastDate)) {
      lastDate = d
      lastCheckout = h.check_out
    }
  }

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginBottom: '16px' }}>
        <Link href="/admin/vouchers" style={{ color: 'var(--admin-text-muted)', textDecoration: 'none' }}>
          {tr(lang, '← Back to vouchers', '← Назад к ваучерам')}
        </Link>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          {tr(lang, 'Voucher', 'Ваучер')}
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
          {tr(lang, 'Hotel voucher (English only)', 'Гостиничный ваучер (только на английском)')}
        </p>
      </div>

      <VoucherForm voucher={voucher} hotels={hotels} lastCheckout={lastCheckout} clients={clients} />
    </div>
  )
}