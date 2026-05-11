import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default async function AdminHome() {
  const { data: proposals, error } = await supabase
    .from('proposals')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    return <div style={{ padding: '40px', color: 'red' }}>Ошибка: {error.message}</div>
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#888780', marginBottom: '8px', fontWeight: 500 }}>
        Sky Travel · Admin
      </div>
      <h1 style={{ fontSize: '24px', fontWeight: 500, marginBottom: '8px', letterSpacing: '-0.01em' }}>Proposals</h1>
      <p style={{ color: '#888780', marginBottom: '32px', fontSize: '14px' }}>
        {proposals?.length ?? 0} {proposals?.length === 1 ? 'proposal' : 'proposals'}
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {proposals?.map((p) => (
          <li key={p.id} style={{ marginBottom: '12px' }}>
            <Link
              href={`/p/${p.slug}`}
              style={{
                display: 'block',
                padding: '16px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ fontWeight: 500 }}>{p.trip_title_ru}</div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                {p.client_name} · {p.guest_count} гостей · {p.start_date} → {p.end_date}
              </div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                Slug: {p.slug} · Status: {p.status}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}