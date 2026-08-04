'use client'

import { useState, useRef, useEffect } from 'react'
import { useT, useLang } from '@/lib/i18n-client'

// Поле даты DD/MM/YYYY: посимвольный ввод + всплывающий календарь.
// Значение хранится строкой "ДД/ММ/ГГГГ" (или пустой / частичной при вводе).

type Props = {
  value: string
  onChange: (value: string) => void
  style?: React.CSSProperties
  readOnly?: boolean
  placeholder?: string
}

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const WEEKDAYS_EN = ['Mo','Tu','We','Th','Fr','Sa','Su']
const WEEKDAYS_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

// строка -> Date (строгий разбор ДД/ММ/ГГГГ)
function parse(value: string): Date | null {
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const d = +m[1], mo = +m[2], y = +m[3]
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

function fmt(d: Date): string {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

// форматирование введённых цифр в маску ДД/ММ/ГГГГ
function maskDigits(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 8)
  let out = d.slice(0, 2)
  if (d.length >= 3) out += '/' + d.slice(2, 4)
  else if (d.length > 2) out += '/'
  if (d.length >= 5) out += '/' + d.slice(4, 8)
  else if (d.length > 4) out += '/'
  return out
}

export default function DateInput({ value, onChange, style, readOnly, placeholder = 'dd/mm/yyyy' }: Props) {
  const t = useT()
  const lang = useLang()
  const MONTHS = lang === 'ru' ? MONTHS_RU : MONTHS_EN
  const WEEKDAYS = lang === 'ru' ? WEEKDAYS_RU : WEEKDAYS_EN
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // месяц, показываемый в календаре
  const parsed = parse(value)
  const [viewDate, setViewDate] = useState<Date>(parsed || new Date())

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // при открытии — показываем месяц выбранной даты
  useEffect(() => {
    if (open && parsed) setViewDate(parsed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // === посимвольный ввод: пользователь свободно печатает/правит, мы переформатируем цифры в маску ===
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    onChange(maskDigits(digits))
  }

  function pickDay(day: number) {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    onChange(fmt(d))
    setOpen(false)
  }

  function prevMonth() { setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1)) }
  function nextMonth() { setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)) }
  function prevYear() { setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1)) }
  function nextYear() { setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1)) }

  // сетка дней месяца (понедельник — первый)
  const year = viewDate.getFullYear(), month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const offset = (firstDay + 6) % 7 // сдвиг, чтобы Пн был первым
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const selectedDay = parsed && parsed.getFullYear() === year && parsed.getMonth() === month ? parsed.getDate() : null
  const today = new Date()
  const todayDay = today.getFullYear() === year && today.getMonth() === month ? today.getDate() : null

  const baseInput: React.CSSProperties = {
    width: '100%', padding: '10px 36px 10px 12px', fontSize: '14px', color: 'var(--admin-text)',
    background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
    borderRadius: '6px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
    letterSpacing: '0.03em',
    ...style,
  }

  const navBtn: React.CSSProperties = {
    background: 'transparent', border: 'none', color: 'var(--admin-text-muted)',
    cursor: 'pointer', fontSize: '14px', padding: '2px 6px', fontFamily: 'inherit', borderRadius: '4px',
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        readOnly={readOnly}
        placeholder={placeholder}
        style={baseInput}
        onFocus={() => !readOnly && setOpen(true)}
      />
      {/* иконка календаря */}
      {!readOnly && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={t('Open calendar', 'Открыть календарь')}
          style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--admin-text-muted)', fontSize: '15px', padding: '2px', lineHeight: 1 }}
        >
          ⌗
        </button>
      )}

      {open && !readOnly && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
          background: 'var(--admin-card)', border: '1px solid var(--admin-border)',
          borderRadius: '10px', padding: '12px', width: '260px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        }}>
          {/* Навигация: год/месяц */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button type="button" onClick={prevYear} style={navBtn} title={t('Previous year', 'Предыдущий год')}>«</button>
              <button type="button" onClick={prevMonth} style={navBtn} title={t('Previous month', 'Предыдущий месяц')}>‹</button>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--admin-text)' }}>
              {MONTHS[month]} {year}
            </span>
            <div style={{ display: 'flex', gap: '2px' }}>
              <button type="button" onClick={nextMonth} style={navBtn} title={t('Next month', 'Следующий месяц')}>›</button>
              <button type="button" onClick={nextYear} style={navBtn} title={t('Next year', 'Следующий год')}>»</button>
            </div>
          </div>

          {/* Дни недели */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {WEEKDAYS.map((w) => (
              <div key={w} style={{ textAlign: 'center', fontSize: '10px', color: 'var(--admin-text-faint)', padding: '2px 0', letterSpacing: '0.05em' }}>{w}</div>
            ))}
          </div>

          {/* Сетка дней */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />
              const isSelected = day === selectedDay
              const isToday = day === todayDay
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickDay(day)}
                  style={{
                    aspectRatio: '1', border: 'none', cursor: 'pointer', borderRadius: '6px',
                    fontSize: '13px', fontFamily: 'inherit',
                    background: isSelected ? 'var(--admin-text-on-dark)' : 'transparent',
                    color: isSelected ? 'var(--admin-dark-panel)' : 'var(--admin-text)',
                    fontWeight: isSelected ? 600 : 400,
                    outline: isToday && !isSelected ? '1px solid var(--admin-border-hover)' : 'none',
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}