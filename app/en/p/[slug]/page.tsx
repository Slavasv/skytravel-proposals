import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import ProposalItinerary from '@/app/p/[slug]/proposal-itinerary'
import BlockGallery from '@/app/p/[slug]/block-gallery'

type Params = { slug: string }

type BlockShape = {
  id: string
  content_blocks: {
    id: string
    type: string
    title_en: string
    description_en: string
    image_url: string
    images: string[] | null
    location: string
  }
  custom_note_en: string | null
  sort_order: number
}

type CostLine = {
  id: string
  category: 'hotel' | 'transfer' | 'activity'
  label_ru: string
  label_en: string
  nights: number | null
  details_ru: string
  details_en: string
  price: string
}

function formatDateEn(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function pluralEn(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

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

  await supabase.rpc('increment_proposal_views', { p_slug: slug })

  const { data: company } = await supabase
    .from('companies')
    .select('name, contact_email, accent_color')
    .eq('id', proposal.company_id)
    .single()

  const { data: days } = await supabase
    .from('days')
    .select(`
      *,
      day_blocks (
        id,
        sort_order,
        custom_note_ru,
        custom_note_en,
        room_type_ru,
        room_type_en,
        from_ru,
        from_en,
        to_ru,
        to_en,
        content_blocks (
          id, type, title_ru, title_en, description_ru, description_en, image_url, images, location
        )
      )
    `)
    .eq('proposal_id', proposal.id)
    .order('day_number', { ascending: true })

  const typeCounts = { hotel: 0, activity: 0, city: 0 }
  days?.forEach((day) => {
    day.day_blocks?.forEach((db: BlockShape) => {
      const t = db.content_blocks?.type as 'hotel' | 'activity' | 'city' | undefined
      if (t && t in typeCounts) typeCounts[t]++
    })
  })

  const summaryParts: string[] = []
  const daysCount = days?.length ?? 0
  if (daysCount > 0) {
    summaryParts.push(`${daysCount} ${pluralEn(daysCount, 'day', 'days')}`)
  }
  if (typeCounts.hotel > 0) {
    summaryParts.push(`${typeCounts.hotel} ${pluralEn(typeCounts.hotel, 'hotel', 'hotels')}`)
  }
  if (typeCounts.activity > 0) {
    summaryParts.push(`${typeCounts.activity} ${pluralEn(typeCounts.activity, 'activity', 'activities')}`)
  }
  if (typeCounts.city > 0) {
    summaryParts.push(`${typeCounts.city} ${pluralEn(typeCounts.city, 'city', 'cities')}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--client-bg)', color: 'var(--client-text)', ['--brand-accent' as string]: company?.accent_color || '#C9A227' } as React.CSSProperties}>
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui', color: 'var(--client-text)' }}>
      {proposal.cover_image_url && (
        <div
          className="client-cover"
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
              {company?.name ?? 'Sky Travel'}
            </div>
            <h1 className="client-title" style={{ fontSize: '32px', fontWeight: 400, margin: 0, lineHeight: 1.2 }}>
              {proposal.trip_title_en}
            </h1>
          </div>
        </div>
      )}

      <div style={{ color: 'var(--client-text-secondary)', fontSize: '14px', marginBottom: '32px', lineHeight: 1.6 }}>
        For {proposal.client_name_en || '—'} · {proposal.guest_count} {pluralEn(proposal.guest_count ?? 0, 'guest', 'guests')} · {formatDateEn(proposal.start_date)} → {formatDateEn(proposal.end_date)}
        {summaryParts.length > 0 && (
          <> · {summaryParts.join(' · ')}</>
        )}
      </div>

      {proposal.intro_text_en && (
        <p style={{ fontSize: '17px', lineHeight: 1.7, marginBottom: '48px', color: 'var(--client-text)' }}>
          {proposal.intro_text_en}
        </p>
      )}

      <ProposalItinerary days={days ?? []} lang="en" endDate={proposal.end_date} />

      <h2 style={{ fontSize: '22px', fontWeight: 500, marginBottom: '24px', borderBottom: '1px solid var(--client-border)', paddingBottom: '12px' }}>
        Your Itinerary
      </h2>

      {days?.map((day) => {
        const sortedBlocks = (day.day_blocks ?? []).sort(
          (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
        )

        return (
          <div key={day.id} style={{ marginBottom: '48px' }}>
            <div style={{ fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--client-text-muted)', marginBottom: '4px' }}>
              Day {day.day_number} · {formatDateEn(day.date)}
            </div>
            <h3 style={{ fontSize: '24px', fontWeight: 400, margin: '0 0 12px', color: 'var(--client-text)' }}>
              {day.title_en}
            </h3>
            {day.intro_text_en && (
              <p style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--client-text-secondary)', marginBottom: '24px' }}>
                {day.intro_text_en}
              </p>
            )}

            {sortedBlocks.map((db: BlockShape) => {
              const block = db.content_blocks
              return (
                <div key={db.id} className="client-block" style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: '160px 1fr', gap: '20px' }}>
                  {(() => {
                    const photos = [block.image_url, ...(Array.isArray(block.images) ? block.images : [])].filter(Boolean) as string[]
                    return photos.length > 0 ? (
                      <div className="client-block-image">
                        <BlockGallery photos={photos} alt={block.title_en || ''} width={160} height={110} />
                      </div>
                    ) : null
                  })()}
                  <div>
                    <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--client-text-muted)', marginBottom: '4px' }}>
                      {block.type}
                    </div>
                    <div style={{ fontSize: '17px', fontWeight: 500, marginBottom: '6px' }}>
                      {block.title_en}
                    </div>
                    <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--client-text-secondary)', margin: 0 }}>
                      {block.description_en}
                    </p>
                    {db.custom_note_en && (
                      <div style={{ fontSize: '13px', color: 'var(--client-note-text)', backgroundColor: 'var(--client-note-bg)', padding: '8px 12px', borderRadius: '4px', marginTop: '10px' }}>
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

      {(proposal.payment_terms_en || proposal.cancellation_policy_en) && (
        <div style={{ marginTop: '64px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 500, marginBottom: '24px', borderBottom: '1px solid var(--client-border)', paddingBottom: '12px' }}>
            Terms & Conditions
          </h2>

          {proposal.payment_terms_en && (
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px', color: 'var(--client-text)' }}>
                Payment Terms
              </h3>
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--client-text-secondary)' }}>
                {proposal.payment_terms_en.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                  <li key={i} style={{ fontSize: '15px', lineHeight: 1.7, marginBottom: '6px' }}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {proposal.cancellation_policy_en && (
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px', color: 'var(--client-text)' }}>
                Cancellation Policy
              </h3>
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--client-text-secondary)' }}>
                {proposal.cancellation_policy_en.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                  <li key={i} style={{ fontSize: '15px', lineHeight: 1.7, marginBottom: '6px' }}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {(() => {
        const lines: CostLine[] = Array.isArray(proposal.cost_lines) ? proposal.cost_lines : []
        const cur = proposal.cost_currency || proposal.currency || ''
        const hasCosts =
          lines.length > 0 ||
          proposal.cost_includes_en ||
          proposal.cost_excludes_en ||
          proposal.cost_notes_en ||
          proposal.total_price != null

        if (!hasCosts) return null

        const cats: { key: CostLine['category']; title: string }[] = [
          { key: 'hotel', title: 'Accommodation' },
          { key: 'transfer', title: 'Transfers' },
          { key: 'activity', title: 'Activities' },
        ]

        const renderBullets = (text: string) => (
          <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--client-text-secondary)' }}>
            {text.split('\n').filter((l) => l.trim()).map((line, i) => (
              <li key={i} style={{ fontSize: '15px', lineHeight: 1.7, marginBottom: '6px' }}>{line}</li>
            ))}
          </ul>
        )

        return (
          <div style={{ marginTop: '64px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 500, marginBottom: '24px', borderBottom: '1px solid var(--client-border)', paddingBottom: '12px' }}>
              Costs
            </h2>

            {cats.map((cat) => {
              const catLines = lines.filter((l) => l.category === cat.key)
              if (catLines.length === 0) return null
              return (
                <div key={cat.key} style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px', color: 'var(--client-text)' }}>
                    {cat.title}
                  </h3>
                  {catLines.map((line) => (
                    <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', padding: '10px 0', borderBottom: '1px solid var(--client-border-row)' }}>
                      <div>
                        <div style={{ fontSize: '15px', color: 'var(--client-text)' }}>
                          {line.label_en || '—'}
                          {line.nights != null && (
                            <span style={{ color: 'var(--client-text-muted)' }}> · {line.nights} {line.nights === 1 ? 'night' : 'nights'}</span>
                          )}
                        </div>
                        {line.details_en && (
                          <div style={{ fontSize: '13px', color: 'var(--client-text-muted)', marginTop: '2px' }}>{line.details_en}</div>
                        )}
                      </div>
                      {line.price && (
                        <div style={{ fontSize: '15px', color: 'var(--client-text)', whiteSpace: 'nowrap' }}>
                          {line.price} {cur}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}

            {proposal.cost_includes_en && (
              <div style={{ marginTop: '32px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px', color: 'var(--client-text)' }}>This cost includes</h3>
                {renderBullets(proposal.cost_includes_en)}
              </div>
            )}

            {proposal.cost_excludes_en && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px', color: 'var(--client-text)' }}>This cost does not include</h3>
                {renderBullets(proposal.cost_excludes_en)}
              </div>
            )}

            {proposal.cost_notes_en && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px', color: 'var(--client-text)' }}>Notes</h3>
                {renderBullets(proposal.cost_notes_en)}
              </div>
            )}

            {proposal.total_price != null && (
              <div style={{ marginTop: '24px', padding: '24px 32px', background: 'var(--client-dark-panel)', color: 'var(--client-text-on-dark)', textAlign: 'center', borderRadius: '8px' }}>
                <div style={{ fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px', opacity: 0.7 }}>
                  Total
                </div>
                <div style={{ fontSize: '28px', fontWeight: 500 }}>
                  {proposal.total_price.toLocaleString('en-US')} {cur}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '13px', color: 'var(--client-text-muted)' }}>
        {company?.name ?? 'Sky Travel'}
        {company?.contact_email ? ` · ${company.contact_email}` : ''}
      </div>
    </div>
    </div>
  )
}