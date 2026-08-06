'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n-client'
import { addPayment, deleteTransaction, addAccount, archiveAccount, addSupplierInvoice, updateSupplierInvoice, deleteSupplierInvoice, type AccountRow, type PartnerLite, type ClientLite } from './actions'

export type InvoiceRow = {
  id: string
  booking_id: string
  booking_code: string | null
  client_name: string | null
  supplier: string | null
  partner_id: string | null
  invoice_number: string | null
  amount: number
  currency: string
  paid: number
  balance: number
  issue_date: string | null
  due_date: string | null
  notes: string | null
}

export type TransactionRow = {
  id: string
  booking_id: string
  booking_code: string | null
  client_name: string | null
  direction: 'in' | 'out'
  category: string
  invoice_id: string | null
  invoice_number: string | null
  partner_name: string | null
  amount: number
  currency: string
  paid_on: string | null
  notes: string | null
  account_id: string | null
  account_name: string | null
  allocations: { label: string; amount: number; booking_id: string | null }[]
}

export type BookingOption = {
  id: string
  booking_code: string | null
  client_id: string | null
  client_name: string | null
}

export type ReceivableRow = {
  booking_id: string
  booking_code: string | null
  client: string
  currency: string
  sale: number
  paid: number
  balance: number
}

const CURRENCIES = ['EUR', 'USD', 'AED', 'CHF', 'GBP', 'UAH']

// value + направление + двуязычная подпись (перевод на месте рендера)
const CATEGORIES: { value: string; en: string; ru: string; dir: 'in' | 'out' | null }[] = [
  { value: 'client_payment', en: 'Client payment', ru: 'Оплата клиента', dir: 'in' },
  { value: 'hotel_commission', en: 'Hotel commission', ru: 'Комиссия отеля', dir: 'in' },
  { value: 'supplier_payment', en: 'Supplier payment', ru: 'Оплата поставщику', dir: 'out' },
  { value: 'other', en: 'Other', ru: 'Прочее', dir: null },
]

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// статус инвойса — двуязычная подпись + цвет
function invoiceStatus(inv: InvoiceRow): { en: string; ru: string; color: string } {
  if (inv.paid <= 0) return { en: 'Unpaid', ru: 'Не оплачен', color: 'var(--admin-danger)' }
  if (inv.paid >= inv.amount && inv.amount > 0) return { en: 'Paid', ru: 'Оплачен', color: 'var(--admin-success)' }
  return { en: 'Partial', ru: 'Частично', color: 'var(--admin-accent)' }
}

type Tab = 'ledger' | 'invoices' | 'debts' | 'accounts'

const thSt: React.CSSProperties = {
  textAlign: 'left', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', fontWeight: 500, padding: '10px 12px', whiteSpace: 'nowrap',
}
const tdSt: React.CSSProperties = {
  fontSize: '13px', color: 'var(--admin-text)', padding: '10px 12px', borderTop: '1px solid var(--admin-border-card)',
}
const labelSt: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', fontWeight: 500, display: 'block', marginBottom: '4px',
}
const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: '13px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '4px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

function bookingLabel(b: { booking_code: string | null; client_name: string | null }): string {
  return `${b.booking_code || 'Booking'}${b.client_name ? ` · ${b.client_name}` : ''}`
}

