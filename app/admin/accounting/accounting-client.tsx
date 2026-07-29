'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addTransaction, deleteTransaction } from './actions'

export type InvoiceRow = {
  id: string
  booking_id: string
  booking_code: string | null
  client_name: string | null
  supplier: string | null
  invoice_number: string | null
  amount: number
  currency: string
  paid: number
  balance: number
  issue_date: string | null
  due_date: string | null
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
}

export type BookingOption = {
  id: string
  booking_code: string | null
  client_name: string | null
}

export type ReceivableRow = {
  client: string
  currency: string
  sale: number
  paid: number
  balance: number
}

const CURRENCIES = ['EUR', 'USD', 'AED', 'CHF', 'GBP']

const CATEGORIES: { value: string; label: string; dir: 'in' | 'out' | null }[] = [
  { value: 'client_payment', label: 'Оплата клиента', dir: 'in' },
  { value: 'hotel_commission', label: 'Комиссия отеля', dir: 'in' },
  { value: 'supplier_payment', label: 'Оплата поставщику', dir: 'out' },
  { value: 'other', label: 'Прочее', dir: null },
]
const catLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function invoiceStatus(inv: InvoiceRow): { label: string; color: string } {
  if (inv.paid <= 0) return { label: 'Unpaid', color: 'var(--admin-danger)' }
  if (inv.paid >= inv.amount && inv.amount > 0) return { label: 'Paid', color: 'var(--admin-success)' }
  return { label: 'Partial', color: 'var(--admin-accent)' }
}

