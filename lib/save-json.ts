// Клиентский помощник: POST JSON на стабильный API-роут (вместо серверного экшена).
// Нужен, чтобы автосейв не ловил «Server Action not found» при деплое.
export async function saveJson(url: string, body: unknown): Promise<void> {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j?.error || `HTTP ${res.status}`)
    }
}