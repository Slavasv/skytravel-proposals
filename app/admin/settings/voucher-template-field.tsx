'use client'

// Выбор дизайна ваучера для бренда (owner-only). Хранится номером: 1, 2, 3...
// Добавляешь новый дизайн — просто дописываешь пункт в OPTIONS.

import { useT } from '@/lib/i18n-client'

const OPTIONS = [
  { value: 1, label: 'Design 1', ru: 'Дизайн 1' },
  { value: 2, label: 'Design 2', ru: 'Дизайн 2' },
  // { value: 3, label: 'Design 3', ru: 'Дизайн 3' },  // раскомментируй, когда добавим Дизайн 3
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
  const t = useT()
  return (
    <div>
      <label style={labelStyle}>{t('Voucher design', 'Дизайн ваучера')}</label>
      <select name="voucher_template" defaultValue={defaultValue} style={selectStyle}>
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{t(o.label, o.ru)}</option>
        ))}
      </select>
      <div style={{ fontSize: '11px', color: 'var(--admin-text-faint)', marginTop: '6px' }}>
        {t('The client voucher design for this brand.', 'Дизайн клиентского ваучера для этого бренда.')}
      </div>
    </div>
  )
}