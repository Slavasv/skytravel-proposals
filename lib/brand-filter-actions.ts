'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { BRAND_COOKIE } from '@/lib/brand-filter'

// Установить активный бренд-фильтр ('all' или company_id). Хранится в cookie на год.
export async function setBrandFilter(value: string) {
  const jar = await cookies()
  jar.set(BRAND_COOKIE, value || 'all', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  revalidatePath('/admin', 'layout')
}
