'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// Приход-расход. Привязка к брони обязательна. Для расхода-оплаты поставщику —
// ссылка на инвойс (тогда его остаток гасится). Валюта своя у платежа.

export type NewTransaction = {
  booking_id: string
  account_id: string | null
  direction: 'in' | 'out'
  category: string
  invoice_id: string | null
  amount: number
  currency: string
  paid_on: string | null
  notes: string | null
}

export type AccountRow = {
  id: string
  name: string
  currency: string
  archived: boolean
}

// ---- Справочник счетов ----
export async function addAccount(name: string, currency: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  let companyId: string | null = null
  if (user) {
    const { data: me } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    companyId = me?.company_id ?? null
  }
  if (!companyId) return { ok: false, error: 'Компания не найдена' }
  const nm = name.trim()
  if (!nm) return { ok: false, error: 'Введите название счёта' }
  const { error } = await supabase.from('payment_accounts').insert({ company_id: companyId, name: nm, currency })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/accounting')
  return { ok: true }
}

export async function archiveAccount(id: string): Promise<void> {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('payment_accounts').update({ archived: true }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/accounting')
}

// ---- Поставщики / клиенты (для выбора в формах) ----
export type PartnerLite = { id: string; name: string }
export type ClientLite = { id: string; name: string }

// ---- Платёж с разбивкой (аллокациями) ----
export type PaymentAllocation = { booking_id: string | null; invoice_id: string | null; amount: number }
export type NewPayment = {
  kind: 'client' | 'supplier' | 'exchange'
  client_id: string | null
  partner_id: string | null
  account_id: string | null
  currency: string
  amount: number
  to_account_id: string | null
  to_amount: number | null
  to_currency: string | null
  commission: number
  commission_currency: string | null
  debit_amount: number | null
  debit_currency: string | null
  paid_on: string | null
  notes: string | null
  allocations: PaymentAllocation[]
}

export async function addPayment(input: NewPayment): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  let companyId: string | null = null
  if (user) {
    const { data: me } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    companyId = me?.company_id ?? null
  }

  const commission = input.commission > 0 ? input.commission : 0
  const commissionCurrency = commission > 0 ? (input.commission_currency || input.currency) : null

  // ОБМЕН ВАЛЮТ: перевод между счетами, без броней/инвойсов
  if (input.kind === 'exchange') {
    if (!input.account_id || !input.to_account_id) return { ok: false, error: 'Выберите оба счёта' }
    if (!(input.amount > 0) || !(input.to_amount && input.to_amount > 0)) return { ok: false, error: 'Введите суммы обмена' }
    const { error } = await supabase.from('transactions').insert({
      company_id: companyId,
      booking_id: null,
      direction: 'out',
      category: 'exchange',
      client_id: null,
      partner_id: null,
      account_id: input.account_id,
      amount: input.amount,
      currency: input.currency,
      to_account_id: input.to_account_id,
      to_amount: input.to_amount,
      to_currency: input.to_currency,
      commission,
      commission_currency: commissionCurrency,
      paid_on: input.paid_on,
      notes: input.notes,
      created_by: user?.id ?? null,
    })
    if (error) return { ok: false, error: error.message }
    revalidatePath('/admin/accounting')
    return { ok: true }
  }

  // ОПЛАТА КЛИЕНТА / ПОСТАВЩИКУ
  const allocs = input.allocations.filter((a) => a.amount > 0 && (a.booking_id || a.invoice_id))
  if (allocs.length === 0) return { ok: false, error: 'Добавьте хотя бы одну строку с суммой' }
  const total = allocs.reduce((s, a) => s + a.amount, 0)

  const invoiceIds = allocs.map((a) => a.invoice_id).filter((x): x is string => !!x)
  const invBooking = new Map<string, string | null>()
  if (invoiceIds.length) {
    const { data: invs } = await supabase.from('supplier_invoices').select('id, booking_id').in('id', invoiceIds)
    for (const iv of invs ?? []) invBooking.set(iv.id as string, (iv.booking_id as string | null) ?? null)
  }

  const direction = input.kind === 'client' ? 'in' : 'out'
  const category = input.kind === 'client' ? 'client_payment' : 'supplier_payment'

  const { data: tx, error: txErr } = await supabase.from('transactions').insert({
    company_id: companyId,
    booking_id: null,
    direction,
    category,
    client_id: input.kind === 'client' ? input.client_id : null,
    partner_id: input.kind === 'supplier' ? input.partner_id : null,
    amount: total,
    currency: input.currency,
    account_id: input.account_id,
    debit_amount: input.debit_amount,
    debit_currency: input.debit_amount != null ? (input.debit_currency || input.currency) : null,
    commission,
    commission_currency: commissionCurrency,
    paid_on: input.paid_on,
    notes: input.notes,
    created_by: user?.id ?? null,
  }).select('id').single()
  if (txErr || !tx) return { ok: false, error: txErr?.message || 'Ошибка' }

  const rows = allocs.map((a) => ({
    transaction_id: tx.id,
    booking_id: a.booking_id ?? (a.invoice_id ? invBooking.get(a.invoice_id) ?? null : null),
    invoice_id: a.invoice_id ?? null,
    amount: a.amount,
  }))
  const { error: alErr } = await supabase.from('transaction_allocations').insert(rows)
  if (alErr) return { ok: false, error: alErr.message }

  revalidatePath('/admin/accounting')
  return { ok: true }
}