type Tab = 'ledger' | 'invoices' | 'debts'

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
function AddPayment({ bookings, invoices, onDone }: {
  bookings: BookingOption[]
  invoices: InvoiceRow[]
  onDone: () => void
}) {
  const [bookingId, setBookingId] = useState('')
  const [category, setCategory] = useState('client_payment')
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [paidOn, setPaidOn] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const bookingInvoices = invoices.filter((i) => i.booking_id === bookingId)

  function pickCategory(v: string) {
    setCategory(v)
    const dir = CATEGORIES.find((c) => c.value === v)?.dir
    if (dir) setDirection(dir)
    if (dir !== 'out') setInvoiceId('')
  }

  function pickInvoice(id: string) {
    setInvoiceId(id)
    const inv = invoices.find((i) => i.id === id)
    if (inv) setCurrency(inv.currency)
  }

  async function save() {
    setError('')
    if (!bookingId) { setError('Выберите бронь'); return }
    const amt = Number(amount)
    if (!amt || amt <= 0) { setError('Введите сумму'); return }
    setSaving(true)
    const res = await addTransaction({
      booking_id: bookingId,
      direction,
      category,
      invoice_id: direction === 'out' && invoiceId ? invoiceId : null,
      amount: amt,
      currency,
      paid_on: paidOn || null,
      notes: notes || null,
    })
    setSaving(false)
    if (!res.ok) { setError(res.error || 'Ошибка'); return }
    onDone()
  }

  return (
    <div style={{ border: '1px solid var(--admin-border-card)', borderRadius: '10px', padding: '16px', background: 'var(--admin-card)', marginBottom: '20px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div style={{ width: '260px' }}>
          <label style={labelSt}>Бронь *</label>
          <select value={bookingId} onChange={(e) => setBookingId(e.target.value)} style={inputSt}>
            <option value="">— выберите —</option>
            {bookings.map((b) => <option key={b.id} value={b.id}>{bookingLabel(b)}</option>)}
          </select>
        </div>
        <div style={{ width: '190px' }}>
          <label style={labelSt}>Тип</label>
          <select value={category} onChange={(e) => pickCategory(e.target.value)} style={inputSt}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div style={{ width: '150px' }}>
          <label style={labelSt}>Направление</label>
          <select value={direction} onChange={(e) => setDirection(e.target.value as 'in' | 'out')} style={inputSt}>
            <option value="in">Приход</option>
            <option value="out">Расход</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '10px' }}>
        <div style={{ width: '140px' }}>
          <label style={labelSt}>Сумма *</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputSt} placeholder="0" />
        </div>
        <div style={{ width: '90px' }}>
          <label style={labelSt}>Валюта</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputSt}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ width: '150px' }}>
          <label style={labelSt}>Дата</label>
          <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} style={inputSt} />
        </div>
        {direction === 'out' && (
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label style={labelSt}>Инвойс (по какому счёту)</label>
            <select value={invoiceId} onChange={(e) => pickInvoice(e.target.value)} style={inputSt} disabled={!bookingId}>
              <option value="">— не привязывать —</option>
              {bookingInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {(i.invoice_number || 'Invoice')} · {i.supplier || '—'} · остаток {money(i.balance)} {i.currency}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={labelSt}>Заметка</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} style={inputSt} placeholder="Комментарий…" />
      </div>

      {error && <div style={{ fontSize: '12px', color: 'var(--admin-danger)', marginBottom: '8px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" onClick={save} disabled={saving}
          style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '6px', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.5 : 1, fontFamily: 'inherit' }}>
          {saving ? 'Сохранение…' : 'Добавить платёж'}
        </button>
        <button type="button" onClick={onDone}
          style={{ padding: '8px 16px', fontSize: '13px', background: 'transparent', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Отмена
        </button>
      </div>
    </div>
  )
}

export default function AccountingClient({ invoices, transactions, bookings, receivables, from, to }: {
  invoices: InvoiceRow[]
  transactions: TransactionRow[]
  bookings: BookingOption[]
  receivables: ReceivableRow[]
  from: string | null
  to: string | null
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('ledger')
  const [adding, setAdding] = useState(false)

  function applyPeriod(f: string, t: string) {
    const params = new URLSearchParams()
    if (f) params.set('from', f)
    if (t) params.set('to', t)
    const qs = params.toString()
    router.push(`/admin/accounting${qs ? `?${qs}` : ''}`)
  }
  const exportParams = new URLSearchParams()
  if (from) exportParams.set('from', from)
  if (to) exportParams.set('to', to)
  const exportUrl = `/admin/accounting/export${exportParams.toString() ? `?${exportParams.toString()}` : ''}`

  async function handleDelete(id: string) {
    if (!confirm('Удалить платёж?')) return
    await deleteTransaction(id)
    router.refresh()
  }

  // «кому мы должны» по поставщикам (только неоплаченный остаток) + итоги по валютам
  const payAcc = invoices.reduce((acc, i) => {
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

  const cash = transactions.reduce((acc, t) => {
    acc[t.currency] = acc[t.currency] ?? { in: 0, out: 0 }
    if (t.direction === 'in') acc[t.currency].in += t.amount
    else acc[t.currency].out += t.amount
    return acc
  }, {} as Record<string, { in: number; out: number }>)
  const cashCurrencies = Object.keys(cash).sort()

  const recvByCur = receivables.reduce((acc, r) => {
    acc[r.currency] = (acc[r.currency] ?? 0) + r.balance
    return acc
  }, {} as Record<string, number>)
  const recvCurrencies = Object.keys(recvByCur).sort()

  return (
    <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '1100px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>Accounting</h1>
      <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '0 0 20px' }}>
        Инвойсы поставщиков и движение денег. Валюты считаются раздельно — без конвертации.
      </p>

      {/* период (фильтрует «Приход-расход» и выгрузку) + выгрузка в Excel */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <label style={labelSt}>Период с</label>
          <input type="date" value={from ?? ''} onChange={(e) => applyPeriod(e.target.value, to ?? '')} style={{ ...inputSt, width: '160px' }} />
        </div>
        <div>
          <label style={labelSt}>по</label>
          <input type="date" value={to ?? ''} onChange={(e) => applyPeriod(from ?? '', e.target.value)} style={{ ...inputSt, width: '160px' }} />
        </div>
        {(from || to) && (
          <button type="button" onClick={() => applyPeriod('', '')}
            style={{ padding: '8px 12px', fontSize: '13px', background: 'transparent', color: 'var(--admin-text-muted)', border: '1px solid var(--admin-border-card)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Сбросить
          </button>
        )}
        <a href={exportUrl}
          style={{ marginLeft: 'auto', padding: '9px 16px', fontSize: '13px', fontWeight: 500, background: 'var(--admin-text-on-dark)', color: 'var(--admin-dark-panel)', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}>
          Выгрузить в Excel
        </a>
      </div>

      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--admin-border-card)', marginBottom: '24px' }}>
        {([['ledger', 'Приход-расход'], ['invoices', 'Инвойсы'], ['debts', 'Задолженности']] as [Tab, string][]).map(([key, label]) => (
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
            <AddPayment bookings={bookings} invoices={invoices} onDone={() => { setAdding(false); router.refresh() }} />
          ) : (
            <button type="button" onClick={() => setAdding(true)}
              style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '20px' }}>
              + Добавить платёж
            </button>
          )}

          {transactions.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
              Пока нет платежей. Добавьте первый через «+ Добавить платёж».
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', border: '1px solid var(--admin-border-card)', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thSt}>Дата</th>
                      <th style={thSt}>Бронь</th>
                      <th style={thSt}>Тип</th>
                      <th style={thSt}>Инвойс / поставщик</th>
                      <th style={{ ...thSt, textAlign: 'right' }}>Сумма</th>
                      <th style={thSt}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id}>
                        <td style={{ ...tdSt, whiteSpace: 'nowrap', color: 'var(--admin-text-muted)' }}>{t.paid_on || '—'}</td>
                        <td style={tdSt}>
                          <Link href={`/admin/bookings/${t.booking_id}`} style={{ color: 'var(--admin-accent)', textDecoration: 'none' }}>
                            {t.booking_code || 'Booking'}
                          </Link>
                          {t.client_name && <span style={{ color: 'var(--admin-text-muted)' }}> · {t.client_name}</span>}
                        </td>
                        <td style={tdSt}>{catLabel(t.category)}</td>
                        <td style={{ ...tdSt, color: 'var(--admin-text-muted)' }}>
                          {t.invoice_number ? `${t.invoice_number}${t.partner_name ? ` · ${t.partner_name}` : ''}` : '—'}
                        </td>
                        <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: t.direction === 'in' ? 'var(--admin-success)' : 'var(--admin-danger)' }}>
                          {t.direction === 'in' ? '+' : '−'}{money(t.amount)} {t.currency}
                        </td>
                        <td style={{ ...tdSt, textAlign: 'right' }}>
                          <button type="button" onClick={() => handleDelete(t.id)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {cashCurrencies.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ ...thSt, padding: '0 0 10px' }}>Итоги по валютам</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '520px' }}>
                    {cashCurrencies.map((cur) => {
                      const c = cash[cur]
                      const net = c.in - c.out
                      return (
                        <div key={cur} style={{ display: 'flex', alignItems: 'center', gap: '18px', padding: '10px 14px', border: '1px solid var(--admin-border-card)', borderRadius: '8px', background: 'var(--admin-card)', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '44px' }}>{cur}</span>
                          <span style={{ fontSize: '12px', color: 'var(--admin-success)' }}>Приход {money(c.in)}</span>
                          <span style={{ fontSize: '12px', color: 'var(--admin-danger)' }}>Расход {money(c.out)}</span>
                          <span style={{ fontSize: '14px', fontWeight: 600, marginLeft: 'auto', color: net >= 0 ? 'var(--admin-success)' : 'var(--admin-danger)' }}>
                            Итого {money(net)}
                          </span>
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
          {invoices.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
              Пока нет инвойсов. Их заводят менеджеры в бронях.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--admin-border-card)', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thSt}>Invoice №</th>
                    <th style={thSt}>Supplier</th>
                    <th style={thSt}>Booking</th>
                    <th style={{ ...thSt, textAlign: 'right' }}>Amount</th>
                    <th style={{ ...thSt, textAlign: 'right' }}>Paid</th>
                    <th style={{ ...thSt, textAlign: 'right' }}>Balance</th>
                    <th style={thSt}>Status</th>
                    <th style={thSt}>Due</th>
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
                        <td style={tdSt}><span style={{ color: st.color, fontWeight: 600, fontSize: '12px' }}>{st.label}</span></td>
                        <td style={{ ...tdSt, whiteSpace: 'nowrap', color: 'var(--admin-text-muted)' }}>{inv.due_date || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ ...thSt, padding: '0 0 10px' }}>Кому мы должны поставщикам</div>
          {payableRows.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginBottom: '28px' }}>Нет неоплаченных инвойсов.</div>
          ) : (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ overflowX: 'auto', border: '1px solid var(--admin-border-card)', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thSt}>Поставщик</th>
                      <th style={{ ...thSt, textAlign: 'right' }}>Остаток к оплате</th>
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
                    <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>итого должны</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, marginLeft: 'auto', color: 'var(--admin-danger)' }}>{money(payTotals[cur])}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ ...thSt, padding: '0 0 10px' }}>Кто должен нам (клиенты)</div>
          {receivables.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)' }}>Все клиенты рассчитались (или нет данных о продажах).</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', border: '1px solid var(--admin-border-card)', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thSt}>Клиент</th>
                      <th style={{ ...thSt, textAlign: 'right' }}>Продажа</th>
                      <th style={{ ...thSt, textAlign: 'right' }}>Оплачено</th>
                      <th style={{ ...thSt, textAlign: 'right' }}>Остаток</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivables.map((r, i) => (
                      <tr key={`${r.client}-${r.currency}-${i}`}>
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
                      <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)' }}>итого должны нам</span>
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
      )}
    </div>
  )
}