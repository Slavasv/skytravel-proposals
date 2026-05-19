'use client'

import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768

/**
 * Возвращает true если ширина окна меньше 768px.
 * Реактивно обновляется при изменении размера окна.
 *
 * Использование в компоненте:
 *   const isMobile = useIsMobile()
 *   <div style={{ flexDirection: isMobile ? 'column' : 'row' }}>
 */
export function useIsMobile(): boolean {
  // По умолчанию false. Это важно для SSR — на сервере window недоступен,
  // поэтому первый рендер всегда desktop. После маунта в браузере проверяем реально.
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Проверка на mount: реальное состояние сейчас
    function check() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    check() // вызвать сразу при маунте

    // Подписка на ресайз окна (когда юзер крутит iPhone, открывает DevTools, etc.)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return isMobile
}