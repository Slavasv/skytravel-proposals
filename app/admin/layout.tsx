import AdminHeader from './admin-header'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AdminHeader />
      {children}
    </div>
  )
}