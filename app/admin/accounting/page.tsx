import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProfile, canSeeAccounting } from '@/lib/get-profile'
import AccountingClient, {
  type InvoiceRow, type TransactionRow, type BookingOption, type ReceivableRow,
} from './accounting-client'

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
      id, booking_id, invoice_number, amount, currency, issue_date, due_date, notes,
      partners ( name ),
      bookings ( booking_code, clients ( name ) )
    `)
    .order('issue_date', { ascending: false })

  // --- платежи (приход-расход) с контекстом ---
  const { data: txRaw } = await supabase
    .from('transactions')
    .select(`
      id, booking_id, direction, category, invoice_id, amount, currency, paid_on, notes,
      bookings ( booking_code, clients ( name ) ),
      supplier_invoices ( invoice_number, partners ( name ) )
    `)
    .order('paid_on', { ascending: false })

  // --- брони для выпадашки при добавлении платежа ---
  const { data: bkRaw } = await supabase
    .from('bookings')
    .select('id, booking_code, clients ( name )')
    .order('created_at', { ascending: false })

  // --- услуги броней (для «кто должен нам»: продажа клиенту = сумма gross) ---
  const { data: svcRaw } = await supabase
    .from('booking_services')
    .select('booking_id, gross, currency')

  // бронь → имя клиента
  const bookingClient = new Map<string, string>()
  for (const b of bkRaw ?? []) {
    const c = one(b.clients as unknown)
    bookingClient.set(b.id, (c as { name?: string | null } | null)?.name ?? '—')
  }

  // сколько оплачено по каждому инвойсу (расходы 'out' в той же валюте)
  const paidByInvoice = new Map<string, number>()
  for (const p of txRaw ?? []) {
    if (p.direction !== 'out' || !p.invoice_id) continue
    paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
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
      invoice_number: r.invoice_number,
      amount,
      currency: r.currency ?? 'EUR',
      paid,
      balance: amount - paid,
      issue_date: r.issue_date,
      due_date: r.due_date,
    }
  })

  const transactions: TransactionRow[] = (txRaw ?? []).map((r) => {
    const booking = one(r.bookings as unknown)
    const client = booking ? one((booking as { clients?: unknown }).clients) : null
    const inv = one(r.supplier_invoices as unknown)
    const invPartner = inv ? one((inv as { partners?: unknown }).partners) : null
    return {
      id: r.id,
      booking_id: r.booking_id,
      booking_code: (booking as { booking_code?: string | null } | null)?.booking_code ?? null,
      client_name: (client as { name?: string | null } | null)?.name ?? null,
      direction: r.direction as 'in' | 'out',
      category: r.category,
      invoice_id: r.invoice_id,
      invoice_number: (inv as { invoice_number?: string | null } | null)?.invoice_number ?? null,
      partner_name: (invPartner as { name?: string | null } | null)?.name ?? null,
      amount: Number(r.amount ?? 0),
      currency: r.currency ?? 'EUR',
      paid_on: r.paid_on,
      notes: r.notes,
    }
  })

  const bookings: BookingOption[] = (bkRaw ?? []).map((b) => ({
    id: b.id,
    booking_code: b.booking_code,
    client_name: bookingClient.get(b.id) ?? null,
  }))

  // «Кто должен нам»: по (клиент, валюта) — продажа (gross) минус оплаты клиента
  const key = (client: string, cur: string) => `${client}||${cur}`
  const acc = new Map<string, { client: string; currency: string; sale: number; paid: number }>()
  const bump = (client: string, cur: string, field: 'sale' | 'paid', v: number) => {
    const k = key(client, cur)
    const row = acc.get(k) ?? { client, currency: cur, sale: 0, paid: 0 }
    row[field] += v
    acc.set(k, row)
  }
  for (const s of svcRaw ?? []) {
    const client = bookingClient.get(s.booking_id) ?? '—'
    bump(client, s.currency ?? 'EUR', 'sale', Number(s.gross ?? 0))
  }
  for (const t of txRaw ?? []) {
    if (t.category !== 'client_payment') continue
    const client = bookingClient.get(t.booking_id) ?? '—'
    bump(client, t.currency ?? 'EUR', 'paid', Number(t.amount ?? 0))
  }
  const receivables: ReceivableRow[] = Array.from(acc.values())
    .map((r) => ({ client: r.client, currency: r.currency, sale: r.sale, paid: r.paid, balance: r.sale - r.paid }))
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
      from={from}
      to={to}
    />
  )
}