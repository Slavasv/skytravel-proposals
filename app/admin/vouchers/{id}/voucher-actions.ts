'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export type Guest = {
  id: string
  title: string      // Mr / Mrs / Ms / Miss / ''
  name: string
  is_child: boolean
  birth_date: string // текст, только если is_child
}

export type VoucherUpdate = {
  voucher_no?: string | null
  issue_date?: string | null
  booking_ref?: string | null
  guests?: unknown
  show_transfer?: boolean
  transfers?: unknown
  notes?: string | null
}

export async function updateVoucher(id: string, updates: VoucherUpdate) {
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('vouchers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/vouchers/${id}`)
}