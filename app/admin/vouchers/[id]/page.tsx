import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import VoucherForm from './voucher-form'
import { getHotels } from './voucher-actions'

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
  const supabase = await createSupabaseServer()

  const { data: voucher, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !voucher) {
    notFound()
  }

  const hotels = await getHotels(voucher.id)

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
          ← Back to vouchers
        </Link>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          {voucher.voucher_no ? `Voucher #${voucher.voucher_no}` : 'New voucher'}
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
          Hotel voucher (English only)
        </p>
      </div>

      <VoucherForm voucher={voucher} hotels={hotels} lastCheckout={lastCheckout} />
    </div>
  )
}