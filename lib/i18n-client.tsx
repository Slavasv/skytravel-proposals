'use client'

// Клиентская часть i18n: провайдер языка (ставится в admin/layout) и хук useT().
// Серверные компоненты берут язык из getProfile()/getUiLang() и зовут tr() напрямую.

import { createContext, useContext } from 'react'
import { tr, type UiLang } from './i18n'

const LangContext = createContext<UiLang>('en')

export function LangProvider({ lang, children }: { lang: UiLang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>
}

export function useLang(): UiLang {
  return useContext(LangContext)
}

// Хук-хелпер: const t = useT(); ...  t('Clients', 'Клиенты')
export function useT(): (en: string, ru: string) => string {
  const lang = useContext(LangContext)
  return (en: string, ru: string) => tr(lang, en, ru)
}
