import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import VoucherForm from './voucher-form'

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

      <VoucherForm voucher={voucher} />
    </div>
  )
}