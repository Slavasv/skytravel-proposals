import { notFound } from 'next/navigation'
import { getProfile } from '@/lib/get-profile'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import UserRow from './user-row'
import CreateUserForm from './create-user-form'

export default async function UsersPage() {
  const profile = await getProfile()

  if (profile?.role !== 'admin') {
    notFound()
  }

  const adminClient = createSupabaseAdmin()
  const { data: { users }, error } = await adminClient.auth.admin.listUsers()

  if (error) {
    return <div style={{ padding: '40px', color: 'red' }}>Ошибка: {error.message}</div>
  }

  const { data: profiles } = await adminClient
    .from('profiles')
    .select('id, email, role, created_at')

  const { data: proposals } = await adminClient
    .from('proposals')
    .select('owner_id')

  const proposalCounts: Record<string, number> = {}
  for (const p of proposals ?? []) {
    if (p.owner_id) {
      proposalCounts[p.owner_id] = (proposalCounts[p.owner_id] ?? 0) + 1
    }
  }

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  const enriched = users.map((u) => ({
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
          Users
        </h1>
        <p style={{ color: '#888780', margin: 0, fontSize: '14px' }}>
          {enriched.length} {enriched.length === 1 ? 'user' : 'users'}
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