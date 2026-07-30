'use client'

import { useState, useEffect, useRef } from 'react'
import {
  updateVoucher, getClientTravellers, saveGuestToClient,
  type Guest, type ClientOption, type TravellerOption,
} from './voucher-actions'
import VoucherHotels from './voucher-hotels'
import type { VoucherHotel } from './voucher-actions'
import DateInput from '@/app/admin/_components/date-input'
import VoucherActions from './voucher-actions-ui'
import ClientPicker from '@/app/admin/_components/client-picker'
import { useSearchParams } from 'next/navigation'
import { useT } from '@/lib/i18n-client'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

type Voucher = {
  id: string
  slug: string
  greeting_for: string | null
  issue_date: string | null
  guests: unknown
  show_transfer: boolean | null
  show_greeting: boolean | null
  transfers: unknown
  notes: string | null
  client_id: string | null
}

// Обращения: взрослые и детские
const ADULT_TITLES = ['Mr', 'Mrs']
const CHILD_TITLES = ['Miss', 'Mstr', 'Chd', 'Inf']
const CHILD_SET = new Set(CHILD_TITLES)

function isChildTitle(title: string): boolean {
  return CHILD_SET.has(title)
}

// парсинг ДД/ММ/ГГГГ (или ДД.ММ.ГГГГ)
function parseDMY(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (!m) return null
  const d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10)
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

// полных лет от birth до ref
function fullYearsBetween(birth: Date, ref: Date): number {
  let age = ref.getFullYear() - birth.getFullYear()
  const m = ref.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--
  return age
}

function normalizeGuests(data: unknown): Guest[] {
  if (!Array.isArray(data)) return []
  return data
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      id: typeof x.id === 'string' ? x.id : Math.random().toString(36).slice(2),
      title: typeof x.title === 'string' ? x.title : '',
      name: typeof x.name === 'string' ? x.name : '',
      is_child: !!x.is_child,
      birth_date: typeof x.birth_date === 'string' ? x.birth_date : '',
    }))
}

export type Transfer = { date: string; from: string; to: string; type: string }

function normalizeTransfers(data: unknown): Transfer[] {
  if (!Array.isArray(data)) return []
  return data
    .map((x) => {
      if (typeof x === 'string') return { date: '', from: x, to: '', type: '' } // миграция старых строк
      if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>
        return {
          date: typeof o.date === 'string' ? o.date : '',
          from: typeof o.from === 'string' ? o.from : '',
          to: typeof o.to === 'string' ? o.to : '',
          type: typeof o.type === 'string' ? o.type : '',
        }
      }
      return { date: '', from: '', to: '', type: '' }
    })
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', marginBottom: '6px', fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: '14px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

