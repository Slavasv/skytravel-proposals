import AdminHeader from './admin-header'
import TaskFab from './_components/task-fab'
import { getProfile, canManageBrand } from '@/lib/get-profile'
import { LangProvider } from '@/lib/i18n-client'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile()
  const isAdmin = canManageBrand(profile?.role)
  const email = profile?.email ?? ''
  const companyName = profile?.company_name ?? null
  const isSuperadmin = profile?.role === 'superadmin'
  const isAccountant = profile?.role === 'accountant'
  const lang = profile?.ui_language ?? 'en'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--admin-bg)', color: 'var(--admin-text)' }}>
      <LangProvider lang={lang}>
        <AdminHeader isAdmin={isAdmin} email={email} companyName={companyName} isSuperadmin={isSuperadmin} isAccountant={isAccountant} />
        {children}
        {!isSuperadmin && !isAccountant && <TaskFab />}
      </LangProvider>
    </div>
  )
}