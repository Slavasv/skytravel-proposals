'use client'

import { createContext, useContext, useState, useRef, useCallback } from 'react'
import type { Day, DayBlock } from './edit-page-client'
import { updateDayBlock, getProposalDays } from './block-actions'

export type SelectedRoom = { uid: string; room_id: string; guests: number; price: number | null; meal?: string | null }

type DaysContextValue = {
  days: Day[]
  variantId: string | null
  // изменить номера блока-отеля (тип/гости/добавление/удаление) — БЕЗ цен
  updateBlockRooms: (blockId: string, rooms: SelectedRoom[]) => void
  // вписать цену конкретного номера (из Costs)
  updateRoomPrice: (blockId: string, uid: string, price: number | null) => void
  // вписать цену активности/трансфера (из Costs)
  updateBlockPrice: (blockId: string, price: number | null) => void
  // ночи отеля по датам дней
  getNights: (blockId: string) => number | null
  // перечитать дни с сервера (после добавления/удаления блоков и дней)
  refresh: () => Promise<void>
}

const DaysContext = createContext<DaysContextValue | null>(null)

export function useDays() {
  const ctx = useContext(DaysContext)
  if (!ctx) throw new Error('useDays must be used inside DaysProvider')
  return ctx
}

export function DaysProvider({
  proposalId,
  variantId = null,
  initialDays,
  tripStart,
  tripEnd,
  children,
}: {
  proposalId: string
  variantId?: string | null
  initialDays: Day[]
  tripStart: string | null
  tripEnd: string | null
  children: React.ReactNode
}) {
  const [days, setDays] = useState<Day[]>(initialDays)

  const refresh = useCallback(async () => {
    const fresh = await getProposalDays(proposalId, variantId)
    setDays(fresh as Day[])
  }, [proposalId, variantId])

  // дебаунс-сохранение по каждому блоку отдельно
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const scheduleSave = useCallback((blockId: string, patch: Partial<DayBlock>) => {
    if (timers.current[blockId]) clearTimeout(timers.current[blockId])
    timers.current[blockId] = setTimeout(() => {
      updateDayBlock(blockId, patch).catch(() => {})
    }, 1000)
  }, [])

  // найти блок в дереве
  const findBlock = useCallback((blockId: string): DayBlock | null => {
    for (const d of days) {
      for (const b of d.day_blocks ?? []) {
        if (b.id === blockId) return b
      }
    }
    return null
  }, [days])

  const updateBlockRooms = useCallback((blockId: string, rooms: SelectedRoom[]) => {
    setDays((prev) => prev.map((d) => ({
      ...d,
      day_blocks: (d.day_blocks ?? []).map((b) =>
        b.id === blockId ? { ...b, selected_rooms: rooms } : b
      ),
    })))
    scheduleSave(blockId, { selected_rooms: rooms })
  }, [scheduleSave])

  const updateRoomPrice = useCallback((blockId: string, uid: string, price: number | null) => {
    setDays((prev) => {
      let saved: SelectedRoom[] = []
      const next = prev.map((d) => ({
        ...d,
        day_blocks: (d.day_blocks ?? []).map((b) => {
          if (b.id !== blockId) return b
          const rooms = (b.selected_rooms ?? []).map((r) =>
            r.uid === uid ? { ...r, price } : r
          )
          saved = rooms
          return { ...b, selected_rooms: rooms }
        }),
      }))
      scheduleSave(blockId, { selected_rooms: saved })
      return next
    })
  }, [scheduleSave])

  const updateBlockPrice = useCallback((blockId: string, price: number | null) => {
    setDays((prev) => prev.map((d) => ({
      ...d,
      day_blocks: (d.day_blocks ?? []).map((b) =>
        b.id === blockId ? { ...b, price } : b
      ),
    })))
    scheduleSave(blockId, { price })
  }, [scheduleSave])

  // Ночи отеля: от даты его дня до даты дня следующего отеля
  // (последний отель — до конца поездки).
  // Дата дня = days.date, если проставлена; иначе start_date + (номер дня − 1).
  const getNights = useCallback((blockId: string): number | null => {
    const parseDate = (s: string | null): Date | null => {
      if (!s) return null
      const d = new Date(s)
      return isNaN(d.getTime()) ? null : d
    }
    const start = parseDate(tripStart)
    const end = parseDate(tripEnd)

    const ordered = [...days].sort((a, b) => a.day_number - b.day_number)
    const firstDayNumber = ordered[0]?.day_number ?? 1

    // дата конкретного дня: сначала days.date, иначе считаем от start поездки
    const dayDate = (day: typeof ordered[number]): Date | null => {
      const own = parseDate(day.date)
      if (own) return own
      if (!start) return null
      const offset = day.day_number - firstDayNumber
      return new Date(start.getTime() + offset * 86400000)
    }

    // дни с отелями по порядку
    const hotelDays: { date: Date | null; blockIds: string[] }[] = []
    for (const d of ordered) {
      const ids = (d.day_blocks ?? [])
        .filter((b) => b.content_blocks?.type === 'hotel')
        .map((b) => b.id)
      if (ids.length > 0) hotelDays.push({ date: dayDate(d), blockIds: ids })
    }

    const idx = hotelDays.findIndex((h) => h.blockIds.includes(blockId))
    if (idx === -1) return null

    const curDate = hotelDays[idx].date
    if (!curDate) return null

    // до заезда следующего отеля, либо до конца поездки
    const nextDate = idx + 1 < hotelDays.length ? hotelDays[idx + 1].date : end
    if (!nextDate) return null

    const n = Math.round((nextDate.getTime() - curDate.getTime()) / 86400000)
    return n > 0 ? n : null
  }, [days, tripStart, tripEnd])

  return (
<DaysContext.Provider value={{ days, variantId, updateBlockRooms, updateRoomPrice, updateBlockPrice, getNights, refresh }}>      {children}
    </DaysContext.Provider>
  )
}