import AdminHeader from './admin-header'
import { getProfile, canManageBrand } from '@/lib/get-profile'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()
  const isAdmin = canManageBrand(profile?.role)
  const email = profile?.email ?? ''
  const companyName = profile?.company_name ?? null

  return (
    <div>
      <AdminHeader isAdmin={isAdmin} email={email} companyName={companyName} />
      {children}
    </div>
  )
}