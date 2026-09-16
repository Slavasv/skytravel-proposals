// Модель данных авиаваучера. Всё хранится в одном JSONB-поле vouchers.flight_data
// (тип ваучера — vouchers.voucher_type = 'flight'). Общий модуль для редактора,
// публичного шаблона и серверных экшенов.

export type FlightSegment = {
    flight_no: string   // VY 1678
    from: string        // SCQ
    to: string          // BCN
    dep: string         // 13:35
    arr: string         // 15:15
    duration: string    // 1h 40m
    note: string        // Connection BCN: 3h 55m / Naples T1
}

export type FlightPassenger = {
    id: string
    name: string        // Anton Kuzmenko
    cabin: string       // 1 underseat bag
    checked: string     // 1 × 25 kg (in hold)
    extras: string      // 1 windsurfing equipment
    seats_out: string   // 7A / 5A
    seats_ret: string   // 5F / 9A
}

export type FlightData = {
    pnr: string             // код брони (FE6CQL)
    airline: string         // Vueling
    outbound_label: string  // Sun 5 April
    return_label: string    // Mon 13 April
    outbound: FlightSegment[]
    return: FlightSegment[]
    passengers: FlightPassenger[]
    footer_note: string
}

export function blankSegment(): FlightSegment {
    return { flight_no: '', from: '', to: '', dep: '', arr: '', duration: '', note: '' }
}

export function blankPassenger(): FlightPassenger {
    return {
        id: Math.random().toString(36).slice(2),
        name: '', cabin: '', checked: '', extras: '', seats_out: '', seats_ret: '',
    }
}

export function emptyFlightData(): FlightData {
    return {
        pnr: '', airline: '',
        outbound_label: '', return_label: '',
        outbound: [blankSegment()],
        return: [],
        passengers: [],
        footer_note: '',
    }
}

function str(v: unknown): string {
    return typeof v === 'string' ? v : ''
}

function normSegment(raw: unknown): FlightSegment {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    return {
        flight_no: str(o.flight_no), from: str(o.from), to: str(o.to),
        dep: str(o.dep), arr: str(o.arr), duration: str(o.duration), note: str(o.note),
    }
}

function normPassenger(raw: unknown): FlightPassenger {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    return {
        id: str(o.id) || Math.random().toString(36).slice(2),
        name: str(o.name),
        cabin: str(o.cabin), checked: str(o.checked), extras: str(o.extras),
        seats_out: str(o.seats_out), seats_ret: str(o.seats_ret),
    }
}

// Приводим что угодно из БД к валидной структуре (устойчиво к null/старым данным).
export function normalizeFlightData(raw: unknown): FlightData {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    return {
        pnr: str(o.pnr),
        airline: str(o.airline),
        outbound_label: str(o.outbound_label),
        return_label: str(o.return_label),
        outbound: Array.isArray(o.outbound) ? o.outbound.map(normSegment) : [],
        return: Array.isArray(o.return) ? o.return.map(normSegment) : [],
        passengers: Array.isArray(o.passengers) ? o.passengers.map(normPassenger) : [],
        footer_note: str(o.footer_note),
    }
}
