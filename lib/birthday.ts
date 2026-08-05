// Помощники для дней рождения. Дата рождения хранится текстом ДД/ММ/ГГГГ (как везде в проекте).

export function parseBirth(dob: string | null | undefined): { day: number; month: number; year: number } | null {
    if (!dob) return null
    const s = dob.trim()
    const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
    if (m) return { day: +m[1], month: +m[2], year: +m[3] }
    const d = new Date(s)
    if (!isNaN(d.getTime())) return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() }
    return null
}

// Попадает ли день рождения (в любой год) в окно поездки ±paddingDays.
export function birthdayInTripWindow(
    dob: string | null | undefined,
    tripStart: string | null | undefined,
    tripEnd: string | null | undefined,
    paddingDays = 7
): boolean {
    const b = parseBirth(dob)
    if (!b) return false
    const startStr = tripStart || tripEnd
    const endStr = tripEnd || tripStart
    if (!startStr || !endStr) return false
    const start = new Date(startStr)
    const end = new Date(endStr)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false
    const from = new Date(start); from.setDate(from.getDate() - paddingDays); from.setHours(0, 0, 0, 0)
    const to = new Date(end); to.setDate(to.getDate() + paddingDays); to.setHours(23, 59, 59, 999)
    // окно короткое — проверяем годовщину во всех годах, которые оно задевает
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
        const bd = new Date(y, b.month - 1, b.day)
        if (bd >= from && bd <= to) return true
    }
    return false
}

// Сколько дней до ближайшего дня рождения от даты `from`.
export function daysUntilNextBirthday(dob: string | null | undefined, from: Date): number | null {
    const b = parseBirth(dob)
    if (!b) return null
    const base = new Date(from.getFullYear(), from.getMonth(), from.getDate())
    let next = new Date(from.getFullYear(), b.month - 1, b.day)
    if (next < base) next = new Date(from.getFullYear() + 1, b.month - 1, b.day)
    return Math.round((next.getTime() - base.getTime()) / 86400000)
}

// Возраст, который исполнится в ближайший день рождения.
export function turningAge(dob: string | null | undefined, from: Date): number | null {
    const b = parseBirth(dob)
    if (!b) return null
    const base = new Date(from.getFullYear(), from.getMonth(), from.getDate())
    let year = from.getFullYear()
    const thisYear = new Date(year, b.month - 1, b.day)
    if (thisYear < base) year += 1
    return year - b.year
}