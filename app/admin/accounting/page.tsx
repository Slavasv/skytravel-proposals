import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProfile, canSeeAccounting } from '@/lib/get-profile'
import AccountingClient, {
  type InvoiceRow, type TransactionRow, type BookingOption, type ReceivableRow,
} from './accounting-client'
import type { AccountRow, PartnerLite, ClientLite } from './actions'

// object | array | null → object | null (Supabase-джойн бывает и тем, и другим)
function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export default async function AccountingPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from = null, to = null } = await searchParams
  const profile = await getProfile()
  // кабинет доступен owner/admin и бухгалтеру
  if (!canSeeAccounting(profile?.role)) redirect('/admin')

  const supabase = await createSupabaseServer()

  // --- инвойсы (RLS сам отдаёт только свой бренд) ---
  const { data: invRaw } = await supabase
    .from('supplier_invoices')
    .select(`
      id, booking_id, partner_id, invoice_number, amount, currency, issue_date, due_date, notes,
      partners ( name ),
      bookings ( booking_code, clients ( name ) )
    `)
    .order('issue_date', { ascending: false })

  // --- платежи (приход-расход) с контекстом ---
  const { data: txRaw } = await supabase
    .from('transactions')
    .select(`
      id, booking_id, account_id, direction, category, invoice_id, amount, currency, paid_on, notes,
      client:client_id ( name ),
      partner:partner_id ( name ),
      bookings ( booking_code, clients ( name ) ),
      supplier_invoices ( invoice_number, partners ( name ) )
    `)
    .order('paid_on', { ascending: false })

  // --- разбивка платежей (аллокации) ---
  const { data: allocRaw } = await supabase
    .from('transaction_allocations')
    .select('transaction_id, booking_id, invoice_id, amount')

  // --- брони для выпадашки при добавлении платежа ---
  const { data: bkRaw } = await supabase
    .from('bookings')
    .select('id, booking_code, client_id, clients ( name )')
    .order('created_at', { ascending: false })

  // --- клиенты (для оплаты клиента) ---
  const { data: clRaw } = await supabase
    .from('clients')
    .select('id, name')
    .order('name', { ascending: true })
  const clients: ClientLite[] = (clRaw ?? []).map((c) => ({ id: c.id as string, name: (c.name as string | null) ?? '' }))

  // --- услуги броней (для «кто должен нам»: продажа клиенту = сумма gross) ---
  const { data: svcRaw } = await supabase
    .from('booking_services')
    .select('booking_id, gross, currency')

  // --- счета (справочник) ---
  const { data: accRaw } = await supabase
    .from('payment_accounts')
    .select('id, name, currency, archived')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  const accounts: AccountRow[] = (accRaw ?? []).map((a) => ({
    id: a.id, name: a.name, currency: a.currency, archived: a.archived,
  }))
  const accountName = new Map<string, string>()
  for (const a of accounts) accountName.set(a.id, a.name)

  // --- поставщики (для формы инвойса и оплаты поставщику) ---
  const { data: prtRaw } = await supabase
    .from('partners')
    .select('id, name')
    .order('name', { ascending: true })
  const partners: PartnerLite[] = (prtRaw ?? []).map((p) => ({ id: p.id as string, name: (p.name as string | null) ?? '' }))

  // бронь → имя клиента и номер брони
  const bookingClient = new Map<string, string>()
  const bookingCode = new Map<string, string | null>()
  for (const b of bkRaw ?? []) {
    const c = one(b.clients as unknown)
    bookingClient.set(b.id, (c as { name?: string | null } | null)?.name ?? '—')
    bookingCode.set(b.id, b.booking_code)
  }

  // категория/валюта платежа по id (для расчётов по аллокациям)
  const txMeta = new Map<string, { category: string; currency: string }>()
  for (const r of txRaw ?? []) txMeta.set(r.id, { category: r.category, currency: r.currency ?? 'EUR' })

  // сколько оплачено по каждому инвойсу — из аллокаций
  const paidByInvoice = new Map<string, number>()
  for (const a of allocRaw ?? []) {
    if (!a.invoice_id) continue
    paidByInvoice.set(a.invoice_id, (paidByInvoice.get(a.invoice_id) ?? 0) + Number(a.amount ?? 0))
  }

  const invoices: InvoiceRow[] = (invRaw ?? []).map((r) => {
    const booking = one(r.bookings as unknown)
    const client = booking ? one((booking as { clients?: unknown }).clients) : null
    const partner = one(r.partners as unknown)
    const amount = Number(r.amount ?? 0)
    const paid = paidByInvoice.get(r.id) ?? 0
    return {
      id: r.id,
      booking_id: r.booking_id,
      booking_code: (booking as { booking_code?: string | null } | null)?.booking_code ?? null,
      client_name: (client as { name?: string | null } | null)?.name ?? null,
      supplier: (partner as { name?: string | null } | null)?.name ?? null,
      partner_id: (r as { partner_id?: string | null }).partner_id ?? null,
      invoice_number: r.invoice_number,
      amount,
      currency: r.currency ?? 'EUR',
      paid,
      balance: amount - paid,
      issue_date: r.issue_date,
      due_date: r.due_date,
      notes: (r.notes as string | null) ?? null,
    }
  })

  // номер инвойса по id (для подписи аллокаций в реестре)
  const invoiceNumber = new Map<string, string | null>()
  for (const inv of invoices) invoiceNumber.set(inv.id, inv.invoice_number)

  // аллокации по платежу (для колонки «по чему» в реестре)
  const allocByTx = new Map<string, { label: string; amount: number; booking_id: string | null }[]>()
  for (const a of allocRaw ?? []) {
    const label = a.invoice_id
      ? (invoiceNumber.get(a.invoice_id) || 'Invoice')
      : a.booking_id ? (bookingCode.get(a.booking_id) || 'Booking') : '—'
    const arr = allocByTx.get(a.transaction_id) ?? []
    arr.push({ label: String(label), amount: Number(a.amount ?? 0), booking_id: a.booking_id ?? null })
    allocByTx.set(a.transaction_id, arr)
  }

  const transactions: TransactionRow[] = (txRaw ?? []).map((r) => {
    const booking = one(r.bookings as unknown)
    const bClient = booking ? one((booking as { clients?: unknown }).clients) : null
    const directClient = one((r as { client?: unknown }).client)
    const inv = one(r.supplier_invoices as unknown)
    const invPartner = inv ? one((inv as { partners?: unknown }).partners) : null
    const directPartner = one((r as { partner?: unknown }).partner)
    const toAcc = one((r as { to_account?: unknown }).to_account)
    return {
      id: r.id,
      booking_id: r.booking_id,
      booking_code: (booking as { booking_code?: string | null } | null)?.booking_code ?? null,
      client_name: (directClient as { name?: string | null } | null)?.name
        ?? (bClient as { name?: string | null } | null)?.name ?? null,
      direction: r.direction as 'in' | 'out',
      category: r.category,
      invoice_id: r.invoice_id,
      invoice_number: (inv as { invoice_number?: string | null } | null)?.invoice_number ?? null,
      partner_name: (directPartner as { name?: string | null } | null)?.name
        ?? (invPartner as { name?: string | null } | null)?.name ?? null,
      amount: Number(r.amount ?? 0),
      currency: r.currency ?? 'EUR',
      paid_on: r.paid_on,
      notes: r.notes,
      account_id: r.account_id ?? null,
      account_name: r.account_id ? (accountName.get(r.account_id) ?? null) : null,
      to_account_id: (r as { to_account_id?: string | null }).to_account_id ?? null,
      to_account_name: (toAcc as { name?: string | null } | null)?.name ?? null,
      to_amount: (r as { to_amount?: number | null }).to_amount ?? null,
      to_currency: (r as { to_currency?: string | null }).to_currency ?? null,
      commission: Number((r as { commission?: number | null }).commission ?? 0),
      commission_currency: (r as { commission_currency?: string | null }).commission_currency ?? null,
      debit_amount: (r as { debit_amount?: number | null }).debit_amount ?? null,
      debit_currency: (r as { debit_currency?: string | null }).debit_currency ?? null,
      allocations: allocByTx.get(r.id) ?? [],
    }
  })

  const bookings: BookingOption[] = (bkRaw ?? []).map((b) => ({
    id: b.id,
    booking_code: b.booking_code,
    client_id: (b as { client_id?: string | null }).client_id ?? null,
    client_name: bookingClient.get(b.id) ?? null,
  }))

  // «Кто должен нам»: по (бронь, валюта) — продажа (gross) минус оплаты клиента (по аллокациям)
  const key = (bid: string, cur: string) => `${bid}||${cur}`
  const acc = new Map<string, { booking_id: string; currency: string; sale: number; paid: number }>()
  const bump = (bid: string, cur: string, field: 'sale' | 'paid', v: number) => {
    const k = key(bid, cur)
    const row = acc.get(k) ?? { booking_id: bid, currency: cur, sale: 0, paid: 0 }
    row[field] += v
    acc.set(k, row)
  }
  for (const s of svcRaw ?? []) {
    bump(s.booking_id, s.currency ?? 'EUR', 'sale', Number(s.gross ?? 0))
  }
  for (const a of allocRaw ?? []) {
    const meta = txMeta.get(a.transaction_id)
    if (!meta || meta.category !== 'client_payment') continue
    if (!a.booking_id) continue
    bump(a.booking_id, meta.currency, 'paid', Number(a.amount ?? 0))
  }
  const receivables: ReceivableRow[] = Array.from(acc.values())
    .map((r) => ({
      booking_id: r.booking_id,
      booking_code: bookingCode.get(r.booking_id) ?? null,
      client: bookingClient.get(r.booking_id) ?? '—',
      currency: r.currency,
      sale: r.sale,
      paid: r.paid,
      balance: r.sale - r.paid,
    }))
    .filter((r) => Math.abs(r.balance) > 0.005)
    .sort((a, b) => b.balance - a.balance)

  // фильтр по периоду применяется к реестру приход-расхода (даты платежей);
  // задолженности и остатки — текущие, не зависят от периода
  const inPeriod = (d: string | null) => (!from || !d || d >= from) && (!to || !d || d <= to)
  const ledgerTx = transactions.filter((t) => inPeriod(t.paid_on))

  return (
    <AccountingClient
      invoices={invoices}
      transactions={ledgerTx}
      bookings={bookings}
      receivables={receivables}
      accounts={accounts}
      partners={partners}
      clients={clients}
      from={from}
      to={to}
    />
  )
}