// Состав гостей из travellers заявки → строка вида «2 взрослых + 3 детей (14, 11, 7)».
// Ребёнок: title Chd/Inf или relation Child. Возраст — из date_of_birth «ДД/ММ/ГГГГ».

export type TravellerLite = {
  title?: string | null
  relation?: string | null
  date_of_birth?: string | null
}

function ageFrom(dob?: string | null): number | null {
  if (!dob) return null
  const m = dob.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (!m) return null
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3])
  const birth = new Date(y, mo - 1, d)
  if (isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - y
  const md = now.getMonth() - (mo - 1)
  if (md < 0 || (md === 0 && now.getDate() < d)) age--
  return age >= 0 && age < 120 ? age : null
}

export function buildOccupancy(travellers: TravellerLite[], lang: 'ru' | 'en' = 'ru'): string {
  let adults = 0
  const childAges: (number | null)[] = []
  for (const t of travellers || []) {
    const isChild = ['Chd', 'Inf'].includes((t.title || '')) || (t.relation || '') === 'Child'
    if (isChild) childAges.push(ageFrom(t.date_of_birth))
    else adults++
  }
  const children = childAges.length
  const parts: string[] = []
  if (adults > 0) parts.push(lang === 'ru' ? `${adults} взрослых` : `${adults} adults`)
  if (children > 0) {
    const ages = childAges.filter((a): a is number => a != null).sort((a, b) => b - a)
    const agesStr = ages.length ? ` (${ages.join(', ')})` : ''
    parts.push((lang === 'ru' ? `${children} детей` : `${children} children`) + agesStr)
  }
  return parts.join(' + ')
}
