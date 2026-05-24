import AdminHeader from './admin-header'
import { getProfile } from '@/lib/get-profile'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()
  const isAdmin = profile?.role === 'admin'
  const email = profile?.email ?? ''

  return (
    <div>
      <AdminHeader isAdmin={isAdmin} email={email} />
      {children}
    </div>
  )
}