// Карточка гостя с drag-ручкой
function GuestCard({
  guest, childAge, showSaveToCrm, savingGuestId,
  onChangeTitle, onChangeGuest, onRemove, onSaveToCrm,
}: {
  guest: Guest
  childAge: (birth: string) => string
  showSaveToCrm: boolean
  savingGuestId: string | null
  onChangeTitle: (id: string, title: string) => void
  onChangeGuest: (id: string, patch: Partial<Guest>) => void
  onRemove: (id: string) => void
  onSaveToCrm: (g: Guest) => void
}) {
  const t = useT()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: guest.id })

  const child = isChildTitle(guest.title)
  const age = child ? childAge(guest.birth_date) : ''

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    border: '1px solid var(--admin-border-card)',
    borderRadius: '8px',
    padding: '10px',
    background: 'var(--admin-input)',
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t('Drag', 'Перетащить')}
          style={{ background: 'transparent', border: 'none', cursor: 'grab', color: 'var(--admin-text-muted)', fontSize: '14px', padding: '2px 4px', touchAction: 'none', fontFamily: 'inherit', flexShrink: 0 }}
        >
          ⋮⋮
        </button>

        <select value={guest.title} onChange={(e) => onChangeTitle(guest.id, e.target.value)} style={{ ...inputStyle, width: '110px', flexShrink: 0 }}>
          <optgroup label={t('Adult', 'Взрослый')}>
            {ADULT_TITLES.map((tt) => <option key={tt} value={tt}>{tt}</option>)}
          </optgroup>
          <optgroup label={t('Child', 'Ребёнок')}>
            {CHILD_TITLES.map((tt) => <option key={tt} value={tt}>{tt}</option>)}
          </optgroup>
        </select>

        <input type="text" value={guest.name} onChange={(e) => onChangeGuest(guest.id, { name: e.target.value })} style={inputStyle} placeholder="Pertsev Yurii" />

        {showSaveToCrm && (
          <button
            type="button"
            onClick={() => onSaveToCrm(guest)}
            disabled={savingGuestId === guest.id}
            title={t('Save this guest as a traveller of the selected client', 'Сохранить этого гостя как путешественника выбранного клиента')}
            style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-accent)', borderRadius: '6px', cursor: savingGuestId === guest.id ? 'wait' : 'pointer', fontSize: '11px', padding: '8px 10px', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap' }}
          >
            {savingGuestId === guest.id ? '…' : t('↑ Save to client', '↑ Сохранить клиенту')}
          </button>
        )}

        <button type="button" onClick={() => onRemove(guest.id)} style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '8px 10px', fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
      </div>

      {child && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '8px' }}>
          <div style={{ flex: 1 }}>
            <DateInput value={guest.birth_date} onChange={(v) => onChangeGuest(guest.id, { birth_date: v })} placeholder={t('Date of birth dd/mm/yyyy', 'Дата рождения дд/мм/гггг')} />
          </div>
          {age && (
            <span style={{ fontSize: '13px', color: 'var(--admin-accent)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {age} <span style={{ color: 'var(--admin-text-muted)', fontWeight: 400 }}>{t('at last check-out', 'на дату последнего выезда')}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function VoucherForm({
  voucher, hotels, lastCheckout, clients,
}: {
  voucher: Voucher
  hotels: VoucherHotel[]
  lastCheckout: string | null
  clients: ClientOption[]
}) {
  const t = useT()
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // CRM: если вернулись из создания клиента — подставим его
  const searchParams = useSearchParams()
  const pickedClient = searchParams.get('pickedClient')

  // CRM: travellers выбранного клиента
  const [travellers, setTravellers] = useState<TravellerOption[]>([])
  const [travPickerOpen, setTravPickerOpen] = useState(false)
  const [savingGuestId, setSavingGuestId] = useState<string | null>(null)

  const [form, setForm] = useState({
    issue_date: voucher.issue_date || '',
    greeting_for: voucher.greeting_for || '',
    guests: normalizeGuests(voucher.guests),
    show_transfer: voucher.show_transfer ?? false,
    show_greeting: voucher.show_greeting ?? false,
    transfers: normalizeTransfers(voucher.transfers),
    notes: voucher.notes || '',
    client_id: voucher.client_id || '',
  })

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)
  const inFlight = useRef<Promise<void> | null>(null)

  // даты выезда из отелей в реальном времени (для расчёта возраста без перезагрузки)
  const initialCheckouts = hotels.map((h) => h.check_out || '').filter(Boolean)
  const [liveCheckouts, setLiveCheckouts] = useState<string[]>(
    lastCheckout ? [lastCheckout] : initialCheckouts
  )

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaveState('editing')
  }

  async function saveNow(current: typeof form) {
    setSaveState('saving')
    setErrorMsg(null)
    const promise = (async () => {
      try {
        await updateVoucher(voucher.id, {
          issue_date: current.issue_date || null,
          greeting_for: current.greeting_for || null,
          guests: current.guests,
          show_transfer: current.show_transfer,
          show_greeting: current.show_greeting,
          transfers: current.transfers,
          notes: current.notes || null,
          client_id: current.client_id || null,
        })
        setSavedAt(new Date())
        setSaveState('saved')
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : t('Save failed', 'Не удалось сохранить'))
        setSaveState('error')
      }
    })()
    inFlight.current = promise
    await promise
    if (inFlight.current === promise) inFlight.current = null
  }

  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveNow(form), 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  // вернулись из создания клиента → подставляем его
  useEffect(() => {
    if (pickedClient && pickedClient !== form.client_id) {
      set('client_id', pickedClient)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedClient])

  // подгружаем travellers выбранного клиента
  useEffect(() => {
    if (!form.client_id) { setTravellers([]); return }
    let cancelled = false
    getClientTravellers(form.client_id).then((list) => {
      if (!cancelled) setTravellers(list)
    })
    return () => { cancelled = true }
  }, [form.client_id])

  // ---- CRM: добавить гостя из travellers клиента ----
  function addFromTraveller(trav: TravellerOption) {
    const title = trav.title || 'Mr'
    set('guests', [...form.guests, {
      id: Math.random().toString(36).slice(2),
      title,
      name: trav.name || '',
      is_child: isChildTitle(title),
      birth_date: trav.date_of_birth || '',
    }])
    setTravPickerOpen(false)
  }

  // ---- CRM: сохранить гостя в travellers клиента ----
  async function handleSaveGuestToClient(g: Guest) {
    if (!form.client_id) return
    if (!g.name.trim()) { alert(t('Enter the name first.', 'Сначала введите имя.')); return }

    setSavingGuestId(g.id)
    try {
      const res = await saveGuestToClient(form.client_id, {
        title: g.title,
        name: g.name,
        birth_date: g.birth_date,
      })
      if (res.duplicate) {
        alert(t(`"${g.name}" is already saved as a traveller for this client.`, `«${g.name}» уже сохранён как путешественник этого клиента.`))
      } else if (!res.ok) {
        alert(res.error || t('Could not save traveller.', 'Не удалось сохранить путешественника.'))
      } else {
        // обновим список travellers, чтобы кнопка исчезла
        const list = await getClientTravellers(form.client_id)
        setTravellers(list)
      }
    } finally {
      setSavingGuestId(null)
    }
  }

  // есть ли уже такой traveller у клиента (по имени)
  function isInCrm(name: string): boolean {
    const n = name.trim().toLowerCase()
    if (!n) return false
    return travellers.some((trav) => (trav.name || '').trim().toLowerCase() === n)
  }

  // ---- Guests: drag & drop ----
  const guestSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function onGuestDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = form.guests.findIndex((g) => g.id === active.id)
    const newIndex = form.guests.findIndex((g) => g.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    set('guests', arrayMove(form.guests, oldIndex, newIndex))
  }

  // ---- Guests ----
  function addGuest() {
    set('guests', [...form.guests, { id: Math.random().toString(36).slice(2), title: 'Mr', name: '', is_child: false, birth_date: '' }])
  }
  function changeGuest(id: string, patch: Partial<Guest>) {
    set('guests', form.guests.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }
  function changeTitle(id: string, title: string) {
    const child = isChildTitle(title)
    set('guests', form.guests.map((g) => (g.id === id
      ? { ...g, title, is_child: child, birth_date: child ? g.birth_date : '' }
      : g)))
  }
  function removeGuest(id: string) {
    set('guests', form.guests.filter((g) => g.id !== id))
  }

  // авто-Pax (ADL = взрослые, CHD = дети; Inf считаем отдельно как INF)
  const adults = form.guests.filter((g) => !isChildTitle(g.title)).length
  const infants = form.guests.filter((g) => g.title === 'Inf').length
  const children = form.guests.filter((g) => isChildTitle(g.title) && g.title !== 'Inf').length
  const paxParts = [
    adults > 0 ? `${adults} ADL` : '',
    children > 0 ? `${children} CHD` : '',
    infants > 0 ? `${infants} INF` : '',
  ].filter(Boolean)
  const paxString = paxParts.join(', ') || '—'

  // возраст ребёнка на последний check-out (из живых дат выезда отелей)
  let refDate: Date | null = null
  for (const c of liveCheckouts) {
    const d = parseDMY(c)
    if (d && (!refDate || d > refDate)) refDate = d
  }
  if (!refDate && lastCheckout) refDate = parseDMY(lastCheckout)
  function childAge(birth_date: string): string {
    if (!refDate) return ''
    const b = parseDMY(birth_date)
    if (!b) return ''
    const age = fullYearsBetween(b, refDate)
    if (age < 0) return ''
    return `${age} ${t('y.o.', 'лет')}`
  }

  // ---- Transfers ----
  function addTransfer() { set('transfers', [...form.transfers, { date: '', from: '', to: '', type: '' }]) }
  function changeTransfer(i: number, patch: Partial<Transfer>) {
    set('transfers', form.transfers.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }
  function removeTransfer(i: number) {
    set('transfers', form.transfers.filter((_, idx) => idx !== i))
  }

  function renderSaveIndicator() {
    if (saveState === 'error') return <span style={{ color: 'var(--admin-danger)' }}>● {t('Error', 'Ошибка')}: {errorMsg}</span>
    if (saveState === 'saving') return <span style={{ color: 'var(--admin-accent)' }}>{t('● Saving...', '● Сохранение...')}</span>
    if (saveState === 'editing') return <span style={{ color: 'var(--admin-text-muted)' }}>{t('● Editing...', '● Редактирование...')}</span>
    if (saveState === 'saved' && savedAt) return <span style={{ color: 'var(--admin-success)' }}>● {t('Saved at', 'Сохранено в')} {savedAt.toLocaleTimeString()}</span>
    return <span style={{ color: 'var(--admin-text-muted)' }}>{t('● All changes saved', '● Все изменения сохранены')}</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '16px', borderBottom: '1px solid var(--admin-border-card)', fontSize: '12px' }}>
        {renderSaveIndicator()}
      </div>

      {/* HEADER */}
      <section>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 16px', color: 'var(--admin-text)' }}>Voucher details</h2>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Client</label>
          <ClientPicker
            clients={clients}
            value={form.client_id}
            onChange={(id) => set('client_id', id)}
            returnTo={`/admin/vouchers/${voucher.id}`}
          />
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '6px 0 0' }}>
            Link this voucher to a CRM client to pull travellers into the guest list.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={labelStyle}>For (greeting names)</label>
            <input type="text" value={form.greeting_for} onChange={(e) => set('greeting_for', e.target.value)} style={inputStyle} placeholder="Iryna and Vitalii" />
          </div>
          <div style={{ width: '180px' }}>
            <label style={labelStyle}>Issue date</label>
            <DateInput value={form.issue_date} onChange={(v) => set('issue_date', v)} />
          </div>
        </div>
      </section>

      {/* HOTELS */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px', color: 'var(--admin-text)' }}>Accommodation</h2>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 16px' }}>
          One or more hotels. Drag to reorder. Nights are calculated automatically from check-in / check-out.
        </p>
        <VoucherHotels voucherId={voucher.id} initialHotels={hotels} onCheckoutsChange={setLiveCheckouts} />
      </section>

      {/* GUESTS */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 500, margin: 0, color: 'var(--admin-text)' }}>Guests</h2>
          <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>Pax: <b style={{ color: 'var(--admin-text)' }}>{paxString}</b></span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 14px' }}>
          Shared across the whole voucher. Adults: Mr/Mrs. Children: Miss/Mstr/Chd/Inf (date of birth required).
          {!refDate && <span> Add hotel check-out dates to calculate child ages.</span>}
        </p>

        <DndContext sensors={guestSensors} collisionDetection={closestCenter} onDragEnd={onGuestDragEnd}>
          <SortableContext items={form.guests.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {form.guests.map((g) => (
                <GuestCard
                  key={g.id}
                  guest={g}
                  childAge={childAge}
                  showSaveToCrm={!!form.client_id && !!g.name.trim() && !isInCrm(g.name)}
                  savingGuestId={savingGuestId}
                  onChangeTitle={changeTitle}
                  onChangeGuest={changeGuest}
                  onRemove={removeGuest}
                  onSaveToCrm={handleSaveGuestToClient}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap', position: 'relative' }}>
          <button type="button" onClick={addGuest} style={{ padding: '8px 14px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
            + Add guest
          </button>

          {form.client_id && travellers.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setTravPickerOpen((v) => !v)}
                style={{ padding: '8px 14px', fontSize: '13px', color: 'var(--admin-text)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ⤓ Add from client ({travellers.length})
              </button>

              {travPickerOpen && (
                <>
                  <div onClick={() => setTravPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, marginTop: '6px',
                    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
                    borderRadius: '8px', padding: '6px', minWidth: '280px', maxHeight: '320px',
                    overflowY: 'auto', zIndex: 2, boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                  }}>
                    <div style={{ fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', padding: '6px 10px 8px' }}>
                      Client travellers
                    </div>
                    {travellers.map((t) => {
                      const already = form.guests.some(
                        (g) => g.name.trim().toLowerCase() === (t.name || '').trim().toLowerCase()
                      )
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => addFromTraveller(t)}
                          disabled={already}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px',
                            background: 'transparent', border: 'none', fontSize: '13px', borderRadius: '4px',
                            cursor: already ? 'default' : 'pointer', fontFamily: 'inherit',
                            color: already ? 'var(--admin-text-faint)' : 'var(--admin-text)',
                          }}
                          onMouseEnter={(e) => { if (!already) e.currentTarget.style.background = 'var(--admin-card)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          {t.title ? `${t.title} ` : ''}{t.name || 'Unnamed'}
                          {already && <span style={{ fontSize: '11px', marginLeft: '6px' }}>· added</span>}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>

      {/* TRANSFER */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 500, color: 'var(--admin-text)', marginBottom: '10px' }}>
          <input type="checkbox" checked={form.show_transfer} onChange={(e) => set('show_transfer', e.target.checked)} />
          Show TRANSFER block
        </label>
        {form.show_transfer && (
          <div>
            <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '0 0 10px' }}>Date, from and to. E.g. 12/07/2026, Milan → Dubai.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {form.transfers.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', border: '1px solid var(--admin-border-card)', borderRadius: '8px', padding: '10px', background: 'var(--admin-input)' }}>
                  <div style={{ width: '130px', flexShrink: 0 }}>
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>Date</label>
                    <DateInput value={t.date} onChange={(v) => changeTransfer(i, { date: v })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>From</label>
                    <input type="text" value={t.from} onChange={(e) => changeTransfer(i, { from: e.target.value })} style={inputStyle} placeholder="Milan" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>To</label>
                    <input type="text" value={t.to} onChange={(e) => changeTransfer(i, { to: e.target.value })} style={inputStyle} placeholder="Dubai" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, marginBottom: '4px' }}>Type</label>
                    <input type="text" value={t.type} onChange={(e) => changeTransfer(i, { type: e.target.value })} style={inputStyle} placeholder="Private car" />
                  </div>
                  <button type="button" onClick={() => removeTransfer(i)} style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '9px 10px', fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addTransfer} style={{ marginTop: '10px', padding: '8px 14px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>
              + Add transfer
            </button>
          </div>
        )}
      </section>

      {/* GREETING TOGGLE */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: 500, color: 'var(--admin-text)' }}>
          <input type="checkbox" checked={form.show_greeting} onChange={(e) => set('show_greeting', e.target.checked)} />
          Add welcome text
        </label>
        <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: '8px 0 0' }}>
          Shows the brand&apos;s welcome message on the voucher. Turn off for business trips.
        </p>
      </section>

      {/* NOTES */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 12px', color: 'var(--admin-text)' }}>Notes (optional)</h2>
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder="Any additional notes for this voucher..." />
      </section>

      {/* SHARE + DONE */}
      <section style={{ paddingTop: '24px', borderTop: '1px solid var(--admin-border-card)' }}>
        <VoucherActions voucherId={voucher.id} initialSlug={voucher.slug} />
      </section>
    </div>
  )
}