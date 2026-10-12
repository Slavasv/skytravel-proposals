'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'

export type PayerRow = {
  id: string
  client_id: string | null
  client_name: string | null
  share_amount: number | null
  share_currency: string
  account_id: string | null
  note: string | null
  sort_order: number
}

export type PayerBalance = PayerRow & { paid: number; remaining: number | null }

export type OtherReceipt = { client_id: string | null; client_name: string | null; amount: number; currency: string }

export type SplitView = {
  payers: PayerBalance[]
  bookingTotals: { currency: string; amount: number }[]   // стоимость брони (gross) по валютам
  other: OtherReceipt[]                                    // поступления, не свёрнутые в доли
  accounts: { id: string; name: string; currency: string }[]
  clients: { id: string; name: string }[]
  bookingClient: { id: string; name: string } | null
}

function arr<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

export async function getSplit(bookingId: string): Promise<SplitView> {
  const supabase = await createSupabaseServer()

  // плательщики
  const { data: payersRaw } = await supabase
    .from('booking_payers')
    .select('id, client_id, share_amount, share_currency, account_id, note, sort_order, clients(name)')
    .eq('booking_id', bookingId)
    .order('sort_order', { ascending: true })

  // услуги брони → стоимость по валютам
  const { data: svc } = await supabase
    .from('booking_services')
    .select('gross, currency')
    .eq('booking_id', bookingId)
  const totalsMap: Record<string, number> = {}
  for (const s of svc ?? []) {
    const cur = (s.currency as string | null) || 'EUR'
    totalsMap[cur] = (totalsMap[cur] ?? 0) + Number(s.gross ?? 0)
  }

  // фактические поступления по брони: аллокации + их платёж
  const { data: allocs } = await supabase
    .from('transaction_allocations')
    .select('amount, transactions(client_id, currency, direction, category)')
    .eq('booking_id', bookingId)
  // сумма по (client_id, currency), только приход клиента
  const paidMap: Record<string, number> = {} // key `${client_id}|${currency}`
  for (const a of allocs ?? []) {
    const tx = arr(a.transactions as unknown as { client_id: string | null; currency: string | null; direction: string | null; category: string | null } | Record<string, unknown>[])
    if (!tx) continue
    if (tx.direction !== 'in' || tx.category !== 'client_payment') continue
    const cid = (tx.client_id as string | null) || 'none'
    const cur = (tx.currency as string | null) || 'EUR'
    const key = `${cid}|${cur}`
    paidMap[key] = (paidMap[key] ?? 0) + Number(a.amount ?? 0)
  }

  const payers: PayerBalance[] = (payersRaw ?? []).map((p) => {
    const cid = (p.client_id as string | null) || 'none'
    const cur = (p.share_currency as string) || 'EUR'
    const paid = paidMap[`${cid}|${cur}`] ?? 0
    const share = p.share_amount == null ? null : Number(p.share_amount)
    return {
      id: p.id as string,
      client_id: (p.client_id as string | null) ?? null,
      client_name: (arr(p.clients as unknown as { name: string } | { name: string }[])?.name as string | null) ?? null,
      share_amount: share,
      share_currency: cur,
      account_id: (p.account_id as string | null) ?? null,
      note: (p.note as string | null) ?? null,
      sort_order: (p.sort_order as number) ?? 0,
      paid,
      remaining: share == null ? null : share - paid,
    }
  })

  // «прочие поступления» = оплаты по брони, НЕ попавшие ни в одну долю (другой клиент или валюта)
  const coveredKeys = new Set(payers.map((p) => `${p.client_id || 'none'}|${p.share_currency}`))
  const other: OtherReceipt[] = []
  const nameByClient: Record<string, string> = {}
  for (const p of payers) if (p.client_id && p.client_name) nameByClient[p.client_id] = p.client_name
  for (const [key, amount] of Object.entries(paidMap)) {
    if (coveredKeys.has(key)) continue
    const [cid, cur] = key.split('|')
    other.push({ client_id: cid === 'none' ? null : cid, client_name: nameByClient[cid] ?? null, amount, currency: cur })
  }

  // счета и клиенты для форм
  const { data: accs } = await supabase
    .from('payment_accounts').select('id, name, currency').eq('archived', false).order('name', { ascending: true })
  const { data: cls } = await supabase.from('clients').select('id, name').order('name', { ascending: true })

  // клиент брони (для плательщика №1)
  const { data: bk } = await supabase.from('bookings').select('client_id, clients(name)').eq('id', bookingId).single()
  const bookingClient = bk?.client_id
    ? { id: bk.client_id as string, name: (arr(bk.clients as unknown as { name: string } | { name: string }[])?.name as string | null) || '—' }
    : null

  // дотянуть имена клиентов в «прочие», если их нет среди плательщиков
  const missing = other.filter((o) => o.client_id && !o.client_name).map((o) => o.client_id as string)
  if (missing.length) {
    const { data: mn } = await supabase.from('clients').select('id, name').in('id', missing)
    const map = new Map((mn ?? []).map((c) => [c.id as string, c.name as string]))
    for (const o of other) if (o.client_id && !o.client_name) o.client_name = map.get(o.client_id) ?? null
  }

  return {
    payers,
    bookingTotals: Object.entries(totalsMap).map(([currency, amount]) => ({ currency, amount })),
    other,
    accounts: (accs ?? []).map((a) => ({ id: a.id as string, name: a.name as string, currency: a.currency as string })),
    clients: (cls ?? []).map((c) => ({ id: c.id as string, name: (c.name as string | null) || '—' })),
    bookingClient,
  }
}

export async function addPayer(bookingId: string, clientId: string | null, shareCurrency = 'EUR'): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer()
  const { data: last } = await supabase
    .from('booking_payers').select('sort_order').eq('booking_id', bookingId).order('sort_order', { ascending: false }).limit(1)
  const nextOrder = last && last.length > 0 ? (last[0].sort_order as number) + 1 : 0
  const { error } = await supabase.from('booking_payers').insert({
    booking_id: bookingId, client_id: clientId, share_currency: shareCurrency, sort_order: nextOrder,
  })
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/admin/bookings/${bookingId}`)
  return { ok: true }
}

export async function updatePayer(id: string, patch: {
  client_id?: string | null
  share_amount?: number | null
  share_currency?: string
  account_id?: string | null
  note?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('booking_payers').update(patch).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deletePayer(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createSupabaseServer()
  const { error } = await supabase.from('booking_payers').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
