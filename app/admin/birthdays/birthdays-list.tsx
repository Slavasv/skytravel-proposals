'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n-client'
import { daysUntilNextBirthday, turningAge, parseBirth } from '@/lib/birthday'

export type BirthdayTraveller = {
    id: string
    name: string | null
    title: string | null
    date_of_birth: string | null
    client_id: string | null
    client_name: string | null
}

const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

export default function BirthdaysList({ travellers }: { travellers: BirthdayTraveller[] }) {
    const t = useT()
    const [search, setSearch] = useState('')

    const rows = useMemo(() => {
        const now = new Date()
        return travellers
            .map((tr) => ({
                ...tr,
                days: daysUntilNextBirthday(tr.date_of_birth, now),
                turning: turningAge(tr.date_of_birth, now),
                parsed: parseBirth(tr.date_of_birth),
            }))
            .filter((r) => r.days != null)
            .sort((a, b) => (a.days as number) - (b.days as number))
    }, [travellers])

    const q = search.trim().toLowerCase()
    const filtered = q
        ? rows.filter((r) => `${r.title ?? ''} ${r.name ?? ''} ${r.client_name ?? ''}`.toLowerCase().includes(q))
        : rows

    const inputStyle: React.CSSProperties = {
        padding: '10px 14px', fontSize: '14px', color: 'var(--admin-text)',
        background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
        borderRadius: '8px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
    }

    function dateLabel(p: { day: number; month: number } | null): string {
        if (!p) return '—'
        return `${p.day} ${MONTHS_RU[p.month - 1] ?? ''}`
    }
    function daysLabel(d: number): string {
        if (d === 0) return t('today 🎉', 'сегодня 🎉')
        if (d === 1) return t('tomorrow', 'завтра')
        return t(`in ${d} days`, `через ${d} дн.`)
    }

    return (
        <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 4px', letterSpacing: '-0.01em' }}>{t('Birthdays', 'Дни рождения')}</h1>
            <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '0 0 20px' }}>
                {t('Travellers sorted by the nearest upcoming birthday.', 'Путешественники по ближайшему дню рождения.')}
            </p>

            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Search by name or client…', 'Поиск по имени или клиенту…')}
                style={{ ...inputStyle, width: '100%', marginBottom: '16px' }} />

            {filtered.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
                    {travellers.length === 0
                        ? t('No travellers with a birth date yet.', 'Пока нет путешественников с датой рождения.')
                        : t('Nothing matches your search.', 'Ничего не найдено.')}
                </div>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {filtered.map((r) => {
                        const soon = r.days != null && (r.days as number) <= 14
                        return (
                            <li key={r.id}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', border: `1px solid ${soon ? 'var(--admin-accent)' : 'var(--admin-border-card)'}`, borderRadius: '8px', background: 'var(--admin-card)' }}>
                                    <span style={{ fontSize: '18px' }}>🎂</span>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--admin-text)' }}>
                                            {[r.title, r.name].filter(Boolean).join(' ') || t('Unnamed', 'Без имени')}
                                            {r.turning != null && <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', fontWeight: 400 }}> · {t(`turns ${r.turning}`, `исполнится ${r.turning}`)}</span>}
                                        </div>
                                        {r.client_name && (
                                            <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                                                {r.client_id
                                                    ? <Link href={`/admin/clients/${r.client_id}`} style={{ color: 'var(--admin-accent)', textDecoration: 'none' }}>{r.client_name}</Link>
                                                    : r.client_name}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: soon ? 'var(--admin-accent)' : 'var(--admin-text)' }}>{dateLabel(r.parsed)}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px' }}>{r.days != null ? daysLabel(r.days as number) : ''}</div>
                                    </div>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}