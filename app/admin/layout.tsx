import AdminSidebar from './admin-sidebar'
import TaskFab from './_components/task-fab'
import VersionWatcher from './version-watcher'
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
    <LangProvider lang={lang}>
      <div className="admin-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--admin-bg)', color: 'var(--admin-text)' }}>
        <VersionWatcher />
        <AdminSidebar isAdmin={isAdmin} email={email} companyName={companyName} isSuperadmin={isSuperadmin} isAccountant={isAccountant} />
        <main className="admin-main" style={{ flex: 1, minWidth: 0 }}>
          {children}
        </main>
        {!isSuperadmin && !isAccountant && <TaskFab />}
      </div>
    </LangProvider>
  )
}
