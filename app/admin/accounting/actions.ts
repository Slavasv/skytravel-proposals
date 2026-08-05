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

// ---- Поставщики (для выбора в форме инвойса) ----
export type PartnerLite = { id: string; name: string }

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