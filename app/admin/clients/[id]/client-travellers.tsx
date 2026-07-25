'use client'

import { useState, useEffect, useRef } from 'react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  addTraveller, updateTraveller, deleteTraveller, reorderTravellers, type Traveller,
} from '../actions'
import DateInput from '@/app/admin/_components/date-input'

// Обращения: взрослые и детские (как в ваучере)
const ADULT_TITLES = ['Mr', 'Mrs']
const CHILD_TITLES = ['Miss', 'Mstr', 'Chd', 'Inf']
const CHILD_SET = new Set(CHILD_TITLES)

function isChildTitle(title: string): boolean {
  return CHILD_SET.has(title)
}

// подсказки отношений (можно вписать своё)
const RELATIONS = [
  'Primary Client',
  'Spouse',
  'Child',
  'Travel Companion',
  'Parent',
  'Assistant',
]

// парсинг ДД/ММ/ГГГГ
function parseDMY(s: string): Date | null {
  const m = s.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (!m) return null
  const d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10)
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

// полных лет на сегодня
function currentAge(birth: string): string {
  const b = parseDMY(birth)
  if (!b) return ''
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  if (age < 0) return ''
  return `${age} y.o.`
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--admin-text-muted)', marginBottom: '5px', fontWeight: 500,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', fontSize: '14px', color: 'var(--admin-text)',
  background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
  borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
}

function TravellerCard({
  traveller, index, onRemove,
}: {
  traveller: Traveller
  index: number
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: traveller.id })

  const [form, setForm] = useState({
    name: traveller.name || '',
    title: traveller.title || 'Mr',
    relation: traveller.relation || '',
    traveller_code: traveller.traveller_code || '',
    date_of_birth: traveller.date_of_birth || '',
    nationality: traveller.nationality || '',
    special_requirements: traveller.special_requirements || '',
    travel_preferences: traveller.travel_preferences || '',
    notes: traveller.notes || '',
  })
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [open, setOpen] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitial = useRef(true)

  function set<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    if (isInitial.current) { isInitial.current = false; return }
    setSaveState('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await updateTraveller(traveller.id, {
        name: form.name,
        title: form.title || null,
        relation: form.relation || null,
        traveller_code: form.traveller_code || null,
        date_of_birth: form.date_of_birth || null,
        nationality: form.nationality || null,
        special_requirements: form.special_requirements || null,
        travel_preferences: form.travel_preferences || null,
        notes: form.notes || null,
      })
      setSaveState('saved')
    }, 1200)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  const isChild = isChildTitle(form.title)
  const age = form.date_of_birth ? currentAge(form.date_of_birth) : ''

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    border: '1px solid var(--admin-border-card)', borderRadius: '10px',
    padding: '16px', marginBottom: '12px', background: 'var(--admin-card)',
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: open ? '14px' : '0' }}>
        <button type="button" {...attributes} {...listeners} aria-label="Drag"
          style={{ background: 'transparent', border: 'none', cursor: 'grab', color: 'var(--admin-text-muted)', fontSize: '14px', padding: '2px 4px', touchAction: 'none', fontFamily: 'inherit' }}>⋮⋮</button>
        <button type="button" onClick={() => setOpen((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', padding: 0, minWidth: 0 }}>
          <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>▶</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>
            {form.name ? `${form.title} ${form.name}` : `Traveller ${index + 1}`}
          </span>
          {form.traveller_code && (
            <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', fontWeight: 400 }}>{form.traveller_code}</span>
          )}
          {!open && age && (
            <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', fontWeight: 400 }}>· {age}</span>
          )}
        </button>
        <span style={{ fontSize: '11px', color: saveState === 'saved' ? 'var(--admin-success)' : 'var(--admin-text-muted)' }}>
          {saveState === 'saving' ? '● Saving...' : saveState === 'saved' ? '● Saved' : ''}
        </span>
        <button type="button" onClick={() => onRemove(traveller.id)}
          style={{ background: 'transparent', border: '1px solid var(--admin-border-card)', color: 'var(--admin-danger)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', padding: '6px 8px', fontFamily: 'inherit' }}>✕ Remove</button>
      </div>

      <div style={{ display: open ? 'flex' : 'none', flexDirection: 'column', gap: '12px' }}>
        {/* Обращение + имя */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ width: '110px', flexShrink: 0 }}>
            <label style={labelStyle}>Title</label>
            <select value={form.title} onChange={(e) => set('title', e.target.value)} style={inputStyle}>
              <optgroup label="Adult">
                {ADULT_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
              </optgroup>
              <optgroup label="Child">
                {CHILD_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
              </optgroup>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Full name</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} style={inputStyle} placeholder="Pertsev Yurii" />
          </div>
          <div style={{ width: '130px', flexShrink: 0 }}>
            <label style={labelStyle}>Code</label>
            <input type="text" value={form.traveller_code} onChange={(e) => set('traveller_code', e.target.value)} style={inputStyle} placeholder="TRVLR-001" />
          </div>
        </div>

        {/* Отношение + дата рождения + национальность */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>Relation</label>
            <input type="text" list="relation-options" value={form.relation} onChange={(e) => set('relation', e.target.value)} style={inputStyle} placeholder="Select or type..." />
            <datalist id="relation-options">
              {RELATIONS.map((r) => <option key={r} value={r} />)}
            </datalist>
          </div>
          <div>
            <label style={labelStyle}>
              Date of birth {age && <span style={{ color: 'var(--admin-accent)', textTransform: 'none', letterSpacing: 0 }}>· {age}</span>}
            </label>
            <DateInput value={form.date_of_birth} onChange={(v) => set('date_of_birth', v)} placeholder="dd/mm/yyyy" />
          </div>
          <div>
            <label style={labelStyle}>Nationality</label>
            <input type="text" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} style={inputStyle} placeholder="Ukraine" />
          </div>
        </div>

        {/* Пожелания */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>Special requirements</label>
            <textarea value={form.special_requirements} onChange={(e) => set('special_requirements', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder="Allergies, accessibility..." />
          </div>
          <div>
            <label style={labelStyle}>Travel preferences</label>
            <textarea value={form.travel_preferences} onChange={(e) => set('travel_preferences', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} placeholder="Window seat, vegetarian meals..." />
          </div>
        </div>

        {isChild && (
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', margin: 0 }}>
            Child traveller — date of birth is used to calculate age at check-out.
          </p>
        )}
      </div>
    </div>
  )
}

export default function ClientTravellers({
  clientId, initialTravellers,
}: {
  clientId: string
  initialTravellers: Traveller[]
}) {
  const [travellers, setTravellers] = useState<Traveller[]>(initialTravellers)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function handleAdd() {
    const created = await addTraveller(clientId)
    if (created) setTravellers((prev) => [...prev, created])
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this traveller?')) return
    setTravellers((prev) => prev.filter((t) => t.id !== id))
    await deleteTraveller(id)
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = travellers.findIndex((t) => t.id === active.id)
    const newIndex = travellers.findIndex((t) => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const next = arrayMove(travellers, oldIndex, newIndex)
    setTravellers(next)
    await reorderTravellers(next.map((t) => t.id))
  }

  return (
    <div>
      {travellers.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={travellers.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div>
              {travellers.map((t, i) => (
                <TravellerCard key={t.id} traveller={t} index={i} onRemove={handleRemove} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <button type="button" onClick={handleAdd}
        style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--admin-accent)', background: 'transparent', border: '1px dashed var(--admin-border-card)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', marginTop: travellers.length > 0 ? '4px' : '0' }}>
        + Add traveller
      </button>
    </div>
  )
}