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
const TITLE_BEFORE = new Set(['Mr', 'Mrs', 'Miss', 'Mstr'])
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const serif = "Georgia, 'Times New Roman', serif"

function parseDMY(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = s.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (!m) return null
  const d = +m[1], mo = +m[2], y = +m[3]
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
function prettyRange(inS: string | null, outS: string | null): string {
  const a = parseDMY(inS), b = parseDMY(outS)
  if (!a || !b) return [inS, outS].filter(Boolean).join(' – ')
  const sameYear = a.getFullYear()===b.getFullYear()
  const sameMonth = sameYear && a.getMonth()===b.getMonth()
  if (sameMonth) return `${a.getDate()} — ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`
  if (sameYear) return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`
  return `${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`
}
function prettyIssue(s: string | null): string {
  const d = parseDMY(s)
  if (!d) return s || ''
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
}
function renderMarkdown(text: string): string {
  const esc = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  return esc.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/\n/g,'<br/>')
}
function occupancy(guests: Guest[]): string {
  const adults = guests.filter(g => !CHILD_TITLES.has(g.title || '')).length
  const children = guests.filter(g => CHILD_TITLES.has(g.title || '') && g.title !== 'Inf').length
  const infants = guests.filter(g => g.title === 'Inf').length
  const p: string[] = []
  if (adults>0) p.push(`${adults} ${adults===1?'Adult':'Adults'}`)
  if (children>0) p.push(`${children} ${children===1?'Child':'Children'}`)
  if (infants>0) p.push(`${infants} ${infants===1?'Infant':'Infants'}`)
  return p.join(', ') || '—'
}

export default async function VoucherPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ print?: string }> }) {
  const { slug } = await params
  const { print } = await searchParams
  const isPrint = print === '1'

  const { data: voucher, error } = await supabase.from('vouchers').select('*').eq('slug', slug).single()
  if (error || !voucher) notFound()

  const { data: company } = await supabase
    .from('companies')
    .select('name, logo_url, accent_color, tagline, greeting_message, contact_email, contact_phone, website_url, office_address, footer_note')
    .eq('id', voucher.company_id).single()

  const { data: hotelsRaw } = await supabase
    .from('voucher_hotels').select('*').eq('voucher_id', voucher.id).order('sort_order', { ascending: true })

  const hotels = (hotelsRaw ?? []) as Hotel[]
  const guests: Guest[] = Array.isArray(voucher.guests) ? voucher.guests : []
  const transfers: Transfer[] = Array.isArray(voucher.transfers) ? voucher.transfers : []
  const showTransfer = voucher.show_transfer && transfers.some(t => t.from || t.to)
  const multiHotel = hotels.length > 1

  let lastCheckout: Date | null = null
  for (const h of hotels) {
    const d = parseDMY(h.check_out)
    if (d && (!lastCheckout || d > lastCheckout)) lastCheckout = d
  }
  function guestParts(g: Guest): { name: string; tag: string } {
    const title = g.title || ''
    const isChild = CHILD_TITLES.has(title)
    const name = TITLE_BEFORE.has(title) ? `${title} ${g.name || ''}`.trim() : (g.name || '')
    if (!isChild) return { name, tag: 'ADULT' }
    const b = parseDMY(g.birth_date)
    const age = (b && lastCheckout) ? fullYears(b, lastCheckout) : null
    const label = title === 'Inf' ? 'INFANT' : 'CHILD'
    return { name, tag: age != null ? `${label} · ${age}` : label }
  }

  const accent = company?.accent_color || '#C9A227'
  const brandName = company?.name || 'Sky Travel'

  const metaLabel: React.CSSProperties = { fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--voucher-text-muted)', fontWeight: 500 }
  const sectionLabel: React.CSSProperties = { fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--voucher-text-soft)', fontWeight: 600, whiteSpace: 'nowrap' }
  const accentLine: React.CSSProperties = { flex: 1, height: '1px', background: accent, opacity: 0.5, border: 'none' }
  const valueSerif: React.CSSProperties = { fontFamily: serif, fontSize: '18px', color: 'var(--voucher-text)' }

  return (
    <div style={{
      ['--brand-accent' as string]: accent,
      background: isPrint ? 'var(--voucher-paper)' : 'var(--voucher-page-bg)', minHeight: '100vh',
      padding: isPrint ? '0' : '40px 20px 80px', fontFamily: 'system-ui, sans-serif', color: 'var(--voucher-text)',
    } as React.CSSProperties}>

      {!isPrint && <SavePdfButton slug={voucher.slug} />}

      <div id="voucher-doc" style={{ maxWidth: isPrint ? '100%' : '780px', margin: '0 auto', background: 'var(--voucher-paper)', padding: isPrint ? '0 54px' : '56px 60px 44px', boxShadow: isPrint ? 'none' : '0 1px 40px rgba(0,0,0,0.07)' }}>
        <style>{`
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { margin: 0; background: #FBF7F0; }
          @page { margin: 16mm 0; }
          .pdf-keep { break-inside: avoid; page-break-inside: avoid; }
        `}</style>

        {/* HEADER */}
        <div style={{ textAlign: 'center', marginBottom: '30px', paddingTop: isPrint ? '40px' : '0' }}>
          {company?.logo_url ? (
            <img src={company.logo_url} alt={brandName} style={{ maxHeight: '84px', maxWidth: '280px', objectFit: 'contain', margin: '0 auto 10px' }} />
          ) : (
            <div style={{ fontFamily: serif, fontSize: '42px', fontStyle: 'italic', color: 'var(--voucher-text)', marginBottom: '10px' }}>{brandName}</div>
          )}
          {company?.tagline && (
            <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: '16px', color: 'var(--voucher-text-soft)', marginBottom: '14px' }}>{company.tagline}</div>
          )}
          <div style={{ ...metaLabel, letterSpacing: '0.28em', marginBottom: '22px' }}>Booking Confirmation</div>
          <hr style={{ height: '1px', background: accent, opacity: 0.5, border: 'none', margin: 0 }} />
        </div>

        {/* ISSUED */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <span style={metaLabel}>Issued </span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--voucher-text)', letterSpacing: '0.06em' }}>{prettyIssue(voucher.issue_date)}</span>
        </div>

        {/* GREETING */}
        {voucher.greeting_for && (
          <div style={{ fontFamily: serif, fontSize: '25px', marginBottom: '16px', color: 'var(--voucher-text)' }}>
            Dear {voucher.greeting_for},
          </div>
        )}
        {company?.greeting_message && (
          <div style={{ fontFamily: serif, fontSize: '17px', lineHeight: 1.75, color: 'var(--voucher-text-soft)', marginBottom: '46px' }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(company.greeting_message) }} />
        )}

        {/* ACCOMMODATION */}
        {hotels.length > 0 && (
          <div style={{ marginBottom: '42px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '22px' }}>
              <span style={sectionLabel}>Accommodation</span>
              <hr style={accentLine} />
            </div>

            {hotels.map((h, i) => {
              const stay = multiHotel ? `Stay ${String(i+1).padStart(2,'0')}` : 'Stay'
              const place = [h.city, h.country].filter(Boolean).join(' · ')
              const addr = [h.address, h.phone].filter(Boolean).join('  ·  ')
              const dates = prettyRange(h.check_in, h.check_out)
              const nights = h.nights ? `${h.nights} ${h.nights === '1' ? 'Night' : 'Nights'}` : ''
              return (
                <div key={h.id} className="pdf-keep" style={{ background: 'var(--voucher-card-bg)', border: '1px solid var(--voucher-card-border)', borderRadius: '12px', padding: '26px 30px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--voucher-text-soft)', fontWeight: 600 }}>
                      {stay}{place ? ` · ${place}` : ''}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {h.booking_ref && <span style={{ fontSize: '12px', color: 'var(--voucher-text-soft)' }}>Ref. № <strong style={{ color: 'var(--voucher-text)', fontWeight: 700 }}>{h.booking_ref}</strong></span>}
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--voucher-text)', background: 'var(--voucher-paper)', border: '1px solid var(--voucher-card-border)', padding: '6px 14px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap' }}>
                        <span style={{ width: '9px', height: '9px', borderRadius: '999px', background: accent, flexShrink: 0 }} />
                        Confirmed &amp; paid
                      </span>
                    </div>
                  </div>

                  <div style={{ fontFamily: serif, fontSize: '27px', color: 'var(--voucher-text)', marginBottom: '5px' }}>{h.name || 'Hotel'}</div>
                  {addr && <div style={{ fontSize: '13px', color: 'var(--voucher-text-soft)', marginBottom: '22px' }}>{addr}</div>}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
                    {dates && (
                      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px', alignItems: 'baseline' }}>
                        <span style={metaLabel}>Dates</span>
                        <span style={valueSerif}>{dates}{nights ? <span style={{ fontFamily: 'system-ui', fontSize: '14px', color: 'var(--voucher-text-soft)' }}> · {nights}</span> : ''}</span>
                      </div>
                    )}
                    {h.room_type && (
                      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px', alignItems: 'baseline' }}>
                        <span style={metaLabel}>Room type</span>
                        <span style={valueSerif}>{h.room_type}</span>
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px', alignItems: 'baseline' }}>
                      <span style={metaLabel}>Occupancy</span>
                      <span style={valueSerif}>{occupancy(guests)}</span>
                    </div>
                    {h.meal_plan && (
                      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px', alignItems: 'baseline' }}>
                        <span style={metaLabel}>Meal plan</span>
                        <span style={valueSerif}>{h.meal_plan}</span>
                      </div>
                    )}
                  </div>

                  {h.extras && (
                    <div style={{ marginTop: '20px', display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '9px 18px', background: 'var(--voucher-note-bg)', borderRadius: '999px' }}>
                      <span style={{ width: '13px', height: '13px', borderRadius: '999px', background: accent, flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', color: 'var(--voucher-text-soft)' }}>{h.extras}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* TRANSFERS */}
        {showTransfer && (
          <div style={{ marginBottom: '42px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '22px' }}>
              <span style={sectionLabel}>Transfers</span>
              <hr style={accentLine} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {transfers.filter(t => t.from || t.to).map((t, i) => (
                <div key={i} className="pdf-keep" style={{ paddingBottom: '14px', borderBottom: '1px solid var(--voucher-divider)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--voucher-text-soft)', marginBottom: '4px' }}>
                    {[t.date, t.type].filter(Boolean).map((x, idx, arr) => (
                      <span key={idx}>{idx===0 ? <strong style={{ color: 'var(--voucher-text)', fontWeight: 700 }}>{x}</strong> : x}{idx < arr.length-1 ? '  ·  ' : ''}</span>
                    ))}
                  </div>
                  <div style={{ fontFamily: serif, fontSize: '18px', color: 'var(--voucher-text)' }}>
                    {t.from || '—'} <span style={{ color: 'var(--voucher-text-muted)' }}>→</span> {t.to || '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GUESTS */}
        {guests.length > 0 && (
          <div style={{ marginBottom: '42px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '22px' }}>
              <span style={sectionLabel}>Guests</span>
              <hr style={accentLine} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 40px' }}>
              {guests.map((g, i) => {
                const { name, tag } = guestParts(g)
                if (!name) return null
                return (
                  <div key={i} className="pdf-keep" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', paddingBottom: '10px', borderBottom: '1px solid var(--voucher-divider)' }}>
                    <span style={{ fontFamily: serif, fontSize: '18px', color: 'var(--voucher-text)' }}>{name}</span>
                    <span style={{ fontSize: '11px', letterSpacing: '0.1em', color: 'var(--voucher-text-muted)', whiteSpace: 'nowrap' }}>{tag}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* NOTES */}
        {voucher.notes && (
          <div style={{ marginBottom: '40px', fontSize: '13px', color: 'var(--voucher-text-soft)', lineHeight: 1.6 }}>{voucher.notes}</div>
        )}

        {/* FOOTER */}
        <hr style={{ height: '1px', background: accent, opacity: 0.5, border: 'none', marginTop: '46px', marginBottom: '20px' }} />
        <div style={{ textAlign: 'center', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--voucher-text-muted)', lineHeight: 1.9, paddingBottom: isPrint ? '20px' : '0' }}>
          <span style={{ color: accent }}>✦</span>{'  '}
          {[
            company?.footer_note || brandName,
            company?.contact_email,
            company?.contact_phone,
            company?.website_url?.replace(/^https?:\/\//, ''),
          ].filter(Boolean).join('  ·  ')}
          {'  '}<span style={{ color: accent }}>✦</span>
          {company?.office_address && (
            <div style={{ marginTop: '5px', textTransform: 'none', letterSpacing: '0.02em' }}>{company.office_address}</div>
          )}
        </div>

      </div>
    </div>
  )
}