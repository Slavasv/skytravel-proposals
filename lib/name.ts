// Имя путешественника: отдельно имя и фамилия, плюс собранное `name` для мест,
// которые до сих пор читают одну строку (ваучеры, предложения, PDF и т.д.).

// Собрать «Имя Фамилия» (схлопнуть лишние пробелы).
export function composeName(first: string | null | undefined, last: string | null | undefined): string {
  return `${(first || '').trim()} ${(last || '').trim()}`.trim().replace(/\s+/g, ' ')
}

// Разбить одну строку на имя/фамилию: последнее слово — фамилия, остальное — имя.
// Одно слово — считаем именем (фамилия пустая).
export function splitName(full: string | null | undefined): { first: string; last: string } {
  const parts = (full || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
  if (parts.length === 0) return { first: '', last: '' }
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}
