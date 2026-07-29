'use server'

import { createSupabaseAdmin } from '@/lib/supabase-admin'
import nodemailer from 'nodemailer'

// Клиент на странице направления нажал «Хочу такое путешествие».
// Файл уходит клиенту напрямую (не публичный сайт), поэтому контакты не собираем —
// просто уведомляем менеджера бренда, что клиент заинтересовался этим направлением.
// Схема письма та же, что в booking-actions (EMAIL_* + fallback на company.contact_email).
export async function notifyDestinationInterest(input: {
  proposalId: string
  slug: string
}): Promise<{ ok: boolean }> {
  const admin = createSupabaseAdmin()

  const { data: proposal } = await admin
    .from('proposals')
    .select('trip_title_ru, client_name_ru, company_id')
    .eq('id', input.proposalId)
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
  const from = process.env.EMAIL_FROM || user || ''
  toEmail = toEmail || from || ''

  if (!host || !user || !pass || !toEmail) return { ok: false }

  const trip = proposal?.trip_title_ru || ''
  const client = proposal?.client_name_ru || ''
  const subject = `Клиент хочет такое путешествие${trip ? `: ${trip}` : ''}`
  const text =
    `Клиент${client ? ` «${client}»` : ''} нажал «Хочу такое путешествие»` +
    `${trip ? ` на направлении «${trip}»` : ''}.\n` +
    `Страница: /d/${input.slug}\n\n` +
    `Это автоматическое уведомление со страницы направления — свяжитесь с клиентом.`

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
