import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/get-profile'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import CreateBrandForm from './create-brand-form'

export default async function CompaniesPage() {
  const profile = await getProfile()

  // Только superadmin
  if (profile?.role !== 'superadmin') {
    notFound()
  }

  // Список всех компаний (через admin-клиент, superadmin видит все)
  const admin = createSupabaseAdmin()
  const { data: companies } = await admin
    .from('companies')
    .select('id, name, slug, is_active, created_at')
    .order('created_at', { ascending: true })

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          Компании
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
          {companies?.length ?? 0} {(companies?.length ?? 0) === 1 ? 'бренд' : 'брендов'}
        </p>
      </div>

      <CreateBrandForm />

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {(companies ?? []).map((c) => (
          <li key={c.id} style={{
            padding: '16px',
            border: '1px solid var(--admin-border-card)',
            borderRadius: '8px',
            background: 'transparent',
          }}>
            <div style={{ fontWeight: 500, color: 'var(--admin-text)' }}>{c.name}</div>
            <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginTop: '4px' }}>
              slug: {c.slug}{!c.is_active && ' · архив'}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}