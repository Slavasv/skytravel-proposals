import SavePdfButton from '../save-pdf-button'
import {
  type Guest, type Hotel,
  TITLE_BEFORE,
  renderMarkdown,
} from './shared'

// ДИЗАЙН 2 — «Hotel Voucher» (макет Sky Travel).
// Хедер/футер — position:fixed: Chrome при печати повторяет их на КАЖДОЙ странице,
// строго прижатыми к верху/низу листа (включая последнюю, без пустот).
// Контент получает отступы сверху/снизу под них.
// Шрифты: Montserrat (текст) + Pinyon Script (курсив — временно вместо Monotype Corsiva).

type VoucherRow = {
  slug: string; issue_date: string | null; greeting_for: string | null
  guests: unknown; transfers: unknown; show_transfer: boolean | null; notes: string | null
}
type CompanyRow = {
  name: string | null; logo_url: string | null; accent_color: string | null
  tagline: string | null; greeting_message: string | null
  contact_email: string | null; contact_phone: string | null
  website_url: string | null; office_address: string | null; footer_note: string | null
}

const sans = "'Montserrat', system-ui, sans-serif"
const script = "'Pinyon Script', 'Monotype Corsiva', cursive"

// высоты повторяющихся зон (под них — отступы контента)
const HEADER_H = 100 // px
const FOOTER_H = 96  // px

export default function Design2({ voucher, company, hotelsData, isPrint }: {
  voucher: VoucherRow; company: CompanyRow | null; hotelsData: Hotel[]; isPrint: boolean
}) {
  const hotels = hotelsData
  const guests: Guest[] = Array.isArray(voucher.guests) ? voucher.guests : []
  const accent = company?.accent_color || '#2E2A4A'
  const brandName = company?.name || 'Sky Travel'

  const touristNames = guests.map((g) => {
    const t = g.title || ''
    return TITLE_BEFORE.has(t) ? `${t} ${g.name || ''}`.trim() : (g.name || '')
  }).filter(Boolean)

  function Row({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '20px',
        padding: '12px 0',
        borderBottom: last ? 'none' : '1px dashed ' + accent,
      }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: accent, whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: '15px', color: '#4A4A48', textAlign: 'right' }}>{value || '—'}</span>
      </div>
    )
  }

  return (
    <div style={{
      background: isPrint ? '#FBF7F0' : '#EFE9DF', minHeight: '100vh',
      padding: isPrint ? '0' : '40px 20px 80px', fontFamily: sans, color: '#2C2C2A',
    }}>
      {!isPrint && <SavePdfButton slug={voucher.slug} />}

      <div id="voucher-doc" style={{ maxWidth: isPrint ? '100%' : '780px', margin: '0 auto', background: '#FBF7F0', boxShadow: isPrint ? 'none' : '0 1px 40px rgba(0,0,0,0.07)', position: 'relative' }}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700&family=Pinyon+Script&display=swap" rel="stylesheet" />
        <style>{`
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { margin: 0; padding: 0; background: #FBF7F0; }
          @page { margin: 0; }
          .pdf-keep { break-inside: avoid; page-break-inside: avoid; }
          /* хедер/футер: fixed — Chrome повторяет их на каждой печатной странице у краёв листа */
          .d2-header { position: fixed; top: 0; left: 0; right: 0; height: ${HEADER_H}px; box-sizing: border-box; }
          .d2-footer { position: fixed; bottom: 0; left: 0; right: 0; height: ${FOOTER_H}px; box-sizing: border-box; }
          /* контент отступает под хедер/футер, чтобы не залезать под них на каждой странице */
          .d2-content { padding-top: ${HEADER_H + 24}px; padding-bottom: ${FOOTER_H + 24}px; padding-left: 50px; padding-right: 50px; }
        `}</style>

        {/* ХЕДЕР — тёмная шапка (акцент бренда), на каждой странице вверху */}
        <div className="d2-header" style={{ background: accent, padding: '0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
          {company?.logo_url ? (
            <img src={company.logo_url} alt={brandName} style={{ maxHeight: '52px', maxWidth: '190px', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontFamily: script, fontSize: '32px', color: '#FFFFFF' }}>{brandName}</span>
          )}
          <span style={{ fontFamily: script, fontSize: '36px', color: '#FFFFFF' }}>Hotel Voucher</span>
        </div>

        {/* ФУТЕР — тёмная полоса (акцент бренда), на каждой странице внизу */}
        <div className="d2-footer" style={{ background: accent, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#FFFFFF', padding: '0 40px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '28px', fontSize: '14px' }}>
            {company?.contact_phone && <span>{company.contact_phone}</span>}
            {company?.contact_email && <span>{company.contact_email}</span>}
            {company?.website_url && <span>{company.website_url.replace(/^https?:\/\//, '')}</span>}
          </div>
          {company?.office_address && (
            <div style={{ marginTop: '8px', fontSize: '13px', opacity: 0.85 }}>{company.office_address}</div>
          )}
        </div>

        {/* КОНТЕНТ — с отступами под хедер/футер */}
        <div className="d2-content">

          {hotels.map((h, i) => {
            const cityCountry = [h.city, h.country].filter(Boolean).join(' / ')
            return (
              <div key={h.id} className="pdf-keep" style={{ marginBottom: i < hotels.length - 1 ? '36px' : '10px' }}>
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
                <Row
                  label="Tourist Name(s):"
                  last
                  value={
                    touristNames.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                        {touristNames.map((n, idx) => <span key={idx}>{n}</span>)}
                      </div>
                    ) : '—'
                  }
                />
              </div>
            )
          })}

          {/* Booking confirmed and paid + приветствие — один раз, в конце, по центру */}
          <div className="pdf-keep" style={{ textAlign: 'center', marginTop: '50px', marginBottom: '10px' }}>
            <div style={{ fontFamily: script, fontSize: '44px', color: accent, lineHeight: 1.1, marginBottom: '18px' }}>
              Booking confirmed and paid
            </div>
            {company?.greeting_message && (
              <div style={{ fontSize: '15px', lineHeight: 1.7, color: '#4A4A48', maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(company.greeting_message) }} />
            )}
          </div>

        </div>

      </div>
    </div>
  )
}