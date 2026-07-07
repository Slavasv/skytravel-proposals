'use client'

export default function SavePdfButton() {
  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          #voucher-doc { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; }
        }
      `}</style>
      <div className="no-print" style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 100 }}>
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            padding: '10px 20px', fontSize: '13px', fontWeight: 500, letterSpacing: '0.03em',
            background: '#2C2C2A', color: '#FAF8F4', border: 'none', borderRadius: '8px',
            cursor: 'pointer', fontFamily: 'system-ui, sans-serif', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          }}
        >
          ↓ Save PDF
        </button>
      </div>
    </>
  )
}