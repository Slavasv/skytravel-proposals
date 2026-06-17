import AdminHeader from './admin-header'
import { getProfile, canManageBrand } from '@/lib/get-profile'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()
  const isAdmin = canManageBrand(profile?.role)
  const email = profile?.email ?? ''
  const companyName = profile?.company_name ?? null
  const isSuperadmin = profile?.role === 'superadmin'

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', color: '#E5E2DA' }}>
      <AdminHeader isAdmin={isAdmin} email={email} companyName={companyName} isSuperadmin={isSuperadmin} />
      {children}
    </div>
  )
}