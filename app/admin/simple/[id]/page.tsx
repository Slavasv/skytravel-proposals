import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getUiLang } from '@/lib/get-profile'
import SimpleEditor from './simple-editor'

export default async function SimpleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const lang = await getUiLang()

  const { data: simple, error } = await supabase
    .from('simple_proposals')
    .select('*, simple_rooms(*)')
    .eq('id', id)
    .single()
  if (error || !simple) notFound()

  const { data: hotelBlocks } = await supabase
    .from('content_blocks')
    .select('id, title_ru, title_en, link_url, rooms')
    .eq('type', 'hotel')
    .order('title_ru', { ascending: true })

  type HRoom = { title_ru?: string | null; title_en?: string | null }
  const hotels = (hotelBlocks ?? []).map((h: { title_ru: string | null; title_en: string | null; link_url: string | null; rooms: HRoom[] | null }) => ({
    name: (h.title_ru || h.title_en || '').trim(),
    link: h.link_url || '',
    rooms: Array.isArray(h.rooms) ? h.rooms.map((r) => ({ ru: (r.title_ru || '').trim(), en: (r.title_en || '').trim() })).filter((r) => r.ru || r.en) : [],
  })).filter((h) => h.name)

  return (
    <div className="page-pad-40" style={{ padding: '40px', maxWidth: '1080px', margin: '0 auto' }}>
      <div style={{ marginBottom: '18px', display: 'flex', gap: '14px', alignItems: 'center' }}>
        <Link href="/admin/simple" style={{ fontSize: '13px', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>← {lang === 'ru' ? 'Симпл-пропозалы' : 'Simple proposals'}</Link>
        {simple.source_offer_id && (
          <Link href={`/admin/offers/${simple.source_offer_id}`} style={{ fontSize: '13px', color: 'var(--admin-accent)', textDecoration: 'none' }}>
            {lang === 'ru' ? 'Открыть оффер →' : 'Open offer →'}
          </Link>
        )}
      </div>
      <SimpleEditor simple={simple} hotels={hotels} />
    </div>
  )
}
