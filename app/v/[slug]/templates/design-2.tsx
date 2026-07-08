import SavePdfButton from '../save-pdf-button'
import {
  type Guest, type Hotel,
  TITLE_BEFORE,
  parseDMY, prettyIssue, renderMarkdown,
} from './shared'

// ДИЗАЙН 2 — «Hotel Voucher» (макет Sky Travel).
// Тёмная шапка/футер/метки — акцентный цвет бренда (accent_color).
// Шрифты: Montserrat (текст) + Pinyon Script (акцентный курсив — временно вместо Monotype Corsiva).

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

  // имена туристов одной строкой (с титулом для Mr/Mrs/Miss/Mstr)
  const touristNames = guests.map((g) => {
    const t = g.title || ''
    return TITLE_BEFORE.has(t) ? `${t} ${g.name || ''}`.trim() : (g.name || '')
  }).filter(Boolean).join(', ')

  // строка данных: метка слева (акцент), значение справа, пунктир снизу
  function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '20px',
        padding: '12px 0',
        borderBottom: last ? 'none' : '1px dashed ' + accent,
      }}>
        <span style={{ fontSize: '17px', fontWeight: 700, color: accent, whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: '16px', color: '#4A4A48', textAlign: 'right' }}>{value || '—'}</span>
      </div>
    )
  }

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
          .print-table { width: 100%; border-collapse: collapse; }
          .print-spacer { height: 0; }
        `}</style>

        <table className="print-table">
          {isPrint && <thead><tr><td><div className="print-spacer" /></td></tr></thead>}
          <tbody><tr><td>

        {/* ШАПКА — тёмная (акцент бренда) */}
        <div style={{ background: accent, padding: '28px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
          {company?.logo_url ? (
            <img src={company.logo_url} alt={brandName} style={{ maxHeight: '52px', maxWidth: '200px', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontFamily: script, fontSize: '34px', color: '#FFFFFF' }}>{brandName}</span>
          )}
          <span style={{ fontFamily: script, fontSize: '38px', color: '#FFFFFF' }}>Hotel Voucher</span>
        </div>

        {/* ТЕЛО */}
        <div style={{ padding: '40px 50px 30px' }}>

          {/* Блок на каждый отель */}
          {hotels.map((h, i) => {
            const cityCountry = [h.city, h.country].filter(Boolean).join(' / ')
            const inD = parseDMY(h.check_in), outD = parseDMY(h.check_out)
            const fmtD = (d: Date | null, raw: string | null) => raw || (d ? '' : '')
            return (
              <div key={h.id} className="pdf-keep" style={{ marginBottom: i < hotels.length - 1 ? '40px' : '20px' }}>
                <Row label="City/Country:" value={cityCountry} />
                <Row label="Hotel:" value={h.name || ''} />
                <Row label="Address:" value={h.address || ''} />
                <Row label="Phone:" value={h.phone || ''} />
                <Row label="Check-in:" value={fmtD(inD, h.check_in)} />
                <Row label="Check-out:" value={fmtD(outD, h.check_out)} />
                <Row label="Total nights:" value={h.nights || ''} last />

                <div style={{ height: '24px' }} />

                <Row label="Booking No.:" value={h.booking_ref || ''} />
                <Row label="Room type:" value={h.room_type || ''} />
                <Row label="Meal type:" value={h.meal_plan || ''} />
                <Row label="Tourist Name(s):" value={touristNames} last />
              </div>
            )
          })}

          {/* Booking confirmed and paid + приветствие */}
          <div className="pdf-keep" style={{ textAlign: 'center', marginTop: '50px', marginBottom: '30px' }}>
            <div style={{ fontFamily: script, fontSize: '46px', color: accent, lineHeight: 1.1, marginBottom: '20px' }}>
              Booking confirmed and paid
            </div>
            {company?.greeting_message && (
              <div style={{ fontSize: '15px', lineHeight: 1.7, color: '#4A4A48', maxWidth: '560px', margin: '0 auto' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(company.greeting_message) }} />
            )}
          </div>

        </div>

        {/* ФУТЕР — тёмный (акцент бренда) */}
        <div style={{ background: accent, padding: '22px 40px', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '30px', fontSize: '15px', color: '#FFFFFF' }}>
          {company?.contact_phone && <span>{company.contact_phone}</span>}
          {company?.contact_email && <span>{company.contact_email}</span>}
          {company?.website_url && <span>{company.website_url.replace(/^https?:\/\//, '')}</span>}
          {company?.office_address && <span>{company.office_address}</span>}
        </div>

          </td></tr></tbody>
          {isPrint && <tfoot><tr><td><div className="print-spacer" /></td></tr></tfoot>}
        </table>

      </div>
    </div>
  )
}