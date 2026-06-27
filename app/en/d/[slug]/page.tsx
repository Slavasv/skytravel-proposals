import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import BlockGallery from '@/app/p/[slug]/block-gallery'

type Params = { slug: string }

type CostLine = {
  id: string
  category: 'hotel' | 'transfer' | 'activity'
  label_en: string
  label_en: string
  nights: number | null
  details_en: string
  details_en: string
  price: string
}

type Section = {
  id: string
  type: string
  sort_order: number
  title_en: string | null
  title_en: string | null
  data: Record<string, unknown> | null
  city_block_id: string | null
  hotel_block_id: string | null
}

type CBlock = {
  id: string
  type: string
  title_en: string | null
  title_en: string | null
  description_en: string | null
  description_en: string | null
  image_url: string | null
  images: string[] | null
  facts_en: string | null
  facts_en: string | null
  duration_hours: number | null
  rooms: unknown
}

type Room = { id: string; title_en: string; title_en: string; subtitle_en: string; subtitle_en: string; images: string[] }

function normalizeRooms(data: unknown): Room[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      id: typeof x.id === 'string' ? x.id : Math.random().toString(36).slice(2),
      title_en: typeof x.title_en === 'string' ? x.title_en : '',
      title_en: typeof x.title_en === 'string' ? x.title_en : '',
      subtitle_en: typeof x.subtitle_en === 'string' ? x.subtitle_en : '',
      subtitle_en: typeof x.subtitle_en === 'string' ? x.subtitle_en : '',
      images: Array.isArray(x.images) ? x.images.filter((i): i is string => typeof i === 'string') : [],
    }))
}

function photosOf(b: { image_url: string | null; images: string[] | null } | null | undefined): string[] {
  if (!b) return []
  return [b.image_url, ...(Array.isArray(b.images) ? b.images : [])].filter(Boolean) as string[]
}

const H2: React.CSSProperties = { fontSize: '22px', fontWeight: 500, marginBottom: '24px', borderBottom: '1px solid var(--client-border)', paddingBottom: '12px' }

