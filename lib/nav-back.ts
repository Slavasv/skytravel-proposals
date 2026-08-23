// Вернуться туда, откуда пришли, по нажатию «Готово».
// Приоритет: 1) ?returnTo= в URL → туда; 2) назад по истории (та страница, с которой
// перешли) — если allowBack; 3) запасной путь.
// allowBack=false для страниц с внутренней навигацией по URL (напр. варианты предложения),
// где «назад» ушёл бы не из редактора, а на предыдущий внутренний шаг.
export function goBackOrTo(
    router: { push: (href: string) => void; back: () => void },
    fallback: string,
    allowBack = true,
): void {
    try {
        const rt = new URLSearchParams(window.location.search).get('returnTo')
        if (rt) { router.push(rt); return }
        if (allowBack) {
            const idx = (window.history.state && (window.history.state as { idx?: number }).idx) ?? 0
            if (idx > 0) { router.back(); return }
        }
    } catch { /* ignore */ }
    router.push(fallback)
}