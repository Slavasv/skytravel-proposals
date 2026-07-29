import { NextRequest } from 'next/server'
import ExcelJS from 'exceljs'
import { createSupabaseServer } from '@/lib/supabase-server'
import { getProfile, canSeeAccounting } from '@/lib/get-profile'

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

const CAT: Record<string, string> = {
  client_payment: 'Оплата клиента',
  hotel_commission: 'Комиссия отеля',
  supplier_payment: 'Оплата поставщику',
  other: 'Прочее',
}

// null-дата всегда проходит; иначе — попадание в [from, to]
function inPeriod(date: string | null, from: string | null, to: string | null): boolean {
  if (from && date && date < from) return false
  if (to && date && date > to) return false
  return true
}

export async function GET(req: NextRequest) {
  const profile = await getProfile()
  if (!canSeeAccounting(profile?.role)) {
    return new Response('Forbidden', { status: 403 })
  }

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  const supabase = await createSupabaseServer()

  const { data: txRaw } = await supabase
    .from('transactions')
    .select(`
      id, direction, category, amount, currency, paid_on,
      bookings ( booking_code, clients ( name ) ),
      supplier_invoices ( invoice_number, partners ( name ) )
    `)
    .order('paid_on', { ascending: false })

  const { data: invRaw } = await supabase
    .from('supplier_invoices')
    .select(`
      id, invoice_number, amount, currency, issue_date, due_date,
      partners ( name ),
      bookings ( booking_code, clients ( name ) )
    `)
    .order('issue_date', { ascending: false })

  const { data: payRaw } = await supabase
    .from('transactions')
    .select('invoice_id, amount, direction')

  const paidByInvoice = new Map<string, number>()
  for (const p of payRaw ?? []) {
    if (p.direction !== 'out' || !p.invoice_id) continue
    paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
  }

  const wb = new ExcelJS.Workbook()

  // --- Лист 1: Приход-расход (за период) ---
  const ws1 = wb.addWorksheet('Приход-расход')
  ws1.columns = [
    { header: 'Дата', key: 'date', width: 12 },
    { header: 'Бронь', key: 'booking', width: 16 },
    { header: 'Клиент', key: 'client', width: 22 },
    { header: 'Тип', key: 'type', width: 20 },
    { header: 'Направление', key: 'dir', width: 12 },
    { header: 'Инвойс', key: 'invoice', width: 16 },
    { header: 'Поставщик', key: 'supplier', width: 22 },
    { header: 'Сумма', key: 'amount', width: 14 },
    { header: 'Валюта', key: 'currency', width: 8 },
  ]
  ws1.getRow(1).font = { bold: true }
  for (const r of txRaw ?? []) {
    if (!inPeriod(r.paid_on, from, to)) continue
    const b = one(r.bookings as unknown)
    const client = b ? one((b as { clients?: unknown }).clients) : null
    const inv = one(r.supplier_invoices as unknown)
    const invPartner = inv ? one((inv as { partners?: unknown }).partners) : null
    ws1.addRow({
      date: r.paid_on ?? '',
      booking: (b as { booking_code?: string | null } | null)?.booking_code ?? '',
      client: (client as { name?: string | null } | null)?.name ?? '',
      type: CAT[r.category] ?? r.category,
      dir: r.direction === 'in' ? 'Приход' : 'Расход',
      invoice: (inv as { invoice_number?: string | null } | null)?.invoice_number ?? '',
      supplier: (invPartner as { name?: string | null } | null)?.name ?? '',
      amount: Number(r.amount ?? 0),
      currency: r.currency ?? '',
    })
  }

  // --- Лист 2: Инвойсы (все, с остатком) ---
  const ws2 = wb.addWorksheet('Инвойсы')
  ws2.columns = [
    { header: 'Invoice №', key: 'num', width: 16 },
    { header: 'Поставщик', key: 'supplier', width: 22 },
    { header: 'Бронь', key: 'booking', width: 16 },
    { header: 'Клиент', key: 'client', width: 22 },
    { header: 'Сумма', key: 'amount', width: 14 },
    { header: 'Оплачено', key: 'paid', width: 14 },
    { header: 'Остаток', key: 'balance', width: 14 },
    { header: 'Статус', key: 'status', width: 12 },
    { header: 'Валюта', key: 'currency', width: 8 },
    { header: 'Выставлен', key: 'issue', width: 12 },
    { header: 'Срок', key: 'due', width: 12 },
  ]
  ws2.getRow(1).font = { bold: true }
  for (const r of invRaw ?? []) {
    const b = one(r.bookings as unknown)
    const client = b ? one((b as { clients?: unknown }).clients) : null
    const partner = one(r.partners as unknown)
    const amount = Number(r.amount ?? 0)
    const paid = paidByInvoice.get(r.id) ?? 0
    const status = paid <= 0 ? 'Unpaid' : paid >= amount && amount > 0 ? 'Paid' : 'Partial'
    ws2.addRow({
      num: r.invoice_number ?? '',
      supplier: (partner as { name?: string | null } | null)?.name ?? '',
      booking: (b as { booking_code?: string | null } | null)?.booking_code ?? '',
      client: (client as { name?: string | null } | null)?.name ?? '',
      amount,
      paid,
      balance: amount - paid,
      status,
      currency: r.currency ?? '',
      issue: r.issue_date ?? '',
      due: r.due_date ?? '',
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="accounting-export.xlsx"',
    },
  })
}