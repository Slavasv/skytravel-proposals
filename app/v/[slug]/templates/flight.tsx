import SavePdfButton from '../save-pdf-button'
import { renderMarkdown } from './shared'
import { normalizeFlightData, type FlightSegment } from '@/lib/flight-voucher'

// АВИАВАУЧЕР — та же «шкура», что Дизайн 2 гостиничного (Sky Travel):
// тёмная шапка = accent_color бренда (лого + скрипт-заголовок), кремовый фон +
// карта-подложка (voucher_bg_url), тёмный футер с контактами. Всё из бренда/globals.
// thead = шапка + карта (повтор на каждой стр.), tfoot = спейсер, футер = fixed bottom.

type VoucherRow = {
  slug: string; issue_date: string | null
  show_greeting: boolean | null; flight_data: unknown
}
type CompanyRow = {
  name: string | null; logo_url: string | null; accent_color: string | null
  greeting_message: string | null
  contact_email: string | null; contact_phone: string | null
  website_url: string | null; office_address: string | null
  voucher_bg_url: string | null
}

const sans = "'Montserrat', system-ui, sans-serif"
const script = "'Monotype Corsiva', cursive"
const FOOTER_H = 78

export default function FlightTemplate({ voucher, company, isPrint }: {
  voucher: VoucherRow; company: CompanyRow | null; isPrint: boolean
}) {
  const f = normalizeFlightData(voucher.flight_data)
  const accent = company?.accent_color || '#2E2A4A'
  const brandName = company?.name || 'Travel System'
  const bgUrl = company?.voucher_bg_url || ''

  const hasReturn = f.return.some((s) => s.flight_no || s.from || s.to)
  const pax = f.passengers.filter((p) => p.name || p.cabin || p.checked || p.extras || p.seats_out || p.seats_ret)
  const hasSeats = pax.some((p) => p.seats_out || p.seats_ret)
  const showGreeting = !!(voucher.show_greeting && company?.greeting_message)

  const FS_TITLE = 'clamp(22px, 5.5vw, 40px)'
  const FS_CONFIRM = 'clamp(24px, 7vw, 48px)'
  const FS_GREET = 'clamp(13px, 2.6vw, 15px)'
  const FS_FOOTER = 'clamp(12px, 3vw, 20px)'
  const FS_ADDR = 'clamp(11px, 2.4vw, 14px)'

  const sectionTitle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '15px', fontWeight: 700, color: accent, letterSpacing: '0.06em',
    textTransform: 'uppercase', margin: '26px 0 8px',
  }
  const th: React.CSSProperties = {
    fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
    color: accent, padding: '7px 8px', textAlign: 'center', borderBottom: `1.5px solid ${accent}`,
  }
  const thL: React.CSSProperties = { ...th, textAlign: 'left' }
  const td: React.CSSProperties = {
    fontSize: '13.5px', color: '#4A4A48', padding: '10px 8px', textAlign: 'center',
    borderBottom: `1px dashed ${accent}`,
  }
  const tdL: React.CSSProperties = { ...td, textAlign: 'left' }

  function FlightTable({ label, segs }: { label: string; segs: FlightSegment[] }) {
    const rows = segs.filter((s) => s.flight_no || s.from || s.to || s.dep || s.arr || s.duration || s.note)
    if (rows.length === 0) return null
    return (
      <div className="pdf-keep" style={{ marginBottom: '6px' }}>
        <div style={sectionTitle}><span>✈</span><span>{label}</span></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thL, width: '16%' }}>Flight</th>
              <th style={{ ...th, width: '24%' }}>Route</th>
              <th style={{ ...th, width: '24%' }}>Time</th>
              <th style={{ ...th, width: '16%' }}>Duration</th>
              <th style={{ ...th, width: '20%' }}>Connection</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={i}>
                <td style={{ ...tdL, fontWeight: 700, color: '#2C2C2A', borderBottom: i === rows.length - 1 ? 'none' : td.borderBottom }}>{s.flight_no}</td>
                <td style={{ ...td, borderBottom: i === rows.length - 1 ? 'none' : td.borderBottom }}>{[s.from, s.to].filter(Boolean).join(' → ')}</td>
                <td style={{ ...td, borderBottom: i === rows.length - 1 ? 'none' : td.borderBottom }}>{[s.dep, s.arr].filter(Boolean).join(' → ')}</td>
                <td style={{ ...td, borderBottom: i === rows.length - 1 ? 'none' : td.borderBottom }}>{s.duration}</td>
                <td style={{ ...td, color: '#8a8880', whiteSpace: 'pre-line', borderBottom: i === rows.length - 1 ? 'none' : td.borderBottom }}>{s.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const Header = (
    <div className="d2-bar" style={{ background: accent, padding: '18px 40px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
      {company?.logo_url ? (
        <img src={company.logo_url} alt={brandName} style={{ maxHeight: '50px', maxWidth: '190px', objectFit: 'contain' }} />
      ) : (
        <span style={{ fontFamily: script, fontStyle: 'italic', fontSize: FS_TITLE, color: '#FFFFFF' }}>{brandName}</span>
      )}
      <span style={{ fontFamily: script, fontStyle: 'italic', fontSize: FS_TITLE, color: '#FFFFFF' }}>Flight Voucher</span>
    </div>
  )

  const FooterInner = (
    <div className="d2-bar" style={{ background: accent, padding: '14px 50px', textAlign: 'center', color: '#FFFFFF', minHeight: FOOTER_H + 'px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', fontSize: FS_FOOTER, fontWeight: 500 }}>
        {company?.contact_phone && <span>{company.contact_phone}</span>}
        {company?.contact_email && <span>{company.contact_email}</span>}
        {company?.website_url && <span>{company.website_url.replace(/^https?:\/\//, '')}</span>}
      </div>
      {company?.office_address && (
        <div style={{ marginTop: '5px', fontSize: FS_ADDR, opacity: 0.85 }}>{company.office_address}</div>
      )}
    </div>
  )

  return (
    <div style={{ background: isPrint ? '#FBF7F0' : '#EFE9DF', minHeight: '100vh', padding: isPrint ? '0' : '40px 20px 80px', fontFamily: sans, color: '#2C2C2A' }}>
      {!isPrint && <SavePdfButton slug={voucher.slug} />}

      <div id="voucher-doc" style={{ maxWidth: isPrint ? '100%' : '780px', margin: '0 auto', position: 'relative', backgroundColor: '#FBF7F0' }}>
        {bgUrl && (
          <img src={bgUrl} alt="" className="d2-watermark" style={{ position: 'absolute', top: '120px', left: '50%', transform: 'translateX(-50%)', width: '92%', height: 'auto', zIndex: 0, pointerEvents: 'none' }} />
        )}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>{`
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { margin: 0; padding: 0; background: #FBF7F0; }
          @page { margin: 0; }
          .pdf-keep { break-inside: avoid; page-break-inside: avoid; }
          .d2-table { width: 100%; border-collapse: collapse; }
          .d2-foot-real { position: absolute; bottom: 0; left: 0; right: 0; }
          @media print {
            .d2-foot-real { position: fixed; bottom: 0; left: 0; right: 0; z-index: 5; }
            .d2-watermark { position: fixed !important; top: 120px !important; }
          }
          @media (max-width: 640px) {
            .d2-foot-real { position: static !important; }
            .d2-foot-spacer { display: none !important; }
            .d2-bar { padding-left: 16px !important; padding-right: 16px !important; }
            .d2-inner { padding-left: 16px !important; padding-right: 16px !important; }
          }
        `}</style>

        <table className="d2-table" style={{ position: 'relative', zIndex: 1 }}>
          <thead><tr><td style={{ padding: 0 }}>{Header}</td></tr></thead>
          <tfoot><tr><td><div className="d2-foot-spacer" style={{ height: (FOOTER_H + (showGreeting ? 200 : 90)) + 'px' }} /></td></tr></tfoot>
          <tbody><tr><td>
            <div className="d2-inner" style={{ padding: '0 50px 20px' }}>

              {/* код брони / авиакомпания / дата */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px', paddingTop: '12px', flexWrap: 'wrap' }}>
                <div>
                  {f.pnr && <div style={{ fontSize: '20px', fontWeight: 700, color: accent }}>Code: {f.pnr}</div>}
                  {f.airline && <div style={{ fontSize: '14px', color: '#4A4A48', marginTop: '2px' }}>{f.airline}</div>}
                </div>
                {voucher.issue_date && (
                  <div style={{ fontSize: '12px', color: '#8a8880', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Issue date: {voucher.issue_date}
                  </div>
                )}
              </div>

              <FlightTable label={`Outbound flight${f.outbound_label ? ` — ${f.outbound_label}` : ''}`} segs={f.outbound} />
              {hasReturn && <FlightTable label={`Return flight${f.return_label ? ` — ${f.return_label}` : ''}`} segs={f.return} />}

              {pax.length > 0 && (
                <div className="pdf-keep" style={{ marginBottom: '6px' }}>
                  <div style={sectionTitle}><span>👤</span><span>Passengers &amp; baggage</span></div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...thL, width: '25%' }}>Passenger</th>
                        <th style={{ ...th, width: '23%' }}>Cabin bag</th>
                        <th style={{ ...th, width: '25%' }}>Checked bag</th>
                        <th style={{ ...th, width: '27%' }}>Extras</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pax.map((p, i) => {
                        const b = i === pax.length - 1 ? 'none' : td.borderBottom
                        return (
                          <tr key={p.id}>
                            <td style={{ ...tdL, fontWeight: 700, color: '#2C2C2A', borderBottom: b }}>{p.name}</td>
                            <td style={{ ...td, borderBottom: b }}>{p.cabin || '—'}</td>
                            <td style={{ ...td, borderBottom: b }}>{p.checked || '—'}</td>
                            <td style={{ ...td, borderBottom: b }}>{p.extras || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {hasSeats && (
                <div className="pdf-keep" style={{ marginBottom: '6px' }}>
                  <div style={sectionTitle}><span>💺</span><span>Seats</span></div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...thL, width: '34%' }}>Passenger</th>
                        <th style={{ ...th, width: '33%' }}>Outbound</th>
                        <th style={{ ...th, width: '33%' }}>Return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pax.map((p, i) => {
                        const b = i === pax.length - 1 ? 'none' : td.borderBottom
                        return (
                          <tr key={p.id}>
                            <td style={{ ...tdL, fontWeight: 700, color: '#2C2C2A', borderBottom: b }}>{p.name}</td>
                            <td style={{ ...td, borderBottom: b }}>{p.seats_out || '—'}</td>
                            <td style={{ ...td, borderBottom: b }}>{p.seats_ret || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </td></tr></tbody>
        </table>

        <div className="d2-foot-real">
          <div className="pdf-keep" style={{ textAlign: 'center', padding: '0 40px 18px' }}>
            <div style={{ fontFamily: script, fontStyle: 'italic', fontSize: FS_CONFIRM, color: accent, lineHeight: 1.1 }}>
              Booking confirmed and paid
            </div>
            {showGreeting && (
              <div style={{ fontSize: FS_GREET, fontWeight: 400, lineHeight: 1.7, color: '#4A4A48', maxWidth: '620px', margin: '10px auto 0', textAlign: 'center' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(company!.greeting_message!) }} />
            )}
          </div>
          {FooterInner}
        </div>

      </div>
    </div>
  )
}
