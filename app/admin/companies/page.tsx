import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/get-profile'
import { tr } from '@/lib/i18n'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import CreateBrandForm from './create-brand-form'
import CompaniesManager, { type CompanyRow } from './companies-manager'

export default async function CompaniesPage() {
  const profile = await getProfile()
  const lang = profile?.ui_language ?? 'en'

  // Только superadmin
  if (profile?.role !== 'superadmin') {
    notFound()
  }

  const admin = createSupabaseAdmin()

  const { data: companies } = await admin
    .from('companies')
    .select('id, name, slug, is_active, created_at')
    .order('created_at', { ascending: true })

  // профили (для владельца и счётчика сотрудников) + auth-юзеры (для email-логина)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, company_id, role, created_at')

  const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const emailById = new Map<string, string>()
  for (const u of authList?.users ?? []) emailById.set(u.id, u.email ?? '')

  const rows: CompanyRow[] = (companies ?? []).map((c) => {
    const members = (profiles ?? []).filter((p) => p.company_id === c.id)
    const owner =
      members.find((p) => p.role === 'owner') ??
      [...members].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))[0]
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      is_active: c.is_active,
      ownerEmail: owner ? (emailById.get(owner.id) || '') : '',
      userCount: members.length,
    }
  })

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          {tr(lang, 'Companies', 'Компании')}
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
          {rows.length} {rows.length === 1 ? tr(lang, 'brand', 'бренд') : tr(lang, 'brands', 'брендов')}
        </p>
      </div>

      <CreateBrandForm />

      <CompaniesManager companies={rows} />
    </div>
  )
}
