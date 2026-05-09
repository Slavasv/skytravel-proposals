import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data: proposals, error } = await supabase
    .from('proposals')
    .select('*')

  if (error) {
    return <div style={{ padding: '40px', color: 'red' }}>Ошибка: {error.message}</div>
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 500, marginBottom: '8px' }}>Sky Travel · Proposals</h1>
      <p style={{ color: '#666', marginBottom: '24px', fontSize: '14px' }}>
        Найдено предложений: {proposals?.length ?? 0}
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
              <div style={{ fontWeight: 500 }}>{p.trip_title}</div>
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