// ---------- Форма добавления платежа ----------
function AddPayment({ bookings, invoices, accounts, clients, partners, onDone }: {
  bookings: BookingOption[]
  invoices: InvoiceRow[]
  accounts: AccountRow[]
  clients: ClientLite[]
  partners: PartnerLite[]
  onDone: () => void
}) {
  const t = useT()
  const [kind, setKind] = useState<'client' | 'supplier'>('client')
  const [clientId, setClientId] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [paidOn, setPaidOn] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<{ id: number; targetId: string; amount: string }[]>([{ id: 0, targetId: '', amount: '' }])
  const rowKey = useRef(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const clientBookings = bookings.filter((b) => b.client_id === clientId)
  const supplierInvoices = invoices.filter((i) => i.partner_id === partnerId && i.balance > 0.005)

  function setRow(id: number, patch: Partial<{ targetId: string; amount: string }>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  function pickTarget(id: number, targetId: string) {
    if (kind === 'supplier') {
      const inv = invoices.find((i) => i.id === targetId)
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, targetId, amount: inv ? String(inv.balance) : r.amount } : r)))
    } else {
      setRow(id, { targetId })
    }
  }
  function addRow() { setRows((rs) => [...rs, { id: rowKey.current++, targetId: '', amount: '' }]) }
  function removeRow(id: number) { setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs)) }
  function switchKind(k: 'client' | 'supplier') {
    setKind(k)
    setRows([{ id: rowKey.current++, targetId: '', amount: '' }])
  }
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)

  const activeAccounts = accounts.filter((a) => !a.archived)
  function pickAccount(id: string) {
    setAccountId(id)
    const acc = accounts.find((a) => a.id === id)
    if (acc) setCurrency(acc.currency)
  }

  async function save() {
    setError('')
    if (kind === 'client' && !clientId) { setError(t('Select a client', 'Выберите клиента')); return }
    if (kind === 'supplier' && !partnerId) { setError(t('Select a supplier', 'Выберите поставщика')); return }
    const allocations = rows
      .filter((r) => r.targetId && Number(r.amount) > 0)
      .map((r) => kind === 'client'
        ? { booking_id: r.targetId, invoice_id: null, amount: Number(r.amount) }
        : { booking_id: null, invoice_id: r.targetId, amount: Number(r.amount) })
    if (allocations.length === 0) { setError(t('Add at least one line with an amount', 'Добавьте хотя бы одну строку с суммой')); return }
    setSaving(true)
    const res = await addPayment({
      kind,
      client_id: kind === 'client' ? clientId : null,
      partner_id: kind === 'supplier' ? partnerId : null,
      currency,
      account_id: accountId || null,
      paid_on: paidOn || null,
      notes: notes || null,
      allocations,
    })
    setSaving(false)
    if (!res.ok) { setError(res.error || t('Error', 'Ошибка')); return }
    onDone()
  }

  return (
    <div style={{ border: '1px solid var(--admin-border-card)', borderRadius: '10px', padding: '16px', background: 'var(--admin-card)', marginBottom: '20px' }}>
      {/* тип платежа */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        {(['client', 'supplier'] as const).map((k) => (
          <button key={k} type="button" onClick={() => switchKind(k)}
            style={{
              padding: '8px 14px', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
              borderRadius: '6px', border: `1px solid ${kind === k ? 'var(--admin-text-on-dark)' : 'var(--admin-border-card)'}`,
              background: kind === k ? 'var(--admin-text-on-dark)' : 'transparent',
              color: kind === k ? 'var(--admin-dark-panel)' : 'var(--admin-text-muted)',
            }}>
            {k === 'client' ? t('Client payment', 'Оплата клиента') : t('Supplier payment', 'Оплата поставщику')}
          </button>
        ))}
      </div>

      {/* контрагент + счёт/валюта/дата */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '12px' }}>
        <div style={{ width: '240px' }}>
          <label style={labelSt}>{kind === 'client' ? t('Client', 'Клиент') : t('Supplier', 'Поставщик')} *</label>
          {kind === 'client' ? (
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={inputSt}>
              <option value="">{t('— select —', '— выберите —')}</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} style={inputSt}>
              <option value="">{t('— select —', '— выберите —')}</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
        {activeAccounts.length > 0 && (
          <div style={{ width: '190px' }}>
            <label style={labelSt}>{t('Account', 'Счёт')}</label>
            <select value={accountId} onChange={(e) => pickAccount(e.target.value)} style={inputSt}>
              <option value="">{t('— no account —', '— без счёта —')}</option>
              {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
            </select>
          </div>
        )}
        <div style={{ width: '90px' }}>
          <label style={labelSt}>{t('Currency', 'Валюта')}</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputSt} disabled={!!accountId}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ width: '150px' }}>
          <label style={labelSt}>{t('Date', 'Дата')}</label>
          <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} style={inputSt} />
        </div>
      </div>

      {/* строки разбивки: брони (клиент) или инвойсы (поставщик) */}
      <div style={{ marginBottom: '10px' }}>
        <label style={labelSt}>{kind === 'client' ? t('Bookings and amounts', 'Брони и суммы') : t('Invoices and amounts', 'Инвойсы и суммы')}</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={r.targetId} onChange={(e) => pickTarget(r.id, e.target.value)} style={{ ...inputSt, flex: 1, minWidth: '240px' }}>
                <option value="">{kind === 'client' ? t('— booking —', '— бронь —') : t('— invoice —', '— инвойс —')}</option>
                {kind === 'client'
                  ? clientBookings.map((b) => <option key={b.id} value={b.id}>{bookingLabel(b)}</option>)
                  : supplierInvoices.map((i) => (
                      <option key={i.id} value={i.id}>
                        {(i.invoice_number || 'Invoice')} · {t('balance', 'остаток')} {money(i.balance)} {i.currency}
                      </option>
                    ))}
              </select>
              <input type="number" step="0.01" value={r.amount} onChange={(e) => setRow(r.id, { amount: e.target.value })}
                style={{ ...inputSt, width: '120px' }} placeholder="0" />
              <button type="button" onClick={() => removeRow(r.id)}
                style={{ background: 'transparent', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', fontSize: '15px', fontFamily: 'inherit', padding: '0 4px' }}>×</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addRow}
          style={{ marginTop: '8px', padding: '6px 12px', fontSize: '12px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {kind === 'client' ? t('+ Add booking', '+ Добавить бронь') : t('+ Add invoice', '+ Добавить инвойс')}
        </button>
        <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--admin-text)' }}>
          {t('Total', 'Итого')}: <strong>{money(total)} {currency}</strong>
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={labelSt}>{t('Note', 'Заметка')}</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} style={inputSt} placeholder={t('Comment…', 'Комментарий…')} />
      </div>

      {error && <div style={{ fontSize: '12px', color: 'var(--admin-danger)', marginBottom: '8px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={save} disabled={saving}
          style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '6px', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.5 : 1, fontFamily: 'inherit' }}>
          {saving ? t('Saving…', 'Сохранение…') : t('Add payment', 'Добавить платёж')}
        </button>
        <button type="button" onClick={onDone}
          style={{ padding: '8px 16px', fontSize: '13px', background: 'transparent', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {t('Cancel', 'Отмена')}
        </button>
      </div>
    </div>
  )
}

// ---------- Форма добавления инвойса поставщика ----------
function InvoiceForm({ bookings, partners, initial, onDone }: {
  bookings: BookingOption[]
  partners: PartnerLite[]
  initial?: InvoiceRow | null
  onDone: () => void
}) {
  const t = useT()
  const [bookingId, setBookingId] = useState(initial?.booking_id ?? '')
  const [partnerId, setPartnerId] = useState(initial?.partner_id ?? '')
  const [invoiceNo, setInvoiceNo] = useState(initial?.invoice_number ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [currency, setCurrency] = useState(initial?.currency ?? 'EUR')
  const [issueDate, setIssueDate] = useState(initial?.issue_date ?? '')
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (!bookingId) { setError(t('Select a booking', 'Выберите бронь')); return }
    const amt = Number(amount)
    if (!amt || amt <= 0) { setError(t('Enter an amount', 'Введите сумму')); return }
    setSaving(true)
    const payload = {
      partner_id: partnerId || null,
      invoice_number: invoiceNo || null,
      amount: amt,
      currency,
      issue_date: issueDate || null,
      due_date: dueDate || null,
      notes: notes || null,
    }
    const res = initial
      ? await updateSupplierInvoice(initial.id, payload)
      : await addSupplierInvoice({ booking_id: bookingId, ...payload })
    setSaving(false)
    if (!res.ok) { setError(res.error || t('Error', 'Ошибка')); return }
    onDone()
  }

  return (
    <div style={{ border: '1px solid var(--admin-border-card)', borderRadius: '10px', padding: '16px', background: 'var(--admin-card)', marginBottom: '20px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div style={{ width: '260px' }}>
          <label style={labelSt}>{t('Booking', 'Бронь')} *</label>
          <select value={bookingId} onChange={(e) => setBookingId(e.target.value)} style={inputSt} disabled={!!initial}>
            <option value="">{t('— select —', '— выберите —')}</option>
            {bookings.map((b) => <option key={b.id} value={b.id}>{bookingLabel(b)}</option>)}
          </select>
        </div>
        <div style={{ width: '220px' }}>
          <label style={labelSt}>{t('Supplier', 'Поставщик')}</label>
          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} style={inputSt}>
            <option value="">{t('— none —', '— не указан —')}</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div style={{ width: '160px' }}>
          <label style={labelSt}>{t('Invoice №', 'Инвойс №')}</label>
          <input type="text" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} style={inputSt} placeholder="INV-001" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div style={{ width: '140px' }}>
          <label style={labelSt}>{t('Amount', 'Сумма')} *</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputSt} placeholder="0" />
        </div>
        <div style={{ width: '90px' }}>
          <label style={labelSt}>{t('Currency', 'Валюта')}</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputSt}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ width: '150px' }}>
          <label style={labelSt}>{t('Issue date', 'Дата выставления')}</label>
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} style={inputSt} />
        </div>
        <div style={{ width: '150px' }}>
          <label style={labelSt}>{t('Due date', 'Срок оплаты')}</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputSt} />
        </div>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={labelSt}>{t('Note', 'Заметка')}</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} style={inputSt} placeholder={t('Comment…', 'Комментарий…')} />
      </div>

      {error && <div style={{ fontSize: '12px', color: 'var(--admin-danger)', marginBottom: '8px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={save} disabled={saving}
          style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '6px', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.5 : 1, fontFamily: 'inherit' }}>
          {saving ? t('Saving…', 'Сохранение…') : (initial ? t('Save', 'Сохранить') : t('Add invoice', 'Добавить инвойс'))}
        </button>
        <button type="button" onClick={onDone}
          style={{ padding: '8px 16px', fontSize: '13px', background: 'transparent', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {t('Cancel', 'Отмена')}
        </button>
      </div>
    </div>
  )
}

// ---------- Вкладка «Счета» ----------
function AccountsTab({ accounts }: { accounts: AccountRow[] }) {
  const t = useT()
  const router = useRouter()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const active = accounts.filter((a) => !a.archived)

  async function add() {
    setError('')
    if (!name.trim()) { setError(t('Enter account name', 'Введите название счёта')); return }
    setSaving(true)
    const res = await addAccount(name.trim(), currency)
    setSaving(false)
    if (!res.ok) { setError(res.error || t('Error', 'Ошибка')); return }
    setName(''); router.refresh()
  }

  async function hide(id: string) {
    if (!confirm(t('Hide this account? Past payments keep their link.', 'Скрыть этот счёт? Прошлые платежи сохранят привязку.'))) return
    await archiveAccount(id)
    router.refresh()
  }

  return (
    <div>
      <div style={{ border: '1px solid var(--admin-border-card)', borderRadius: '10px', padding: '16px', background: 'var(--admin-card)', marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <label style={labelSt}>{t('Account name', 'Название счёта')}</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputSt} placeholder={t('e.g. Cash EUR, Mono card…', 'напр. Наличка EUR, Карта Моно…')} />
        </div>
        <div style={{ width: '110px' }}>
          <label style={labelSt}>{t('Currency', 'Валюта')}</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputSt}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button type="button" onClick={add} disabled={saving}
          style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '6px', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.5 : 1, fontFamily: 'inherit' }}>
          {saving ? t('Adding…', 'Добавление…') : t('Add account', 'Добавить счёт')}
        </button>
      </div>
      {error && <div style={{ fontSize: '12px', color: 'var(--admin-danger)', marginBottom: '12px' }}>{error}</div>}

      {active.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
          {t('No accounts yet. Add the first one above.', 'Пока нет счетов. Добавьте первый выше.')}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--admin-border-card)', borderRadius: '10px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thSt}>{t('Account', 'Счёт')}</th>
                <th style={thSt}>{t('Currency', 'Валюта')}</th>
                <th style={thSt}></th>
              </tr>
            </thead>
            <tbody>
              {active.map((a) => (
                <tr key={a.id}>
                  <td style={tdSt}>{a.name}</td>
                  <td style={tdSt}>{a.currency}</td>
                  <td style={{ ...tdSt, textAlign: 'right' }}>
                    <button type="button" onClick={() => hide(a.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>
                      {t('Hide', 'Скрыть')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function AccountingClient({ invoices, transactions, bookings, receivables, accounts, partners, clients, from, to }: {
  invoices: InvoiceRow[]
  transactions: TransactionRow[]
  bookings: BookingOption[]
  receivables: ReceivableRow[]
  accounts: AccountRow[]
  partners: PartnerLite[]
  clients: ClientLite[]
  from: string | null
  to: string | null
}) {
  const router = useRouter()
  const t = useT()
  const [tab, setTab] = useState<Tab>('ledger')
  const [adding, setAdding] = useState(false)
  const [addingInvoice, setAddingInvoice] = useState(false)
  const [editInvoice, setEditInvoice] = useState<InvoiceRow | null>(null)
  const [fClient, setFClient] = useState('')
  const [fSupplier, setFSupplier] = useState('')
  const [fBooking, setFBooking] = useState('')
  const [openCur, setOpenCur] = useState<Record<string, boolean>>({})

  const catLabel = (v: string) => {
    const c = CATEGORIES.find((x) => x.value === v)
    return c ? t(c.en, c.ru) : v
  }

  function applyPeriod(f: string, toVal: string) {
    const params = new URLSearchParams()
    if (f) params.set('from', f)
    if (toVal) params.set('to', toVal)
    const qs = params.toString()
    router.push(`/admin/accounting${qs ? `?${qs}` : ''}`)
  }
  const exportParams = new URLSearchParams()
  if (from) exportParams.set('from', from)
  if (to) exportParams.set('to', to)
  exportParams.set('tab', tab)
  const exportUrl = `/admin/accounting/export${exportParams.toString() ? `?${exportParams.toString()}` : ''}`

  async function handleDelete(id: string) {
    if (!confirm(t('Delete payment?', 'Удалить платёж?'))) return
    await deleteTransaction(id)
    router.refresh()
  }

  // фильтры вкладки «Задолженности» (клиент / поставщик / номер брони)
  const lc = (s: string | null | undefined) => (s ?? '').toLowerCase()
  const debtInvoices = invoices.filter((i) =>
    (!fClient || lc(i.client_name).includes(fClient.toLowerCase())) &&
    (!fSupplier || lc(i.supplier).includes(fSupplier.toLowerCase())) &&
    (!fBooking || lc(i.booking_code).includes(fBooking.toLowerCase()))
  )
  const debtReceivables = receivables.filter((r) =>
    (!fClient || lc(r.client).includes(fClient.toLowerCase())) &&
    (!fBooking || lc(r.booking_code).includes(fBooking.toLowerCase()))
  )

  // «кому мы должны» по поставщикам (только неоплаченный остаток) + итоги по валютам
  const payAcc = debtInvoices.reduce((acc, i) => {
    if (i.balance <= 0.005) return acc
    const supplier = i.supplier || '—'
    const k = `${supplier}||${i.currency}`
    acc[k] = acc[k] ?? { supplier, currency: i.currency, balance: 0 }
    acc[k].balance += i.balance
    return acc
  }, {} as Record<string, { supplier: string; currency: string; balance: number }>)
  const payableRows = Object.values(payAcc).sort((a, b) => b.balance - a.balance)
  const payTotals = payableRows.reduce((acc, p) => {
    acc[p.currency] = (acc[p.currency] ?? 0) + p.balance
    return acc
  }, {} as Record<string, number>)
  const payCurrencies = Object.keys(payTotals).sort()

  const cash = transactions.reduce((acc, tx) => {
    acc[tx.currency] = acc[tx.currency] ?? { in: 0, out: 0 }
    if (tx.direction === 'in') acc[tx.currency].in += tx.amount
    else acc[tx.currency].out += tx.amount
    return acc
  }, {} as Record<string, { in: number; out: number }>)
  const cashCurrencies = Object.keys(cash).sort()

  // разбивка приход-расхода по счетам (для разворачиваемых итогов)
  const noAccountLabel = t('No account', 'Без счёта')
  const cashByAccount = transactions.reduce((acc, tx) => {
    const nm = tx.account_name || noAccountLabel
    acc[tx.currency] = acc[tx.currency] ?? {}
    acc[tx.currency][nm] = acc[tx.currency][nm] ?? { in: 0, out: 0 }
    if (tx.direction === 'in') acc[tx.currency][nm].in += tx.amount
    else acc[tx.currency][nm].out += tx.amount
    return acc
  }, {} as Record<string, Record<string, { in: number; out: number }>>)

  const recvByCur = debtReceivables.reduce((acc, r) => {
    acc[r.currency] = (acc[r.currency] ?? 0) + r.balance
    return acc
  }, {} as Record<string, number>)
  const recvCurrencies = Object.keys(recvByCur).sort()

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '1100px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>{t('Accounting', 'Бухгалтерия')}</h1>
      <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '0 0 20px' }}>
        {t('Supplier invoices and cash movement. Currencies are counted separately — no conversion.',
           'Инвойсы поставщиков и движение денег. Валюты считаются раздельно — без конвертации.')}
      </p>

      {/* период (фильтрует «Приход-расход» и выгрузку) + выгрузка в Excel */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <label style={labelSt}>{t('Period from', 'Период с')}</label>
          <input type="date" value={from ?? ''} onChange={(e) => applyPeriod(e.target.value, to ?? '')} style={{ ...inputSt, width: '160px' }} />
        </div>
        <div>
          <label style={labelSt}>{t('to', 'по')}</label>
          <input type="date" value={to ?? ''} onChange={(e) => applyPeriod(from ?? '', e.target.value)} style={{ ...inputSt, width: '160px' }} />
        </div>
        {(from || to) && (
          <button type="button" onClick={() => applyPeriod('', '')}
            style={{ padding: '8px 12px', fontSize: '13px', background: 'transparent', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('Reset', 'Сбросить')}
          </button>
        )}
        <a href={exportUrl}
          style={{ marginLeft: 'auto', padding: '9px 16px', fontSize: '13px', fontWeight: 500, background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
          {t('Export to Excel', 'Выгрузить в Excel')}
        </a>
      </div>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--admin-border-card)', marginBottom: '24px' }}>
        {([['ledger', t('Cash flow', 'Приход-расход')], ['invoices', t('Invoices', 'Инвойсы')], ['debts', t('Debts', 'Задолженности')], ['accounts', t('Accounts', 'Счета')]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            style={{
              padding: '10px 16px', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
              background: 'transparent', border: 'none', borderBottom: tab === key ? '2px solid var(--admin-accent)' : '2px solid transparent',
              color: tab === key ? 'var(--admin-text)' : 'var(--admin-text-muted)', marginBottom: '-1px',
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'ledger' ? (
        <div>
          {adding ? (
            <AddPayment bookings={bookings} invoices={invoices} accounts={accounts} clients={clients} partners={partners} onDone={() => { setAdding(false); router.refresh() }} />
          ) : (
            <button type="button" onClick={() => setAdding(true)}
              style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '20px' }}>
              {t('+ Add payment', '+ Добавить платёж')}
            </button>
          )}

          {transactions.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
              {t('No payments yet. Add the first one via “+ Add payment”.',
                 'Пока нет платежей. Добавьте первый через «+ Добавить платёж».')}
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', border: '1px solid var(--admin-border-card)', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thSt}>{t('Date', 'Дата')}</th>
                      <th style={thSt}>{t('Type', 'Тип')}</th>
                      <th style={thSt}>{t('Client / supplier', 'Клиент / поставщик')}</th>
                      <th style={thSt}>{t('For', 'По чему')}</th>
                      <th style={{ ...thSt, textAlign: 'right' }}>{t('Amount', 'Сумма')}</th>
                      <th style={thSt}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id}>
                        <td style={{ ...tdSt, whiteSpace: 'nowrap', color: 'var(--admin-text-muted)' }}>{tx.paid_on || '—'}</td>
                        <td style={tdSt}>{catLabel(tx.category)}</td>
                        <td style={tdSt}>{(tx.direction === 'in' ? tx.client_name : tx.partner_name) || '—'}</td>
                        <td style={{ ...tdSt, color: 'var(--admin-text-muted)' }}>
                          {tx.allocations.length > 0
                            ? tx.allocations.map((a, i) => (
                                <span key={i}>
                                  {i > 0 && ', '}
                                  {a.booking_id
                                    ? <Link href={`/admin/bookings/${a.booking_id}`} style={{ color: 'var(--admin-accent)', textDecoration: 'none' }}>{a.label}</Link>
                                    : a.label}
                                  {' '}({money(a.amount)})
                                </span>
                              ))
                            : '—'}
                        </td>
                        <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: tx.direction === 'in' ? 'var(--admin-success)' : 'var(--admin-danger)' }}>
                          {tx.direction === 'in' ? '+' : '−'}{money(tx.amount)} {tx.currency}
                        </td>
                        <td style={{ ...tdSt, textAlign: 'right' }}>
                          <button type="button" onClick={() => handleDelete(tx.id)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {cashCurrencies.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ ...thSt, padding: '0 0 10px' }}>{t('Totals by currency', 'Итоги по валютам')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '520px' }}>
                    {cashCurrencies.map((cur) => {
                      const c = cash[cur]
                      const net = c.in - c.out
                      const open = !!openCur[cur]
                      const perAccount = cashByAccount[cur] ?? {}
                      const accNames = Object.keys(perAccount).sort()
                      return (
                        <div key={cur} style={{ border: '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-card)', overflow: 'hidden' }}>
                          <button type="button" onClick={() => setOpenCur((p) => ({ ...p, [cur]: !p[cur] }))}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '18px', padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexWrap: 'wrap', textAlign: 'left' }}>
                            <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', width: '12px' }}>{open ? '▾' : '▸'}</span>
                            <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '44px' }}>{cur}</span>
                            <span style={{ fontSize: '12px', color: 'var(--admin-success)' }}>{t('Income', 'Приход')} {money(c.in)}</span>
                            <span style={{ fontSize: '12px', color: 'var(--admin-danger)' }}>{t('Expense', 'Расход')} {money(c.out)}</span>
                            <span style={{ fontSize: '14px', fontWeight: 600, marginLeft: 'auto', color: net >= 0 ? 'var(--admin-success)' : 'var(--admin-danger)' }}>
                              {t('Net', 'Итого')} {money(net)}
                            </span>
                          </button>
                          {open && (
                            <div style={{ borderTop: '1px solid var(--admin-border-card)', padding: '6px 14px 10px 38px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {accNames.map((nm) => {
                                const a = perAccount[nm]
                                const anet = a.in - a.out
                                return (
                                  <div key={nm} style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--admin-text)' }}>{nm}</span>
                                    <span style={{ fontSize: '13px', fontWeight: 600, marginLeft: 'auto', color: anet >= 0 ? 'var(--admin-success)' : 'var(--admin-danger)' }}>
                                      {money(anet)} {cur}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : tab === 'invoices' ? (
        <div>
          {addingInvoice || editInvoice ? (
            <InvoiceForm bookings={bookings} partners={partners} initial={editInvoice}
              onDone={() => { setAddingInvoice(false); setEditInvoice(null); router.refresh() }} />
          ) : (
            <button type="button" onClick={() => setAddingInvoice(true)}
              style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '20px' }}>
              {t('+ Add invoice', '+ Добавить инвойс')}
            </button>
          )}
          {invoices.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
              {t('No invoices yet. Managers enter them inside bookings.',
                 'Пока нет инвойсов. Их заводят менеджеры в бронях.')}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--admin-border-card)', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thSt}>{t('Invoice №', 'Инвойс №')}</th>
                    <th style={thSt}>{t('Supplier', 'Поставщик')}</th>
                    <th style={thSt}>{t('Booking', 'Бронь')}</th>
                    <th style={{ ...thSt, textAlign: 'right' }}>{t('Amount', 'Сумма')}</th>
                    <th style={{ ...thSt, textAlign: 'right' }}>{t('Paid', 'Оплачено')}</th>
                    <th style={{ ...thSt, textAlign: 'right' }}>{t('Balance', 'Остаток')}</th>
                    <th style={thSt}>{t('Status', 'Статус')}</th>
                    <th style={thSt}>{t('Due', 'Срок')}</th>
                    <th style={thSt}></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const st = invoiceStatus(inv)
                    return (
                      <tr key={inv.id}>
                        <td style={tdSt}>{inv.invoice_number || <span style={{ color: 'var(--admin-text-muted)' }}>—</span>}</td>
                        <td style={tdSt}>{inv.supplier || <span style={{ color: 'var(--admin-text-muted)' }}>—</span>}</td>
                        <td style={tdSt}>
                          <Link href={`/admin/bookings/${inv.booking_id}`} style={{ color: 'var(--admin-accent)', textDecoration: 'none' }}>
                            {inv.booking_code || 'Booking'}
                          </Link>
                          {inv.client_name && <span style={{ color: 'var(--admin-text-muted)' }}> · {inv.client_name}</span>}
                        </td>
                        <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' }}>{money(inv.amount)} {inv.currency}</td>
                        <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--admin-text-muted)' }}>{money(inv.paid)}</td>
                        <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{money(inv.balance)}</td>
                        <td style={tdSt}><span style={{ color: st.color, fontWeight: 600, fontSize: '12px' }}>{t(st.en, st.ru)}</span></td>
                        <td style={{ ...tdSt, whiteSpace: 'nowrap', color: 'var(--admin-text-muted)' }}>{inv.due_date || '—'}</td>
                        <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button type="button" onClick={() => { setEditInvoice(inv); setAddingInvoice(false) }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--admin-accent)', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', marginRight: '8px' }}>
                            {t('Edit', 'Изм.')}
                          </button>
                          <button type="button" onClick={async () => { if (confirm(t('Delete this invoice?', 'Удалить этот инвойс?'))) { await deleteSupplierInvoice(inv.id); router.refresh() } }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--admin-danger)', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
                            {t('Delete', 'Удал.')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : tab === 'debts' ? (
        <div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <div style={{ width: '220px' }}>
              <label style={labelSt}>{t('Client', 'Клиент')}</label>
              <input type="text" value={fClient} onChange={(e) => setFClient(e.target.value)} style={inputSt} placeholder={t('client name…', 'имя клиента…')} />
            </div>
            <div style={{ width: '220px' }}>
              <label style={labelSt}>{t('Supplier', 'Поставщик')}</label>
              <input type="text" value={fSupplier} onChange={(e) => setFSupplier(e.target.value)} style={inputSt} placeholder={t('supplier name…', 'имя поставщика…')} />
            </div>
            <div style={{ width: '180px' }}>
              <label style={labelSt}>{t('Booking №', 'Номер брони')}</label>
              <input type="text" value={fBooking} onChange={(e) => setFBooking(e.target.value)} style={inputSt} placeholder={t('e.g. BK-1042', 'напр. BK-1042')} />
            </div>
            {(fClient || fSupplier || fBooking) && (
              <button type="button" onClick={() => { setFClient(''); setFSupplier(''); setFBooking('') }}
                style={{ alignSelf: 'flex-end', padding: '8px 12px', fontSize: '13px', background: 'transparent', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('Reset', 'Сбросить')}
              </button>
            )}
          </div>
          <div style={{ ...thSt, padding: '0 0 10px' }}>{t('What we owe suppliers', 'Кому мы должны поставщикам')}</div>
          {payableRows.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginBottom: '28px' }}>{t('No unpaid invoices.', 'Нет неоплаченных инвойсов.')}</div>
          ) : (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ overflowX: 'auto', border: '1px solid var(--admin-border-card)', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thSt}>{t('Supplier', 'Поставщик')}</th>
                      <th style={{ ...thSt, textAlign: 'right' }}>{t('Balance due', 'Остаток к оплате')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payableRows.map((p, i) => (
                      <tr key={`${p.supplier}-${p.currency}-${i}`}>
                        <td style={tdSt}>{p.supplier}</td>
                        <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--admin-danger)' }}>{money(p.balance)} {p.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '360px' }}>
                {payCurrencies.map((cur) => (
                  <div key={cur} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '10px 14px', border: '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-card)' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '44px' }}>{cur}</span>
                    <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>{t('total owed', 'итого должны')}</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, marginLeft: 'auto', color: 'var(--admin-danger)' }}>{money(payTotals[cur])}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ ...thSt, padding: '0 0 10px' }}>{t('Who owes us (clients)', 'Кто должен нам (клиенты)')}</div>
          {debtReceivables.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>{t('All clients have settled (or no sales data).', 'Все клиенты рассчитались (или нет данных о продажах).')}</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', border: '1px solid var(--admin-border-card)', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thSt}>{t('Booking', 'Бронь')}</th>
                      <th style={thSt}>{t('Client', 'Клиент')}</th>
                      <th style={{ ...thSt, textAlign: 'right' }}>{t('Sale', 'Продажа')}</th>
                      <th style={{ ...thSt, textAlign: 'right' }}>{t('Paid', 'Оплачено')}</th>
                      <th style={{ ...thSt, textAlign: 'right' }}>{t('Balance', 'Остаток')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debtReceivables.map((r, i) => (
                      <tr key={`${r.booking_id}-${r.currency}-${i}`}>
                        <td style={tdSt}>
                          <Link href={`/admin/bookings/${r.booking_id}`} style={{ color: 'var(--admin-accent)', textDecoration: 'none' }}>
                            {r.booking_code || 'Booking'}
                          </Link>
                        </td>
                        <td style={tdSt}>{r.client}</td>
                        <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--admin-text-muted)' }}>{money(r.sale)} {r.currency}</td>
                        <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--admin-text-muted)' }}>{money(r.paid)} {r.currency}</td>
                        <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: r.balance > 0 ? 'var(--admin-danger)' : 'var(--admin-success)' }}>{money(r.balance)} {r.currency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {recvCurrencies.length > 0 && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '360px' }}>
                  {recvCurrencies.map((cur) => (
                    <div key={cur} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '10px 14px', border: '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-card)' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '44px' }}>{cur}</span>
                      <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>{t('total owed to us', 'итого должны нам')}</span>
                      <span style={{ fontSize: '14px', fontWeight: 600, marginLeft: 'auto', color: recvByCur[cur] > 0 ? 'var(--admin-danger)' : 'var(--admin-success)' }}>
                        {money(recvByCur[cur])}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <AccountsTab accounts={accounts} />
      )}
    </div>
  )
}