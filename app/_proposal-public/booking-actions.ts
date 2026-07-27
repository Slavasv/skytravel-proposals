'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import nodemailer from 'nodemailer'

// Клиент нажал «Забронировать» на публичной странице (аноним):
// 1) отмечаем выбранный им вариант (is_selected) — агент увидит в админке;
// 2) шлём письмо-уведомление на почту бренда.
// Всё на сервере через service-role (страница анонимная, RLS не пустит аноним).
export async function notifyClientChoice(input: {
  proposalId: string
  variantId: string
  slug: string
}): Promise<{ ok: boolean }> {
  const admin = createSupabaseAdmin()

  // 1) отметить выбор клиента (один вариант выбран)
  await admin.from('proposal_variants').update({ is_selected: false }).eq('proposal_id', input.proposalId)
  await admin.from('proposal_variants').update({ is_selected: true }).eq('id', input.variantId)

  // 2) собрать данные для письма
  const { data: proposal } = await admin
    .from('proposals')
    .select('trip_title_ru, client_name_ru, company_id')
    .eq('id', input.proposalId)
    .single()

  const { data: variant } = await admin
    .from('proposal_variants')
    .select('name_ru, sort_order, total_price')
    .eq('id', input.variantId)
    .single()

  let toEmail = process.env.EMAIL_TO || ''
  if (!toEmail && proposal?.company_id) {
    const { data: company } = await admin
      .from('companies')
      .select('contact_email')
      .eq('id', proposal.company_id)
      .single()
    toEmail = company?.contact_email || ''
  }

  const host = process.env.EMAIL_HOST
  const port = Number(process.env.EMAIL_PORT || 465)
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS
  // адрес-отправитель: у Gmail/Outlook = логин, у Resend логин="resend", поэтому отдельно
  const from = process.env.EMAIL_FROM || user || ''
  toEmail = toEmail || from || ''

  if (!host || !user || !pass || !toEmail) {
    // почта не настроена — выбор всё равно отмечен, просто без письма
    return { ok: false }
  }

  const routeName = variant?.name_ru || `Маршрут ${(variant?.sort_order ?? 0) + 1}`
  const trip = proposal?.trip_title_ru || ''
  const client = proposal?.client_name_ru || ''
  const subject = `Клиент выбрал маршрут: ${trip}${trip ? ' — ' : ''}${routeName}`
  const text =
    `Клиент${client ? ` «${client}»` : ''} выбрал вариант «${routeName}»` +
    `${trip ? ` в предложении «${trip}»` : ''}.\n` +
    `Итог по варианту: ${variant?.total_price ?? '—'}\n` +
    `Ссылка на предложение: /p/${input.slug}\n\n` +
    `Это автоматическое уведомление — клиент нажал «Забронировать» на странице предложения.`

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })
    await transporter.sendMail({ from, to: toEmail, subject, text })
    return { ok: true }
  } catch {
    return { ok: false }
  }
}