export default async function DestinationPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params

  const { data: proposal, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('slug', slug)
    .eq('kind', 'destination')
    .single()

  if (error || !proposal) notFound()

  const { data: company } = await supabase
    .from('companies')
    .select('name, contact_email, accent_color')
    .eq('id', proposal.company_id)
    .single()

  // Sections in order
  const { data: sectionsRaw } = await supabase
    .from('destination_sections')
    .select('*')
    .eq('proposal_id', proposal.id)
    .order('sort_order', { ascending: true })

  const sections = (sectionsRaw ?? []) as Section[]

  // Collect block ids to load (city, hotel)
  const cityIds = sections.filter((s) => s.type === 'city' && s.city_block_id).map((s) => s.city_block_id as string)
  const hotelIds = sections.filter((s) => s.type === 'hotel' && s.hotel_block_id).map((s) => s.hotel_block_id as string)

  // Attached blocks of activities sections
  const activitySectionIds = sections.filter((s) => s.type === 'activities').map((s) => s.id)

  // Load single blocks (city + hotel)
  const singleIds = [...cityIds, ...hotelIds]
  const blocksById: Record<string, CBlock> = {}
  if (singleIds.length > 0) {
    const { data: blocks } = await supabase
      .from('content_blocks')
      .select('id, type, title_en, title_en, description_en, description_en, image_url, images, facts_en, facts_en, duration_hours, rooms')
      .in('id', singleIds)
    ;(blocks ?? []).forEach((b) => { blocksById[(b as CBlock).id] = b as CBlock })
  }

  // Load activities-section blocks (via destination_section_blocks)
  const sectionBlocks: Record<string, CBlock[]> = {}
  if (activitySectionIds.length > 0) {
    const { data: links } = await supabase
      .from('destination_section_blocks')
      .select('section_id, sort_order, content_blocks(id, type, title_en, title_en, description_en, description_en, image_url, images, facts_en, facts_en, duration_hours, rooms)')
      .in('section_id', activitySectionIds)
      .order('sort_order', { ascending: true })
    ;(links ?? []).forEach((row) => {
      const sid = row.section_id as string
      const cb = (Array.isArray(row.content_blocks) ? row.content_blocks[0] : row.content_blocks) as CBlock | null
      if (!cb) return
      if (!sectionBlocks[sid]) sectionBlocks[sid] = []
      sectionBlocks[sid].push(cb)
    })
  }

  // Route subtitle: cities from city sections
  const cityNames = sections
    .filter((s) => s.type === 'city' && s.city_block_id)
    .map((s) => blocksById[s.city_block_id as string]?.title_en)
    .filter(Boolean) as string[]
  const routeSubtitle = cityNames.join(' + ')

  const renderBullets = (text: string) => (
    <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--client-text-secondary)' }}>
      {text.split('\n').filter((l) => l.trim()).map((line, i) => (
        <li key={i} style={{ fontSize: '15px', lineHeight: 1.7, marginBottom: '6px' }}>{line}</li>
      ))}
    </ul>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--client-bg)', color: 'var(--client-text)', ['--brand-accent' as string]: company?.accent_color || '#C9A227' } as React.CSSProperties}>
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui', color: 'var(--client-text)' }}>
      {/* COVER */}
      {proposal.cover_image_url && (
        <div className="client-cover" style={{ height: '320px', backgroundImage: `linear-gradient(rgba(0,0,0,0.2), rgba(0,0,0,0.5)), url(${proposal.cover_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '12px', display: 'flex', alignItems: 'flex-end', padding: '32px', color: 'white', marginBottom: '32px' }}>
          <div>
            <div style={{ fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', opacity: 0.85, marginBottom: '8px' }}>
              {company?.name ?? 'Sky Travel'}
            </div>
            <h1 className="client-title" style={{ fontSize: '32px', fontWeight: 400, margin: 0, lineHeight: 1.2 }}>
              {proposal.trip_title_en}
            </h1>
            {routeSubtitle && <div style={{ fontSize: '16px', marginTop: '8px', opacity: 0.9 }}>{routeSubtitle}</div>}
            {proposal.tagline_en && <div style={{ fontSize: '14px', marginTop: '6px', opacity: 0.8, fontStyle: 'italic' }}>{proposal.tagline_en}</div>}
          </div>
        </div>
      )}

      {proposal.season_en && (
        <div style={{ color: 'var(--client-text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
          {proposal.season_en}
        </div>
      )}

      {proposal.intro_text_en && (
        <p style={{ fontSize: '17px', lineHeight: 1.7, marginBottom: '48px', color: 'var(--client-text)' }}>
          {proposal.intro_text_en}
        </p>
      )}

      {/* SECTIONS */}
      {sections.map((section) => {
        const data = section.data || {}

        // ROUTE
        if (section.type === 'route') {
          const stops = Array.isArray(data.stops) ? data.stops as Array<Record<string, string>> : []
          if (stops.length === 0) return null
          return (
            <div key={section.id} style={{ marginBottom: '56px' }}>
              <h2 style={H2}>{section.title_en || 'Travel route'}</h2>
              {stops.map((st, i) => (
                <div key={i} style={{ marginBottom: '24px' }}>
                  {st.date_en && <div style={{ fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--client-text-muted)', marginBottom: '4px' }}>{st.date_en}</div>}
                  {st.title_en && <h3 style={{ fontSize: '20px', fontWeight: 400, margin: '0 0 6px', color: 'var(--client-text)' }}>{st.title_en}</h3>}
                  {st.desc_en && <p style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--client-text-secondary)', margin: 0 }}>{st.desc_en}</p>}
                </div>
              ))}
            </div>
          )
        }

        // CITY
        if (section.type === 'city') {
          const city = section.city_block_id ? blocksById[section.city_block_id] : null
          if (!city) return null
          const photos = photosOf(city)
          const facts = city.facts_en
          return (
            <div key={section.id} style={{ marginBottom: '56px' }}>
              <h2 style={H2}>{city.title_en || section.title_en || ''}</h2>
              {photos.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <BlockGallery photos={photos} alt={city.title_en || ''} width={0} height={360} />
                </div>
              )}
              {city.description_en && <p style={{ fontSize: '16px', lineHeight: 1.7, color: 'var(--client-text)', marginBottom: '16px' }}>{city.description_en}</p>}
              {facts && renderBullets(facts)}
            </div>
          )
        }

        // ACTIVITIES
        if (section.type === 'activities') {
          const acts = sectionBlocks[section.id] ?? []
          if (acts.length === 0) return null
          return (
            <div key={section.id} style={{ marginBottom: '56px' }}>
              <h2 style={H2}>{section.title_en || 'What to see'}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                {acts.map((a) => {
                  const photos = photosOf(a)
                  return (
                    <div key={a.id}>
                      {photos.length > 0 && (
                        <div style={{ marginBottom: '10px' }}>
                          <BlockGallery photos={photos} alt={a.title_en || ''} width={0} height={160} />
                        </div>
                      )}
                      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--client-text)', marginBottom: '4px' }}>{a.title_en}</div>
                      {a.description_en && <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--client-text-secondary)', margin: 0 }}>{a.description_en}</p>}
                      {a.duration_hours != null && <div style={{ fontSize: '12px', color: 'var(--client-text-muted)', marginTop: '6px' }}>⏱ {a.duration_hours}h</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }

        // HOTEL
        if (section.type === 'hotel') {
          const hotel = section.hotel_block_id ? blocksById[section.hotel_block_id] : null
          if (!hotel) return null
          const allRooms = normalizeRooms(hotel.rooms)
          const roomIds = Array.isArray(data.room_ids) ? data.room_ids as string[] : []
          const rooms = roomIds.length === 0 ? allRooms : allRooms.filter((r) => roomIds.includes(r.id))
          const hotelPhotos = photosOf(hotel)
          const activities = typeof data.activities_en === 'string' ? data.activities_en : ''
          return (
            <div key={section.id} style={{ marginBottom: '56px' }}>
              <h2 style={H2}>{hotel.title_en || ''}</h2>
              {hotelPhotos.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <BlockGallery photos={hotelPhotos} alt={hotel.title_en || ''} width={0} height={360} />
                </div>
              )}
              {hotel.description_en && <p style={{ fontSize: '16px', lineHeight: 1.7, color: 'var(--client-text)', marginBottom: '24px' }}>{hotel.description_en}</p>}

              {rooms.map((r) => {
                const rp = r.images.filter(Boolean)
                return (
                  <div key={r.id} style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--client-text)' }}>{r.title_en}</div>
                    {r.subtitle_en && <div style={{ fontSize: '13px', color: 'var(--client-text-muted)', marginBottom: '10px' }}>{r.subtitle_en}</div>}
                    {rp.length > 0 && <BlockGallery photos={rp} alt={r.title_en} width={0} height={280} />}
                  </div>
                )
              })}

              {activities && (
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px', color: 'var(--client-text)' }}>Hotel activities</h3>
                  {renderBullets(activities)}
                </div>
              )}
            </div>
          )
        }

        // GALLERY
        if (section.type === 'gallery') {
          const images = Array.isArray(data.images) ? (data.images as string[]).filter(Boolean) : []
          if (images.length === 0) return null
          return (
            <div key={section.id} style={{ marginBottom: '56px' }}>
              {section.title_en && <h2 style={H2}>{section.title_en}</h2>}
              <BlockGallery photos={images} alt={section.title_en || ''} width={0} height={420} />
            </div>
          )
        }

        // SAMPLE DAY
        if (section.type === 'sample_day') {
          const items = Array.isArray(data.items) ? data.items as Array<Record<string, string>> : []
          if (items.length === 0) return null
          return (
            <div key={section.id} style={{ marginBottom: '56px' }}>
              <h2 style={H2}>{section.title_en || 'A typical day'}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {items.map((it, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '16px', alignItems: 'baseline' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--brand-accent)' }}>{it.time}</div>
                    <div style={{ fontSize: '15px', color: 'var(--client-text)' }}>{it.text_en}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        }

        return null
      })}

      {/* COSTS */}
      {(() => {
        const lines: CostLine[] = Array.isArray(proposal.cost_lines) ? proposal.cost_lines : []
        const cur = proposal.cost_currency || proposal.currency || ''
        const hasCosts = lines.length > 0 || proposal.cost_includes_en || proposal.cost_excludes_en || proposal.cost_notes_en || proposal.total_price != null
        if (!hasCosts) return null

        const cats: { key: CostLine['category']; title: string }[] = [
          { key: 'hotel', title: 'Accommodation' },
          { key: 'transfer', title: 'Transfers' },
          { key: 'activity', title: 'Activities' },
        ]

        return (
          <div style={{ marginTop: '64px' }}>
            <h2 style={H2}>Pricing</h2>
            {cats.map((cat) => {
              const catLines = lines.filter((l) => l.category === cat.key)
              if (catLines.length === 0) return null
              return (
                <div key={cat.key} style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px', color: 'var(--client-text)' }}>{cat.title}</h3>
                  {catLines.map((line) => (
                    <div key={line.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', padding: '10px 0', borderBottom: '1px solid var(--client-border-row)' }}>
                      <div>
                        <div style={{ fontSize: '15px', color: 'var(--client-text)' }}>{line.label_en || '—'}</div>
                        {line.details_en && <div style={{ fontSize: '13px', color: 'var(--client-text-muted)', marginTop: '2px' }}>{line.details_en}</div>}
                      </div>
                      {line.price && <div style={{ fontSize: '15px', color: 'var(--client-text)', whiteSpace: 'nowrap' }}>{line.price} {cur}</div>}
                    </div>
                  ))}
                </div>
              )
            })}

            {proposal.cost_includes_en && (
              <div style={{ marginTop: '32px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px', color: 'var(--client-text)' }}>This price includes</h3>
                {renderBullets(proposal.cost_includes_en)}
              </div>
            )}
            {proposal.cost_excludes_en && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px', color: 'var(--client-text)' }}>This price does not include</h3>
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
                  {proposal.price_from ? 'From' : 'Pricing'}
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
        {company?.name ?? 'Sky Travel'}{company?.contact_email ? ` · ${company.contact_email}` : ''}
      </div>
    </div>
    </div>
  )
}