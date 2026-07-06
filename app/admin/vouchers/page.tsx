import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProfile, canManageBrand } from '@/lib/get-profile'
import { createVoucher } from '../actions'

type SearchParams = { view?: string }

type VoucherRow = {
  id: string
  voucher_no: string | null
  booking_ref: string | null
  issue_date: string | null
  updated_at: string
  owner_id: string | null
}

export default async function VouchersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { view } = await searchParams
  const profile = await getProfile()

  if (profile?.role === 'superadmin') {
    redirect('/admin/companies')
  }

  const isAdmin = canManageBrand(profile?.role)
  const showAll = isAdmin && view === 'all'

  const supabase = await createSupabaseServer()

  let query = supabase
    .from('vouchers')
    .select('id, voucher_no, booking_ref, issue_date, updated_at, owner_id')
    .order('updated_at', { ascending: false })

  if (isAdmin && !showAll) {
    query = query.eq('owner_id', profile!.id)
  }

  const { data: allVouchers, error } = await query

  if (error) {
    return <div style={{ padding: '40px', color: 'red' }}>Error: {error.message}</div>
  }

  const vouchers = (allVouchers ?? []) as VoucherRow[]

  const myLinkStyle: React.CSSProperties = {
    padding: '6px 14px', fontSize: '12px', fontWeight: 500, borderRadius: '6px',
    textDecoration: 'none', letterSpacing: '0.03em',
    background: !showAll ? 'var(--admin-text-on-dark)' : 'transparent',
    color: !showAll ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)',
  }
  const allLinkStyle: React.CSSProperties = {
    padding: '6px 14px', fontSize: '12px', fontWeight: 500, borderRadius: '6px',
    textDecoration: 'none', letterSpacing: '0.03em',
    background: showAll ? 'var(--admin-text-on-dark)' : 'transparent',
    color: showAll ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)',
  }

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Vouchers</h1>
          <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
            {vouchers.length} {vouchers.length === 1 ? 'voucher' : 'vouchers'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '2px', background: 'var(--admin-border-card)', borderRadius: '8px', padding: '3px' }}>
              <a href="/admin/vouchers" style={myLinkStyle}>My</a>
              <a href="/admin/vouchers?view=all" style={allLinkStyle}>All</a>
            </div>
          )}
          <form action={createVoucher}>
            <button type="submit" style={{
              padding: '10px 18px', fontSize: '13px', fontWeight: 500, letterSpacing: '0.03em',
              background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              + New voucher
            </button>
          </form>
        </div>
      </div>

      {vouchers.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
          No vouchers yet. Click + New voucher to create one.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {vouchers.map((v) => {
            const title = v.voucher_no ? `Voucher #${v.voucher_no}` : 'Untitled voucher'
            return (
              <li key={v.id}>
                <Link href={`/admin/vouchers/${v.id}`} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 18px', border: '1px solid var(--admin-border-card)', borderRadius: '8px',
                  background: 'var(--admin-card)', textDecoration: 'none', color: 'inherit',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--admin-text)' }}>{title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                      {v.booking_ref ? `Booking ref. ${v.booking_ref}` : 'No booking ref'}
                      {v.issue_date ? ` · ${v.issue_date}` : ''}
                    </div>
                  </div>
                  <span style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>→</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}