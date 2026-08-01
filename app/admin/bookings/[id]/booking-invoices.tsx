'use client'

import { useState, useRef, useEffect } from 'react'
import { addInvoice, updateInvoice, deleteInvoice, type SupplierInvoice } from '../invoice-actions'
import { getBookingServices, type PartnerOption, type BookingService } from '../actions'
import PartnerPicker from '@/app/admin/_components/partner-picker'
import { useT } from '@/lib/i18n-client'

const CURRENCIES = ['EUR', 'USD', 'AED', 'CHF', 'GBP']

const labelSt: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', fontWeight: 500, display: 'block', marginBottom: '4px',
}
const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: '13px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '4px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function InvoiceCard({
  invoice, partners, services, onRemove, onChange,
}: {
  invoice: SupplierInvoice
  partners: PartnerOption[]
  services: BookingService[]
  onRemove: (id: string) => void
  onChange: (id: string, patch: Partial<SupplierInvoice>) => void
}) {
  const t = useT()
  const [pullOpen, setPullOpen] = useState(false)
  const [form, setForm] = useState({
    partner_id: invoice.partner_id || '',
    invoice_number: invoice.invoice_number || '',
    amount: invoice.amount ?? ('' as number | ''),
    currency: invoice.currency || 'EUR',
    issue_date: invoice.issue_date || '',
    due_date: invoice.due_date || '',
    notes: invoice.notes || '',
  })
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const first = useRef(true)

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((p) => ({ ...p, [key]: value }))
    setSaved(false)
  }

  // подтянуть услугу брони в счёт: сумма += нетто (стоимость поставщика), описание → в заметку
  function pullService(s: BookingService) {
    setPullOpen(false)
    const cost = s.net ?? s.gross ?? 0
    setForm((p) => ({
      ...p,
      amount: (p.amount === '' ? 0 : Number(p.amount)) + cost,
      currency: s.currency || p.currency,
      notes: [p.notes, s.description].filter(Boolean).join('; '),
    }))
    setSaved(false)
  }

  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const amountNum = form.amount === '' ? 0 : Number(form.amount)
      await updateInvoice(invoice.id, {
        partner_id: form.partner_id || null,
        invoice_number: form.invoice_number || null,
        amount: amountNum,
        currency: form.currency,
        issue_date: form.issue_date || null,
        due_date: form.due_date || null,
        notes: form.notes || null,
      })
      onChange(invoice.id, { amount: amountNum, currency: form.currency })
      setSaved(true)
    }, 1200)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  return (
    <div style={{ border: '1px solid var(--admin-border-card)', borderRadius: '10px', padding: '14px', background: 'var(--admin-card)' }}>
      {/* строка 1: поставщик, номер счёта */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div style={{ width: '220px' }}>
          <label style={labelSt}>{t('Supplier', 'Поставщик')}</label>
          <PartnerPicker
            partners={partners}
            value={form.partner_id}
            onChange={(id) => set('partner_id', id)}
            returnTo={`/admin/bookings/${invoice.booking_id}`}
          />
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={labelSt}>{t('Invoice №', 'Инвойс №')}</label>
          <input type="text" value={form.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} style={inputSt} placeholder="INV-2026-001" />
        </div>
      </div>

      {/* строка 2: сумма, валюта, даты */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '10px' }}>
        <div style={{ width: '140px' }}>
          <label style={labelSt}>{t('Amount', 'Сумма')}</label>
          <input type="number" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value === '' ? '' : Number(e.target.value))} style={inputSt} placeholder="0" />
        </div>
        <div style={{ width: '90px' }}>
          <label style={labelSt}>{t('Currency', 'Валюта')}</label>
          <select value={form.currency} onChange={(e) => set('currency', e.target.value)} style={inputSt}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ width: '150px' }}>
          <label style={labelSt}>{t('Issue date', 'Дата выставления')}</label>
          <input type="date" value={form.issue_date} onChange={(e) => set('issue_date', e.target.value)} style={inputSt} />
        </div>
        <div style={{ width: '150px' }}>
          <label style={labelSt}>{t('Due date', 'Срок оплаты')}</label>
          <input type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} style={inputSt} />
        </div>
      </div>

      {/* заметка */}
      <div style={{ marginBottom: '10px' }}>
        <label style={labelSt}>{t('Note (optional)', 'Заметка (необязательно)')}</label>
        <input type="text" value={form.notes} onChange={(e) => set('notes', e.target.value)} style={inputSt} placeholder={t('What this invoice covers…', 'За что этот счёт…')} />
      </div>

      {/* подтянуть услуги брони (можно несколько — один поставщик, оба отеля) */}
      {services.length > 0 && (
        <div style={{ position: 'relative', marginBottom: '10px' }}>
          <button type="button" onClick={() => setPullOpen((v) => !v)}
            style={{ padding: '7px 12px', fontSize: '12px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('+ Add from booking services ▾', '+ Добавить из услуг брони ▾')}
          </button>
          {pullOpen && (
            <>
              <div onClick={() => setPullOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20, minWidth: '300px', maxWidth: '440px', maxHeight: '300px', overflowY: 'auto', background: 'var(--admin-input)', border: '1px solid var(--admin-border)', borderRadius: '10px', padding: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                {services.map((s) => {
                  const cost = s.net ?? s.gross ?? 0
                  return (
                    <button key={s.id} type="button" onClick={() => pullService(s)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--admin-text)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--admin-card)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                      <span style={{ fontSize: '13px' }}>{s.description || s.service_type || '—'}</span>
                      <span style={{ color: 'var(--admin-text-muted)' }}> · {money(cost)} {s.currency || 'EUR'}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
          <p style={{ fontSize: '10px', color: 'var(--admin-text-faint)', margin: '4px 0 0' }}>
            {t('Adds the service cost (net) to the amount and its name to the note. Pull several if one supplier covers multiple services.',
               'Добавляет стоимость услуги (нетто) к сумме, а название — в заметку. Можно подтянуть несколько, если один поставщик закрывает сразу несколько услуг.')}
          </p>
        </div>
      )}

      {/* действия */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: saved ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
          {saved ? t('● Saved', '● Сохранено') : ''}
        </span>
        <button type="button" onClick={() => onRemove(invoice.id)}
          style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '5px 9px', fontFamily: 'inherit' }}>
          {t('✕ Remove', '✕ Удалить')}
        </button>
      </div>
    </div>
  )
}

export default function BookingInvoices({
  bookingId, initial, partners,
}: {
  bookingId: string
  initial: SupplierInvoice[]
  partners: PartnerOption[]
}) {
  const t = useT()
  const [invoices, setInvoices] = useState<SupplierInvoice[]>(initial)
  const [services, setServices] = useState<BookingService[]>([])

  useEffect(() => {
    let cancelled = false
    getBookingServices(bookingId).then((rows) => { if (!cancelled) setServices(rows) }).catch(() => {})
    return () => { cancelled = true }
  }, [bookingId])

  async function handleAdd() {
    const created = await addInvoice(bookingId)
    if (created) setInvoices((p) => [...p, created])
  }

  async function handleRemove(id: string) {
    if (!confirm(t('Remove this invoice?', 'Удалить этот счёт?'))) return
    setInvoices((p) => p.filter((i) => i.id !== id))
    await deleteInvoice(id)
  }

  // локально обновляем суммы, чтобы итоги пересчитывались сразу
  function handleChange(id: string, patch: Partial<SupplierInvoice>) {
    setInvoices((p) => p.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  // итоги по валютам (сумма инвойсов)
  const totals = invoices.reduce((acc, i) => {
    const cur = i.currency || 'EUR'
    acc[cur] = (acc[cur] ?? 0) + (i.amount ?? 0)
    return acc
  }, {} as Record<string, number>)
  const currencies = Object.keys(totals).sort()

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
        {invoices.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
            {t('No supplier invoices yet. Add the bills you received from hotels and partners.',
               'Пока нет счетов поставщиков. Добавьте счета, полученные от отелей и партнёров.')}
          </div>
        ) : (
          invoices.map((i) => (
            <InvoiceCard key={i.id} invoice={i} partners={partners} services={services}
              onRemove={handleRemove} onChange={handleChange} />
          ))
        )}
      </div>

      <button type="button" onClick={handleAdd}
        style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
        {t('+ Add invoice', '+ Добавить счёт')}
      </button>

      {/* ИТОГИ по валютам */}
      {currencies.length > 0 && (
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--admin-border-card)' }}>
          <div style={{ ...labelSt, marginBottom: '10px' }}>{t('Invoiced totals', 'Итого по счетам')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {currencies.map((cur) => (
              <div key={cur} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '10px 14px', border: '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-card)' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)', minWidth: '44px' }}>{cur}</span>
                <span style={{ fontSize: '14px', fontWeight: 600, marginLeft: 'auto', color: 'var(--admin-text)' }}>{money(totals[cur])}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--admin-text-muted)', margin: '8px 0 0' }}>
            {t('Currencies are kept separate — no conversion.', 'Валюты считаются раздельно — без конвертации.')}
          </p>
        </div>
      )}
    </div>
  )
}