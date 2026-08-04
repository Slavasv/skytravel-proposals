import { notFound } from 'next/navigation'
import { getProfile, canManageBrand } from '@/lib/get-profile'
import { tr } from '@/lib/i18n'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import UserRow from './user-row'
import CreateUserForm from './create-user-form'

export default async function UsersPage() {
  const profile = await getProfile()
  const lang = profile?.ui_language ?? 'en'

 if (!canManageBrand(profile?.role)) {
    notFound()
  }

  const adminClient = createSupabaseAdmin()

  // Находим company_id текущего админа — будем фильтровать юзеров по его компании
  const { data: meProfile } = await adminClient
    .from('profiles')
    .select('company_id')
    .eq('id', profile!.id)
    .single()

  if (!meProfile?.company_id) {
    return <div style={{ padding: '40px', color: 'var(--admin-text-muted)' }}>{tr(lang, 'Company not found.', 'Компания не найдена.')}</div>
  }

  // Грузим только профили своей компании
  const { data: profiles } = await adminClient
    .from('profiles')
    .select('id, email, role, created_at, company_id')
    .eq('company_id', meProfile.company_id)

  const ownIds = new Set((profiles ?? []).map((p) => p.id))

  // Грузим всех auth-юзеров, но оставляем только тех, кто в нашей компании
  const { data: { users }, error } = await adminClient.auth.admin.listUsers()

  if (error) {
    return <div style={{ padding: '40px', color: 'red' }}>{tr(lang, 'Error', 'Ошибка')}: {error.message}</div>
  }

  const filteredUsers = users.filter((u) => ownIds.has(u.id))

  const { data: proposals } = await adminClient
    .from('proposals')
    .select('owner_id')
    .in('owner_id', Array.from(ownIds))

  const proposalCounts: Record<string, number> = {}
  for (const p of proposals ?? []) {
    if (p.owner_id) {
      proposalCounts[p.owner_id] = (proposalCounts[p.owner_id] ?? 0) + 1
    }
  }

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  const enriched = filteredUsers.map((u) => ({
    id: u.id,
    email: u.email ?? '',
    role: profileMap[u.id]?.role ?? 'manager',
    created_at: u.created_at,
    last_sign_in: u.last_sign_in_at ?? null,
    proposal_count: proposalCounts[u.id] ?? 0,
  }))

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          {tr(lang, 'Users', 'Пользователи')}
        </h1>
        <p style={{ color: 'var(--admin-text-muted)', margin: 0, fontSize: '14px' }}>
          {enriched.length} {enriched.length === 1 ? tr(lang, 'user', 'пользователь') : tr(lang, 'users', 'пользователей')}
        </p>
      </div>

      <CreateUserForm />

      <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {enriched.map((u) => (
          <UserRow key={u.id} user={u} currentUserId={profile!.id} />
        ))}
      </div>
    </div>
  )
}