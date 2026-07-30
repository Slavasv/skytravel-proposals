// Ядро i18n админки — ЧИСТЫЕ хелперы (без React, без server-only импортов),
// поэтому файл можно импортировать и в серверных, и в клиентских компонентах.
//
// Приём: перевод живёт прямо на месте вызова — t('English text', 'Русский текст').
// По умолчанию (и как первый аргумент) — английский, потому что дефолт бренда = 'en'.

export type UiLang = 'en' | 'ru'

export function normalizeLang(v: unknown): UiLang {
  return v === 'ru' ? 'ru' : 'en'
}

// Выбрать строку по языку. en — первым (дефолтный язык), ru — вторым.
export function tr(lang: UiLang, en: string, ru: string): string {
  return lang === 'ru' ? ru : en
}
