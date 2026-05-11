import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'

type Params = { slug: string }

export default async function ProposalPageEN({ params }: { params: Promise<Params> }) {
  const { slug } = await params

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !proposal) {
    notFound()
  }

  const { data: days } = await supabase
    .from('days')
    .select(`
      *,
      day_blocks (
        sort_order,
        custom_note_ru,
        custom_note_en,
        content_blocks (
          id, type, title_ru, title_en, description_ru, description_en, image_url, location
        )
      )
    `)
    .eq('proposal_id', proposal.id)
    .order('day_number', { ascending: true })

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui', color: '#2C2C2A' }}>
      {proposal.cover_image_url && (
        <div
          style={{
            height: '320px',
            backgroundImage: `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.5)), url(${proposal.cover_image_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'flex-end',
            padding: '32px',
            color: 'white',
            marginBottom: '32px',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.85, marginBottom: '8px' }}>
              Sky Travel
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: 400, margin: 0, lineHeight: 1.2 }}>
              {proposal.trip_title_en}
            </h1>
          </div>
        </div>
      )}

      <div style={{ color: '#5F5E5A', fontSize: '14px', marginBottom: '32px' }}>
        For {proposal.client_name} · {proposal.guest_count} guests · {proposal.start_date} → {proposal.end_date}
      </div>

      {proposal.intro_text_en && (
        <p style={{ fontSize: '17px', lineHeight: 1.7, marginBottom: '48px', color: '#444441' }}>
          {proposal.intro_text_en}
        </p>
      )}

      <h2 style={{ fontSize: '22px', fontWeight: 500, marginBottom: '24px', borderBottom: '1px solid #D3D1C7', paddingBottom: '12px' }}>
        Your Itinerary
      </h2>

      {days?.map((day) => {
        const sortedBlocks = (day.day_blocks ?? []).sort(
          (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
        )

        return (
          <div key={day.id} style={{ marginBottom: '48px' }}>
            <div style={{ fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888780', marginBottom: '4px' }}>
              Day {day.day_number} · {day.date}
            </div>
            <h3 style={{ fontSize: '24px', fontWeight: 400, margin: '0 0 12px', color: '#2C2C2A' }}>
              {day.title_en}
            </h3>
            {day.intro_text_en && (
              <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#5F5E5A', marginBottom: '24px' }}>
                {day.intro_text_en}
              </p>
            )}

            {sortedBlocks.map((db: { content_blocks: { id: string, type: string, title_en: string, description_en: string, image_url: string, location: string }, custom_note_en: string | null }) => {
              const block = db.content_blocks
              return (
                <div key={block.id} style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: '160px 1fr', gap: '20px' }}>
                  {block.image_url && (
                    <div
                      style={{
                        width: '160px',
                        height: '110px',
                        backgroundImage: `url(${block.image_url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        borderRadius: '6px',
                      }}
                    />
                  )}
                  <div>
                    <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#888780', marginBottom: '4px' }}>
                      {block.type}
                    </div>
                    <div style={{ fontSize: '17px', fontWeight: 500, marginBottom: '6px' }}>
                      {block.title_en}
                    </div>
                    <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#5F5E5A', margin: 0 }}>
                      {block.description_en}
                    </p>
                    {db.custom_note_en && (
                      <div style={{ fontSize: '13px', color: '#854F0B', backgroundColor: '#FAEEDA', padding: '8px 12px', borderRadius: '4px', marginTop: '10px' }}>
                        {db.custom_note_en}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      <div style={{ marginTop: '64px', padding: '32px', background: '#2C2C2A', color: '#FAF8F4', textAlign: 'center', borderRadius: '8px' }}>
        <div style={{ fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px', opacity: 0.7 }}>
          Total Price
        </div>
        <div style={{ fontSize: '28px', fontWeight: 500 }}>
          {proposal.total_price?.toLocaleString('en-US')} {proposal.currency}
        </div>
      </div>

      <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '13px', color: '#888780' }}>
        Sky Travel · concierge@skytravel.ae
      </div>
    </div>
  )
}