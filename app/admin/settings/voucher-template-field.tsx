'use client'

// Выбор дизайна ваучера для бренда (owner-only). Хранится номером: 1, 2, 3...
// Добавляешь новый дизайн — просто дописываешь пункт в OPTIONS.

const OPTIONS = [
  { value: 1, label: 'Дизайн 1' },
  { value: 2, label: 'Дизайн 2' },
  // { value: 3, label: 'Дизайн 3' },  // раскомментируй, когда добавим Дизайн 3
]

const labelStyle: React.CSSProperties = {
  fontSize: '12px', color: 'var(--admin-text-muted)', marginBottom: '4px', display: 'block',
}
const selectStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: '14px', background: 'var(--admin-input)',
  border: '1px solid var(--admin-border)', borderRadius: '6px', color: 'var(--admin-text)',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', cursor: 'pointer',
}

export default function VoucherTemplateField({ defaultValue }: { defaultValue: number }) {
  return (
    <div>
      <label style={labelStyle}>Voucher design</label>
      <select name="voucher_template" defaultValue={defaultValue} style={selectStyle}>
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <div style={{ fontSize: '11px', color: 'var(--admin-text-faint)', marginTop: '6px' }}>
        Дизайн клиентского ваучера для этого бренда.
      </div>
    </div>
  )
}