'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import type { UiLang } from '@/lib/i18n'

// Сменить язык интерфейса ТЕКУЩЕГО пользователя.
// Меняем только своё поле ui_language и только для своего id (id берём из сессии,
// не из аргумента), значение зажато в 'en'/'ru' — злоупотребить нельзя.
export async function setUiLanguage(lang: UiLang): Promise<{ ok: boolean }> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }

  const value: UiLang = lang === 'ru' ? 'ru' : 'en'

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('profiles')
    .update({ ui_language: value })
    .eq('id', user.id)

  if (error) return { ok: false }

  // язык влияет на весь layout админки
  revalidatePath('/', 'layout')
  return { ok: true }
}
