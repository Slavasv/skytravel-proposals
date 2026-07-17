import SavePdfButton from '../save-pdf-button'
import {
  type Guest, type Hotel,
  TITLE_BEFORE, CHILD_TITLES,
  renderMarkdown, parseDMY, fullYears,
} from './shared'

// ДИЗАЙН 2 — «Hotel Voucher» (макет Sky Travel).
// thead = ХЕДЕР (повтор вверху каждой страницы) + КАРТА-водяной знак (img в thead, повторяется на каждой стр.)
// tfoot = пустой СПЕЙСЕР; реальный ФУТЕР = div fixed bottom:0 (прижат к низу каждой страницы).

type VoucherRow = {
  slug: string; issue_date: string | null; greeting_for: string | null
  guests: unknown; transfers: unknown; show_transfer: boolean | null
  show_greeting: boolean | null; notes: string | null
}
type CompanyRow = {
  name: string | null; logo_url: string | null; accent_color: string | null
  tagline: string | null; greeting_message: string | null
  contact_email: string | null; contact_phone: string | null
  website_url: string | null; office_address: string | null; footer_note: string | null
  voucher_bg_url: string | null
}

const sans = "'Montserrat', system-ui, sans-serif"
const script = "'Monotype Corsiva', cursive"
const FOOTER_H = 78
// Резерв под нижний fixed-стек (фраза "Booking confirmed" + опц. приветствие + футер).
// С приветствием стек выше — берём с запасом, чтобы контент не налезал.

