import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BlockForm from './block-form'

export default async function EditBlockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: block, error } = await supabase
    .from('content_blocks')
    .select('*, day_blocks(count)')
    .eq('id', id)
    .single()

  if (error || !block) {
    notFound()
  }

  const usageCount = block.day_blocks?.[0]?.count ?? 0

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ fontSize: '13px', color: '#888780', marginBottom: '16px' }}>
        <Link href="/admin/library" style={{ color: '#888780', textDecoration: 'none' }}>
          ← Back to library
        </Link>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>
          {block.title_ru || 'Untitled block'}
        </h1>
        <p style={{ color: '#888780', margin: 0, fontSize: '14px' }}>
          {block.type} · {usageCount > 0 ? `used in ${usageCount} ${usageCount === 1 ? 'place' : 'places'}` : 'not used yet'}
        </p>
      </div>

      <BlockForm block={block} />
    </div>
  )
}