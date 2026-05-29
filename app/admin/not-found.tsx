import Link from 'next/link'

export default function AdminNotFound() {
  return (
    <div style={{
      padding: '80px 40px',
      fontFamily: 'system-ui',
      maxWidth: '720px',
      margin: '0 auto',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: '12px',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: '#555',
        marginBottom: '12px',
      }}>
        404
      </div>
      <h1 style={{
        fontSize: '24px',
        fontWeight: 500,
        margin: '0 0 12px',
        color: '#E5E2DA',
        letterSpacing: '-0.01em',
      }}>
        Здесь ничего нет
      </h1>
      <p style={{
        color: '#888780',
        fontSize: '14px',
        lineHeight: 1.6,
        margin: '0 0 24px',
      }}>
        Возможно, ссылка устарела или у вас нет доступа к этой странице.
      </p>
      <Link
        href="/admin"
        style={{
          display: 'inline-block',
          padding: '10px 18px',
          fontSize: '13px',
          fontWeight: 500,
          background: '#FAF8F4',
          color: '#2C2C2A',
          border: 'none',
          borderRadius: '8px',
          textDecoration: 'none',
          fontFamily: 'inherit',
        }}
      >
        ← На главную
      </Link>
    </div>
  )
}