// ---- Ручное добавление инвойса поставщика ----
export type NewInvoice = {
  booking_id: string
  partner_id: string | null
  invoice_number: string | null
  amount: number
  currency: string
  issue_date: string | null
  due_date: string | null
  notes: string | null
}

export async function addSupplierInvoice(input: NewInvoice): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: booking } = await supabase
    .from('bookings').select('company_id').eq('id', input.booking_id).single()

  const { error } = await supabase.from('supplier_invoices').insert({
    booking_id: input.booking_id,
    company_id: booking?.company_id ?? null,
    partner_id: input.partner_id,
    invoice_number: input.invoice_number,
    amount: input.amount,
    currency: input.currency,
    issue_date: input.issue_date,
    due_date: input.due_date,
    notes: input.notes,
    created_by: user?.id ?? null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/accounting')
  return { ok: true }
}

export async function updateSupplierInvoice(
  id: string, input: Omit<NewInvoice, 'booking_id'>
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('supplier_invoices').update({
    partner_id: input.partner_id,
    invoice_number: input.invoice_number,
    amount: input.amount,
    currency: input.currency,
    issue_date: input.issue_date,
    due_date: input.due_date,
    notes: input.notes,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/accounting')
  return { ok: true }
}

export async function deleteSupplierInvoice(id: string): Promise<void> {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('supplier_invoices').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/accounting')
}

export async function addTransaction(input: NewTransaction): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: booking } = await supabase
    .from('bookings')
    .select('company_id, client_id')
    .eq('id', input.booking_id)
    .single()

  // контрагент для отображения: поставщик из инвойса (расход) / клиент брони (приход)
  let partner_id: string | null = null
  if (input.invoice_id) {
    const { data: inv } = await supabase
      .from('supplier_invoices')
      .select('partner_id')
      .eq('id', input.invoice_id)
      .single()
    partner_id = inv?.partner_id ?? null
  }
  const client_id = input.direction === 'in' ? (booking?.client_id ?? null) : null

  const { error } = await supabase.from('transactions').insert({
    booking_id: input.booking_id,
    account_id: input.account_id,
    company_id: booking?.company_id ?? null,
    direction: input.direction,
    category: input.category,
    invoice_id: input.invoice_id,
    client_id,
    partner_id,
    amount: input.amount,
    currency: input.currency,
    paid_on: input.paid_on,
    notes: input.notes,
    created_by: user?.id ?? null,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/accounting')
  return { ok: true }
}

export async function deleteTransaction(id: string): Promise<void> {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/accounting')
}