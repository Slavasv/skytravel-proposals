import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getUiLang } from '@/lib/get-profile'
import OfferEditor from './offer-editor'

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServer()
  const lang = await getUiLang()

  const { data: offer, error } = await supabase
    .from('admin_offers')
    .select('*, offer_rooms(*, offer_room_quotes(*))')
    .eq('id', id)
    .single()

  if (error || !offer) notFound()

  const [{ data: partners }, { data: clients }, { data: hotelBlocks }] = await Promise.all([
    supabase.from('partners').select('id, name').order('name', { ascending: true }),
    supabase.from('clients').select('id, name, client_code').order('name', { ascending: true }),
    supabase.from('content_blocks').select('id, title_ru, title_en, link_url, rooms').eq('type', 'hotel').order('title_ru', { ascending: true }),
  ])

  type HRoom = { title_ru?: string | null; title_en?: string | null }
  const hotels = (hotelBlocks ?? []).map((h: { title_ru: string | null; title_en: string | null; link_url: string | null; rooms: HRoom[] | null }) => ({
    name: (h.title_ru || h.title_en || '').trim(),
    link: h.link_url || '',
    rooms: Array.isArray(h.rooms) ? h.rooms.map((r) => ({ ru: (r.title_ru || '').trim(), en: (r.title_en || '').trim() })).filter((r) => r.ru || r.en) : [],
  })).filter((h) => h.name)

  return (
    <div className="page-pad-40" style={{ padding: '40px', maxWidth: '1080px', margin: '0 auto' }}>
      <div style={{ marginBottom: '18px' }}>
        <Link href="/admin/offers" style={{ fontSize: '13px', color: 'var(--admin-text-muted)', textDecoration: 'none' }}>← {lang === 'ru' ? 'Офферы' : 'Offers'}</Link>
      </div>
      <OfferEditor
        offer={offer}
        partners={(partners ?? []) as { id: string; name: string }[]}
        clients={(clients ?? []) as { id: string; name: string; client_code: string | null }[]}
        hotels={hotels}
      />
    </div>
  )
}
