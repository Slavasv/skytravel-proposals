import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import SavePdfButton from './save-pdf-button'

type Params = { slug: string }

type Guest = { title?: string; name?: string; is_child?: boolean; birth_date?: string }
type Transfer = { date?: string; from?: string; to?: string; type?: string }
type Hotel = {
  id: string; sort_order: number
  city: string | null; country: string | null; booking_ref: string | null
  name: string | null; address: string | null; phone: string | null
  check_in: string | null; check_out: string | null; nights: string | null
  room_type: string | null; meal_plan: string | null; extras: string | null
}

const CHILD_TITLES = new Set(['Miss', 'Mstr', 'Chd', 'Inf'])
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function parseDMY(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = s.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (!m) return null
  const d = parseInt(m[1],10), mo = parseInt(m[2],10), y = parseInt(m[3],10)
  const date = new Date(y, mo-1, d)
  if (date.getFullYear()!==y || date.getMonth()!==mo-1 || date.getDate()!==d) return null
  return date
}

function fullYears(birth: Date, ref: Date): number {
  let age = ref.getFullYear()-birth.getFullYear()
  const m = ref.getMonth()-birth.getMonth()
  if (m<0 || (m===0 && ref.getDate()<birth.getDate())) age--
  return age
}

// "12 — 22 July 2026" или "12 July – 22 August 2026" если разные месяцы/годы
function prettyDateRange(inS: string | null, outS: string | null): string {
  const a = parseDMY(inS), b = parseDMY(outS)
  if (!a || !b) {
    // fallback: показать как есть
    return [inS, outS].filter(Boolean).join(' – ')
  }
  const sameYear = a.getFullYear()===b.getFullYear()
  const sameMonth = sameYear && a.getMonth()===b.getMonth()
  if (sameMonth) {
    return `${a.getDate()} — ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`
  }
  if (sameYear) {
    return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`
  }
  return `${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`
}

function prettyIssue(s: string | null): string {
  const d = parseDMY(s)
  if (!d) return s || ''
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
}

// Markdown → безопасный HTML (**bold**, *italic*)
function renderMarkdown(text: string): string {
  const esc = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  return esc
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,'<em>$1</em>')
    .replace(/\n/g,'<br/>')
}

function occupancy(guests: Guest[]): string {
  const adults = guests.filter(g => !CHILD_TITLES.has(g.title || '')).length
  const children = guests.filter(g => CHILD_TITLES.has(g.title || '') && g.title !== 'Inf').length
  const infants = guests.filter(g => g.title === 'Inf').length
  const parts: string[] = []
  if (adults>0) parts.push(`${adults} ${adults===1?'Adult':'Adults'}`)
  if (children>0) parts.push(`${children} ${children===1?'Child':'Children'}`)
  if (infants>0) parts.push(`${infants} ${infants===1?'Infant':'Infants'}`)
  return parts.join(', ') || '—'
}

export default async function VoucherPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params

  const { data: voucher, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !voucher) notFound()

  const { data: company } = await supabase
    .from('companies')
    .select('name, logo_url, accent_color, tagline, greeting_message, contact_email, contact_phone, website_url, office_address, footer_note')
    .eq('id', voucher.company_id)
    .single()

  const { data: hotelsRaw } = await supabase
    .from('voucher_hotels')
    .select('*')
    .eq('voucher_id', voucher.id)
    .order('sort_order', { ascending: true })

  const hotels = (hotelsRaw ?? []) as Hotel[]
  const guests: Guest[] = Array.isArray(voucher.guests) ? voucher.guests : []
  const transfers: Transfer[] = Array.isArray(voucher.transfers) ? voucher.transfers : []
  const showTransfer = voucher.show_transfer && transfers.some(t => t.from || t.to)

  // возраст ребёнка на последний выезд
  let lastCheckout: Date | null = null
  for (const h of hotels) {
    const d = parseDMY(h.check_out)
    if (d && (!lastCheckout || d > lastCheckout)) lastCheckout = d
  }
  function guestLine(g: Guest): { name: string; tag: string } {
    const title = g.title || ''
    const isChild = CHILD_TITLES.has(title)
    // Mr/Mrs/Miss/Mstr — титул перед именем; Chd/Inf — без титула перед именем
    const showTitleBefore = ['Mr','Mrs','Miss','Mstr'].includes(title)
    const name = showTitleBefore ? `${title} ${g.name || ''}`.trim() : (g.name || '')
    let tag = 'ADL'
    if (isChild) {
      const b = parseDMY(g.birth_date)
      const age = (b && lastCheckout) ? fullYears(b, lastCheckout) : null
      if (title === 'Inf') tag = age != null ? `INF · ${age}y` : 'INF'
      else tag = age != null ? `CHD · ${age}y` : 'CHD'
    }
    return { name, tag }
  }

  const accent = company?.accent_color || '#C9A227'
  const brandName = company?.name || 'Sky Travel'
  const multiHotel = hotels.length > 1

  // стили
  const line: React.CSSProperties = { height: '1px', background: 'var(--v-accent)', border: 'none', margin: 0, opacity: 0.5 }
  const metaLabel: React.CSSProperties = { fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--v-muted)', fontWeight: 500 }
  const serif = "Georgia, 'Times New Roman', serif"

  return (
    <div style={{
      ['--v-accent' as string]: accent,
      ['--v-text' as string]: '#2C2C2A',
      ['--v-muted' as string]: '#8A8880',
      ['--v-soft' as string]: '#5F5E5A',
      background: '#FAF8F4', minHeight: '100vh', padding: '40px 20px 80px',
      fontFamily: "system-ui, sans-serif", color: 'var(--v-text)',
    } as React.CSSProperties}>

      <SavePdfButton />

      <div id="voucher-doc" style={{ maxWidth: '760px', margin: '0 auto', background: '#FFFFFF', padding: '56px 56px 40px', boxShadow: '0 1px 40px rgba(0,0,0,0.06)' }}>

        {/* HEADER */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          {company?.logo_url ? (
            <img src={company.logo_url} alt={brandName} style={{ maxHeight: '80px', maxWidth: '260px', objectFit: 'contain', margin: '0 auto 8px' }} />
          ) : (
            <div style={{ fontFamily: serif, fontSize: '40px', fontStyle: 'italic', color: 'var(--v-text)', marginBottom: '8px' }}>{brandName}</div>
          )}
          {company?.tagline && (
            <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: '16px', color: 'var(--v-soft)', marginBottom: '12px' }}>{company.tagline}</div>
          )}
          <div style={{ ...metaLabel, marginBottom: '20px' }}>Booking Confirmation</div>
          <hr style={line} />
        </div>

        {/* ISSUED + GREETING */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <span style={metaLabel}>Issued </span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--v-text)', letterSpacing: '0.06em' }}>{prettyIssue(voucher.issue_date)}</span>
        </div>

        {voucher.greeting_for && (
          <div style={{ fontFamily: serif, fontSize: '24px', marginBottom: '16px', color: 'var(--v-text)' }}>
            Dear {voucher.greeting_for},
          </div>
        )}
        {company?.greeting_message && (
          <div
            style={{ fontFamily: serif, fontSize: '17px', lineHeight: 1.7, color: 'var(--v-soft)', marginBottom: '44px' }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(company.greeting_message) }}
          />
        )}

        {/* ACCOMMODATION */}
        {hotels.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <span style={metaLabel}>Accommodation</span>
              <hr style={{ ...line, flex: 1 }} />
            </div>

            {hotels.map((h, i) => {
              const stayLabel = multiHotel ? `Stay ${String(i+1).padStart(2,'0')}` : 'Stay'
              const place = [h.city, h.country].filter(Boolean).join(' · ')
              const addressLine = [h.address, h.phone].filter(Boolean).join('  ·  ')
              const dates = prettyDateRange(h.check_in, h.check_out)
              const nights = h.nights ? `${h.nights} ${h.nights === '1' ? 'Night' : 'Nights'}` : ''
              return (
                <div key={h.id} style={{ border: '1px solid #EDEAE3', borderRadius: '10px', padding: '24px 28px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--v-muted)', fontWeight: 600 }}>
                      {stayLabel}{place ? <span style={{ color: 'var(--v-soft)' }}> · {place}</span> : ''}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      {h.booking_ref && <span style={{ fontSize: '12px', color: 'var(--v-muted)' }}>Ref. № {h.booking_ref}</span>}
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--v-text)', background: '#F0EEE8', padding: '4px 12px', borderRadius: '999px' }}>✓ Confirmed &amp; paid</span>
                    </div>
                  </div>

                  <div style={{ fontFamily: serif, fontSize: '26px', color: 'var(--v-text)', marginBottom: '4px' }}>{h.name || 'Hotel'}</div>
                  {addressLine && <div style={{ fontSize: '13px', color: 'var(--v-soft)', marginBottom: '20px' }}>{addressLine}</div>}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {dates && (
                      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px', alignItems: 'baseline' }}>
                        <span style={metaLabel}>Dates</span>
                        <span style={{ fontFamily: serif, fontSize: '18px', color: 'var(--v-text)' }}>{dates}{nights ? <span style={{ fontFamily: 'system-ui', fontSize: '14px', color: 'var(--v-soft)' }}> · {nights}</span> : ''}</span>
                      </div>
                    )}
                    {h.room_type && (
                      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px', alignItems: 'baseline' }}>
                        <span style={metaLabel}>Room type</span>
                        <span style={{ fontFamily: serif, fontSize: '18px', color: 'var(--v-text)' }}>{h.room_type}</span>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px', alignItems: 'baseline' }}>
                      <span style={metaLabel}>Occupancy</span>
                      <span style={{ fontFamily: serif, fontSize: '18px', color: 'var(--v-text)' }}>{occupancy(guests)}</span>
                    </div>
                    {h.meal_plan && (
                      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px', alignItems: 'baseline' }}>
                        <span style={metaLabel}>Meal plan</span>
                        <span style={{ fontFamily: serif, fontSize: '18px', color: 'var(--v-text)' }}>{h.meal_plan}</span>
                      </div>
                    )}
                  </div>

                  {h.extras && (
                    <div style={{ marginTop: '18px', padding: '10px 14px', background: '#FAF6F0', borderRadius: '8px', fontSize: '13px', color: 'var(--v-soft)' }}>
                      {h.extras}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* GUESTS */}
        {guests.length > 0 && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <span style={metaLabel}>Guests</span>
              <hr style={{ ...line, flex: 1 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {guests.map((g, i) => {
                const { name, tag } = guestLine(g)
                if (!name) return null
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', paddingBottom: '8px', borderBottom: '1px solid #F0EEE8' }}>
                    <span style={{ fontFamily: serif, fontSize: '17px', color: 'var(--v-text)' }}>{name}</span>
                    <span style={{ fontSize: '12px', letterSpacing: '0.08em', color: 'var(--v-muted)', whiteSpace: 'nowrap' }}>{tag}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TRANSFER */}
        {showTransfer && (
          <div style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <span style={metaLabel}>Transfers</span>
              <hr style={{ ...line, flex: 1 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {transfers.filter(t => t.from || t.to).map((t, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: serif, fontSize: '17px', color: 'var(--v-text)' }}>
                    {t.from || '—'} <span style={{ color: 'var(--v-muted)' }}>→</span> {t.to || '—'}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--v-soft)' }}>
                    {[t.date, t.type].filter(Boolean).join('  ·  ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NOTES */}
        {voucher.notes && (
          <div style={{ marginBottom: '40px', fontSize: '13px', color: 'var(--v-soft)', lineHeight: 1.6 }}>
            {voucher.notes}
          </div>
        )}

        {/* FOOTER */}
        <hr style={{ ...line, marginTop: '48px', marginBottom: '20px' }} />
        <div style={{ textAlign: 'center', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--v-muted)', lineHeight: 1.8 }}>
          {[
            company?.footer_note || brandName,
            company?.contact_email,
            company?.contact_phone,
            company?.website_url?.replace(/^https?:\/\//, ''),
          ].filter(Boolean).join('  ·  ')}
          {company?.office_address && (
            <div style={{ marginTop: '4px', textTransform: 'none', letterSpacing: '0.02em' }}>{company.office_address}</div>
          )}
        </div>

      </div>
    </div>
  )
}