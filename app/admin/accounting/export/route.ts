import { NextRequest } from 'next/server'
import ExcelJS from 'exceljs'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getProfile, canSeeAccounting } from '@/lib/get-profile'
import { tr } from '@/lib/i18n'

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}
function name(v: unknown): string {
  return (v as { name?: string | null } | null)?.name ?? ''
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

  // язык выгрузки — язык интерфейса пользователя, который жмёт «Экспорт»
  const lang = profile?.ui_language ?? 'en'
  const T = (en: string, ru: string) => tr(lang, en, ru)
  const catLabel = (cat: string): string => {
    switch (cat) {
      case 'client_payment': return T('Client payment', 'Оплата клиента')
      case 'hotel_commission': return T('Hotel commission', 'Комиссия отеля')
      case 'supplier_payment': return T('Supplier payment', 'Оплата поставщику')
      case 'other': return T('Other', 'Прочее')
      default: return cat
    }
  }

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')
  // какая вкладка выгружается: ledger | invoices | debts | all
  const tab = req.nextUrl.searchParams.get('tab') || 'all'
  const want = (t: string) => tab === t || tab === 'all'

  const supabase = await createSupabaseServer()
  // доступ уже проверен гардом выше; данные тянем service-role'ом с фильтром
  // по компании — в GET-route RLS иногда не видит сессию и отдаёт пусто.
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = user
    ? await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    : { data: null }
  const companyId = me?.company_id ?? null
  const db = createSupabaseAdmin()

  const { data: txRaw } = await db
    .from('transactions')
    .select(`
      id, direction, category, amount, currency, paid_on,
      bookings ( booking_code, clients ( name ) ),
      supplier_invoices ( invoice_number, partners ( name ) )
    `)
    .eq('company_id', companyId)
    .order('paid_on', { ascending: false })

  const { data: invRaw } = await db
    .from('supplier_invoices')
    .select(`
      id, invoice_number, amount, currency, issue_date, due_date,
      partners ( name ),
      bookings ( booking_code, clients ( name ) )
    `)
    .eq('company_id', companyId)
    .order('issue_date', { ascending: false })

  const { data: payRaw } = await db
    .from('transactions')
    .select('invoice_id, amount, direction')
    .eq('company_id', companyId)

  const paidByInvoice = new Map<string, number>()
  for (const p of payRaw ?? []) {
    if (p.direction !== 'out' || !p.invoice_id) continue
    paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
  }

  const wb = new ExcelJS.Workbook()
  const bold = (ws: ExcelJS.Worksheet) => { ws.getRow(1).font = { bold: true } }

  // --- Приход-расход (за период) ---
  if (want('ledger')) {
    const ws = wb.addWorksheet(T('Cash flow', 'Приход-расход'))
    ws.columns = [
      { header: T('Date', 'Дата'), key: 'date', width: 12 },
      { header: T('Booking', 'Бронь'), key: 'booking', width: 16 },
      { header: T('Client', 'Клиент'), key: 'client', width: 22 },
      { header: T('Type', 'Тип'), key: 'type', width: 20 },
      { header: T('Direction', 'Направление'), key: 'dir', width: 12 },
      { header: T('Invoice', 'Инвойс'), key: 'invoice', width: 16 },
      { header: T('Supplier', 'Поставщик'), key: 'supplier', width: 22 },
      { header: T('Amount', 'Сумма'), key: 'amount', width: 14 },
      { header: T('Currency', 'Валюта'), key: 'currency', width: 8 },
    ]
    bold(ws)
    for (const r of txRaw ?? []) {
      if (!inPeriod(r.paid_on, from, to)) continue
      const b = one(r.bookings as unknown)
      const client = b ? one((b as { clients?: unknown }).clients) : null
      const inv = one(r.supplier_invoices as unknown)
      const invPartner = inv ? one((inv as { partners?: unknown }).partners) : null
      ws.addRow({
        date: r.paid_on ?? '',
        booking: (b as { booking_code?: string | null } | null)?.booking_code ?? '',
        client: name(client),
        type: catLabel(r.category),
        dir: r.direction === 'in' ? T('Income', 'Приход') : T('Expense', 'Расход'),
        invoice: (inv as { invoice_number?: string | null } | null)?.invoice_number ?? '',
        supplier: name(invPartner),
        amount: Number(r.amount ?? 0),
        currency: r.currency ?? '',
      })
    }
  }

  // --- Инвойсы (все, с остатком) ---
  if (want('invoices')) {
    const ws = wb.addWorksheet(T('Invoices', 'Инвойсы'))
    ws.columns = [
      { header: T('Invoice №', 'Инвойс №'), key: 'num', width: 16 },
      { header: T('Supplier', 'Поставщик'), key: 'supplier', width: 22 },
      { header: T('Booking', 'Бронь'), key: 'booking', width: 16 },
      { header: T('Client', 'Клиент'), key: 'client', width: 22 },
      { header: T('Amount', 'Сумма'), key: 'amount', width: 14 },
      { header: T('Paid', 'Оплачено'), key: 'paid', width: 14 },
      { header: T('Balance', 'Остаток'), key: 'balance', width: 14 },
      { header: T('Status', 'Статус'), key: 'status', width: 12 },
      { header: T('Currency', 'Валюта'), key: 'currency', width: 8 },
      { header: T('Issued', 'Выставлен'), key: 'issue', width: 12 },
      { header: T('Due', 'Срок'), key: 'due', width: 12 },
    ]
    bold(ws)
    for (const r of invRaw ?? []) {
      const b = one(r.bookings as unknown)
      const client = b ? one((b as { clients?: unknown }).clients) : null
      const partner = one(r.partners as unknown)
      const amount = Number(r.amount ?? 0)
      const paid = paidByInvoice.get(r.id) ?? 0
      const status = paid <= 0
        ? T('Unpaid', 'Не оплачен')
        : paid >= amount && amount > 0 ? T('Paid', 'Оплачен') : T('Partial', 'Частично')
      ws.addRow({
        num: r.invoice_number ?? '',
        supplier: name(partner),
        booking: (b as { booking_code?: string | null } | null)?.booking_code ?? '',
        client: name(client),
        amount, paid, balance: amount - paid, status,
        currency: r.currency ?? '',
        issue: r.issue_date ?? '',
        due: r.due_date ?? '',
      })
    }
  }

  // --- Задолженности (кому должны поставщикам + кто должен нам) ---
  if (want('debts')) {
    // кому должны — из неоплаченных остатков инвойсов
    const wsP = wb.addWorksheet(T('Payables', 'Кому должны'))
    wsP.columns = [
      { header: T('Supplier', 'Поставщик'), key: 'supplier', width: 26 },
      { header: T('Balance due', 'Остаток к оплате'), key: 'balance', width: 16 },
      { header: T('Currency', 'Валюта'), key: 'currency', width: 8 },
    ]
    bold(wsP)
    const pay: Record<string, { supplier: string; currency: string; balance: number }> = {}
    for (const r of invRaw ?? []) {
      const amount = Number(r.amount ?? 0)
      const bal = amount - (paidByInvoice.get(r.id) ?? 0)
      if (bal <= 0.005) continue
      const supplier = name(one(r.partners as unknown)) || '—'
      const cur = r.currency || ''
      const k = `${supplier}||${cur}`
      pay[k] = pay[k] ?? { supplier, currency: cur, balance: 0 }
      pay[k].balance += bal
    }
    Object.values(pay).sort((a, b) => b.balance - a.balance).forEach((p) => wsP.addRow(p))

    // кто должен нам — продажа (gross услуг) минус оплаты клиента
    const { data: svcRaw } = await db
      .from('booking_services')
      .select('gross, currency, bookings!inner ( company_id, clients ( name ) )')
      .eq('bookings.company_id', companyId)

    const recv: Record<string, { client: string; currency: string; sale: number; paid: number }> = {}
    const clientOf = (row: { bookings?: unknown }): string => {
      const bk = one(row.bookings as unknown)
      return name(bk ? one((bk as { clients?: unknown }).clients) : null) || '—'
    }
    for (const s of svcRaw ?? []) {
      const cur = (s as { currency?: string | null }).currency || ''
      const client = clientOf(s as { bookings?: unknown })
      const k = `${client}||${cur}`
      recv[k] = recv[k] ?? { client, currency: cur, sale: 0, paid: 0 }
      recv[k].sale += Number((s as { gross?: number | null }).gross ?? 0)
    }
    for (const tx of txRaw ?? []) {
      if (tx.category !== 'client_payment') continue
      const cur = tx.currency || ''
      const client = clientOf(tx as { bookings?: unknown })
      const k = `${client}||${cur}`
      recv[k] = recv[k] ?? { client, currency: cur, sale: 0, paid: 0 }
      recv[k].paid += Number(tx.amount ?? 0)
    }

    const wsR = wb.addWorksheet(T('Receivables', 'Кто должен нам'))
    wsR.columns = [
      { header: T('Client', 'Клиент'), key: 'client', width: 26 },
      { header: T('Sale', 'Продажа'), key: 'sale', width: 14 },
      { header: T('Paid', 'Оплачено'), key: 'paid', width: 14 },
      { header: T('Balance', 'Остаток'), key: 'balance', width: 14 },
      { header: T('Currency', 'Валюта'), key: 'currency', width: 8 },
    ]
    bold(wsR)
    Object.values(recv)
      .map((r) => ({ ...r, balance: r.sale - r.paid }))
      .filter((r) => Math.abs(r.balance) > 0.005)
      .sort((a, b) => b.balance - a.balance)
      .forEach((r) => wsR.addRow({ client: r.client, sale: r.sale, paid: r.paid, balance: r.balance, currency: r.currency }))
  }

  // на всякий случай — хотя бы один лист
  if (wb.worksheets.length === 0) wb.addWorksheet(T('Empty', 'Пусто'))

  const buffer = await wb.xlsx.writeBuffer()
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="accounting-export.xlsx"',
    },
  })
}