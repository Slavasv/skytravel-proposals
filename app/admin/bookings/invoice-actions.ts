'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

// Инвойсы поставщиков — счета, которые нам выставили отели/партнёры.
// Заводит менеджер в брони. Привязка к брони обязательна. Валюта своя у каждого инвойса.

export type SupplierInvoice = {
  id: string
  booking_id: string
  company_id: string | null
  partner_id: string | null
  invoice_number: string | null
  amount: number | null
  currency: string | null
  issue_date: string | null
  due_date: string | null
  notes: string | null
}

export type InvoiceUpdate = {
  partner_id?: string | null
  invoice_number?: string | null
  amount?: number | null
  currency?: string | null
  issue_date?: string | null
  due_date?: string | null
  notes?: string | null
}

export async function getBookingInvoices(bookingId: string): Promise<SupplierInvoice[]> {
  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('supplier_invoices')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data as SupplierInvoice[]
}

export async function addInvoice(bookingId: string): Promise<SupplierInvoice | null> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  // company_id нужен для RLS (with check company_id = my_company_id())
  const { data: booking } = await supabase
    .from('bookings')
    .select('company_id')
    .eq('id', bookingId)
    .single()

  const { data, error } = await supabase
    .from('supplier_invoices')
    .insert({
      booking_id: bookingId,
      company_id: booking?.company_id ?? null,
      amount: 0,          // черновик — менеджер впишет сумму
      currency: 'EUR',
      created_by: user?.id ?? null,
    })
    .select().single()

  if (error) return null
  revalidatePath(`/admin/bookings/${bookingId}`)
  return data as SupplierInvoice
}

export async function updateInvoice(id: string, updates: InvoiceUpdate) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('supplier_invoices')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteInvoice(id: string) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('supplier_invoices').delete().eq('id', id)
  if (error) throw new Error(error.message)
}