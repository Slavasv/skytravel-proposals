import SavePdfButton from '../save-pdf-button'
import {
  type Guest, type Hotel,
  TITLE_BEFORE,
  parseDMY, renderMarkdown,
} from './shared'

// ДИЗАЙН 2 — «Hotel Voucher» (макет Sky Travel).
// Тёмная шапка/футер/метки — акцентный цвет бренда (accent_color).
// Хедер повторяется вверху каждой страницы (thead), футер внизу (tfoot).
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

export default function Design2({ voucher, company, hotelsData, isPrint }: {
  voucher: VoucherRow; company: CompanyRow | null; hotelsData: Hotel[]; isPrint: boolean
}) {
  const hotels = hotelsData
  const guests: Guest[] = Array.isArray(voucher.guests) ? voucher.guests : []
  const accent = company?.accent_color || '#2E2A4A'
  const brandName = company?.name || 'Sky Travel'

  // имена туристов — массив строк (в столбик), с титулом для Mr/Mrs/Miss/Mstr
  const touristNames = guests.map((g) => {
    const t = g.title || ''
    return TITLE_BEFORE.has(t) ? `${t} ${g.name || ''}`.trim() : (g.name || '')
  }).filter(Boolean)

  // строка данных: метка слева (акцент, жирная), значение справа, пунктир снизу
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

  // тёмная шапка (повторяется на каждой странице)
  const Header = (
    <div style={{ background: accent, padding: '26px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
      {company?.logo_url ? (
        <img src={company.logo_url} alt={brandName} style={{ maxHeight: '48px', maxWidth: '190px', objectFit: 'contain' }} />
      ) : (
        <span style={{ fontFamily: script, fontSize: '32px', color: '#FFFFFF' }}>{brandName}</span>
      )}
      <span style={{ fontFamily: script, fontSize: '36px', color: '#FFFFFF' }}>Hotel Voucher</span>
    </div>
  )

  // тёмный футер (повторяется на каждой странице)
  const Footer = (
    <div style={{ background: accent, padding: '20px 40px', textAlign: 'center', color: '#FFFFFF' }}>
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '28px', fontSize: '14px' }}>
        {company?.contact_phone && <span>{company.contact_phone}</span>}
        {company?.contact_email && <span>{company.contact_email}</span>}
        {company?.website_url && <span>{company.website_url.replace(/^https?:\/\//, '')}</span>}
      </div>
      {company?.office_address && (
        <div style={{ marginTop: '10px', fontSize: '13px', opacity: 0.85 }}>{company.office_address}</div>
      )}
    </div>
  )

  return (
    <div style={{
      background: isPrint ? '#FBF7F0' : '#EFE9DF', minHeight: '100vh',
      padding: isPrint ? '0' : '40px 20px 80px', fontFamily: sans, color: '#2C2C2A',
    }}>
      {!isPrint && <SavePdfButton slug={voucher.slug} />}

      <div id="voucher-doc" style={{ maxWidth: isPrint ? '100%' : '780px', margin: '0 auto', background: '#FBF7F0', boxShadow: isPrint ? 'none' : '0 1px 40px rgba(0,0,0,0.07)' }}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;700&family=Pinyon+Script&display=swap" rel="stylesheet" />
        <style>{`
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { margin: 0; padding: 0; background: #FBF7F0; }
          @page { margin: 0; }
          .pdf-keep { break-inside: avoid; page-break-inside: avoid; }
          .d2-table { width: 100%; border-collapse: collapse; }
        `}</style>

        {/* Хедер в thead — повторяется вверху каждой страницы; футер в tfoot — внизу каждой */}
        <table className="d2-table">
          <thead><tr><td>{Header}</td></tr></thead>
          <tfoot><tr><td>{Footer}</td></tr></tfoot>
          <tbody><tr><td>

            <div style={{ padding: '36px 50px 30px' }}>

              {/* Блок на каждый отель */}
              {hotels.map((h, i) => {
                const cityCountry = [h.city, h.country].filter(Boolean).join(' / ')
                const inRaw = h.check_in || (parseDMY(h.check_in) ? '' : '')
                const outRaw = h.check_out || (parseDMY(h.check_out) ? '' : '')
                return (
                  <div key={h.id} className="pdf-keep" style={{ marginBottom: i < hotels.length - 1 ? '36px' : '10px' }}>
                    <Row label="City/Country:" value={cityCountry} />
                    <Row label="Hotel:" value={h.name || ''} />
                    <Row label="Address:" value={h.address || ''} />
                    <Row label="Phone:" value={h.phone || ''} />
                    <Row label="Check-in:" value={inRaw} />
                    <Row label="Check-out:" value={outRaw} />
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

              {/* Booking confirmed and paid + приветствие — только один раз, в конце, по центру */}
              <div className="pdf-keep" style={{ textAlign: 'center', marginTop: '50px', marginBottom: '20px' }}>
                <div style={{ fontFamily: script, fontSize: '44px', color: accent, lineHeight: 1.1, marginBottom: '18px' }}>
                  Booking confirmed and paid
                </div>
                {company?.greeting_message && (
                  <div style={{ fontSize: '15px', lineHeight: 1.7, color: '#4A4A48', maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(company.greeting_message) }} />
                )}
              </div>

            </div>

          </td></tr></tbody>
        </table>

      </div>
    </div>
  )
}