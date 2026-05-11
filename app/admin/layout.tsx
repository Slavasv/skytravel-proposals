import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'system-ui', minHeight: '100vh' }}>
      <header style={{
        borderBottom: '1px solid #2A2A28',
        padding: '16px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Link href="/admin" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#888780', fontWeight: 500 }}>
            Sky Travel · Admin
          </div>
        </Link>
        <nav style={{ display: 'flex', gap: '24px', fontSize: '14px' }}>
          <Link href="/admin" style={{ textDecoration: 'none', color: 'inherit' }}>
            Proposals
          </Link>
          <Link href="/admin/library" style={{ textDecoration: 'none', color: '#888780' }}>
            Library
          </Link>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}