export default function Design2({ voucher, company, hotelsData, isPrint }: {
  voucher: VoucherRow; company: CompanyRow | null; hotelsData: Hotel[]; isPrint: boolean
}) {
  const hotels = hotelsData
  const guests: Guest[] = Array.isArray(voucher.guests) ? voucher.guests : []
  const accent = company?.accent_color || '#2E2A4A'
  const brandName = company?.name || 'Sky Travel'
  const bgUrl = company?.voucher_bg_url || ''

 // Последний check-out — на эту дату считаем возраст детей
  let lastCheckoutDate: Date | null = null
  for (const h of hotels) {
    const co = parseDMY(h.check_out)
    if (co && (!lastCheckoutDate || co > lastCheckoutDate)) lastCheckoutDate = co
  }

  const touristNames = guests.map((g) => {
    const t = g.title || ''
    // обращение выводим для всех, у кого оно есть (взрослые И дети)
    const base = t ? `${t} ${g.name || ''}`.trim() : (g.name || '')
    if (!base) return ''

    // возраст — только для детей и только если есть дата рождения и дата выезда
    const isChild = CHILD_TITLES.has(t)
    if (isChild && g.birth_date && lastCheckoutDate) {
      const birth = parseDMY(g.birth_date)
      if (birth) {
        const age = fullYears(birth, lastCheckoutDate)
        if (age >= 0) return `${base} (${age} y. o.)`
      }
    }
    return base
  }).filter(Boolean)

  const FS_TITLE = 40, FS_LABEL = 22, FS_CONFIRM = 48, FS_GREET = 15, FS_FOOTER = 20

  function Row({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '20px',
        padding: '11px 0', borderBottom: last ? 'none' : '1px dashed ' + accent,
      }}>
        <span style={{ fontSize: FS_LABEL + 'px', fontWeight: 600, color: accent, whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: FS_LABEL + 'px', fontWeight: 600, color: '#4A4A48', textAlign: 'right' }}>{value || '—'}</span>
      </div>
    )
  }

  const Header = (
    <div style={{ background: accent, padding: '18px 40px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
      {company?.logo_url ? (
        <img src={company.logo_url} alt={brandName} style={{ maxHeight: '50px', maxWidth: '190px', objectFit: 'contain' }} />
      ) : (
        <span style={{ fontFamily: script, fontStyle: 'italic', fontSize: (FS_TITLE - 4) + 'px', color: '#FFFFFF' }}>{brandName}</span>
      )}
      <span style={{ fontFamily: script, fontStyle: 'italic', fontSize: FS_TITLE + 'px', color: '#FFFFFF' }}>Hotel Voucher</span>
    </div>
  )

  const FooterInner = (
    <div style={{ background: accent, padding: '14px 40px', textAlign: 'center', color: '#FFFFFF', minHeight: FOOTER_H + 'px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '28px', fontSize: FS_FOOTER + 'px', fontWeight: 500 }}>
        {company?.contact_phone && <span>{company.contact_phone}</span>}
        {company?.contact_email && <span>{company.contact_email}</span>}
        {company?.website_url && <span>{company.website_url.replace(/^https?:\/\//, '')}</span>}
      </div>
      {company?.office_address && (
        <div style={{ marginTop: '5px', fontSize: (FS_FOOTER - 6) + 'px', opacity: 0.85 }}>{company.office_address}</div>
      )}
    </div>
  )

  return (
    <div style={{ background: isPrint ? '#FBF7F0' : '#EFE9DF', minHeight: '100vh', padding: isPrint ? '0' : '40px 20px 80px', fontFamily: sans, color: '#2C2C2A' }}>
      {!isPrint && <SavePdfButton slug={voucher.slug} />}

      <div id="voucher-doc" style={{
        maxWidth: isPrint ? '100%' : '780px', margin: '0 auto',
        position: 'relative',
        backgroundColor: '#FBF7F0',
      }}>
        {bgUrl && (
          <img
            src={bgUrl}
            alt=""
            className="d2-watermark"
            style={{
              position: 'absolute',
              top: '100px', left: '50%', transform: 'translateX(-50%)',
              width: '98%', height: 'auto',
              zIndex: 0, pointerEvents: 'none',
            }}
          />
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
            .d2-watermark { position: fixed !important; top: 100px !important; }
          }
        `}</style>

        <table className="d2-table" style={{ position: 'relative', zIndex: 1 }}>
          <thead><tr><td style={{ padding: 0 }}>{Header}</td></tr></thead>
          <tfoot><tr><td><div style={{ height: (FOOTER_H + (voucher.show_greeting && company?.greeting_message ? 200 : 90)) + 'px' }} /></td></tr></tfoot>
          <tbody><tr><td>
            <div style={{ padding: '0 50px 20px' }}>
              {hotels.map((h, i) => {
                const cityCountry = [h.city, h.country].filter(Boolean).join(' / ')
                return (
                  <div key={h.id} className="pdf-keep" style={{ marginBottom: i < hotels.length - 1 ? '34px' : '10px' }}>
                    <Row label="City/Country:" value={cityCountry} />
                    <Row label="Hotel:" value={h.name || ''} />
                    <Row label="Address:" value={h.address || ''} />
                    <Row label="Phone:" value={h.phone || ''} />
                    <Row label="Check-in:" value={h.check_in || ''} />
                    <Row label="Check-out:" value={h.check_out || ''} />
                    <Row label="Total nights:" value={h.nights || ''} />
                    <Row label="Booking No.:" value={h.booking_ref || ''} />
                    <Row label="Room type:" value={h.room_type || ''} />
                    <Row label="Meal type:" value={h.meal_plan || ''} />
                    <Row label="Tourist Name(s):" last={!h.extras} value={
                      touristNames.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                          {touristNames.map((n, idx) => <span key={idx}>{n}</span>)}
                        </div>
                      ) : '—'
                    } />
                    {h.extras && (
                      <Row label="Notes:" last value={
                        <span style={{ whiteSpace: 'pre-wrap' }}>{h.extras}</span>
                      } />
                    )}
                  </div>
                )
              })}

              </div>
          </td></tr></tbody>
        </table>

        <div className="d2-foot-real">
          <div className="pdf-keep" style={{ textAlign: 'center', padding: '0 40px 18px' }}>
            <div style={{ fontFamily: script, fontStyle: 'italic', fontSize: FS_CONFIRM + 'px', color: accent, lineHeight: 1.1 }}>
              Booking confirmed and paid
            </div>
            {voucher.show_greeting && company?.greeting_message && (
              <div style={{ fontSize: FS_GREET + 'px', fontWeight: 400, lineHeight: 1.7, color: '#4A4A48', maxWidth: '560px', margin: '10px auto 0', textAlign: 'center' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(company.greeting_message) }} />
            )}
          </div>
          {FooterInner}
        </div>

      </div>
    </div>
  )
}