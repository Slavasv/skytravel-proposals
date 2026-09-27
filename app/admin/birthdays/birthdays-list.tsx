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

            <div className="adm-toolbar">
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('Search by name or client…', 'Поиск по имени или клиенту…')}
                    className="adm-field adm-field-search" />
            </div>

            {filtered.length === 0 ? (
                <div className="adm-empty">
                    {travellers.length === 0
                        ? t('No travellers with a birth date yet.', 'Пока нет путешественников с датой рождения.')
                        : t('Nothing matches your search.', 'Ничего не найдено.')}
                </div>
            ) : (
                <div className="adm-tcard">
                    <div className="adm-tscroll">
                        <table className="adm-table">
                            <thead>
                                <tr>
                                    <th>{t('Traveller', 'Путешественник')}</th>
                                    <th>{t('Client', 'Клиент')}</th>
                                    <th>{t('Birthday', 'День рождения')}</th>
                                    <th>{t('Turns', 'Исполнится')}</th>
                                    <th>{t('In', 'Через')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((r) => {
                                    const soon = r.days != null && (r.days as number) <= 14
                                    return (
                                        <tr key={r.id}>
                                            <td>
                                                <span className="adm-cell-strong">🎂 {[r.title, r.name].filter(Boolean).join(' ') || t('Unnamed', 'Без имени')}</span>
                                            </td>
                                            <td style={{ color: r.client_name ? undefined : '#9C988E' }}>
                                                {r.client_name
                                                    ? (r.client_id
                                                        ? <Link href={`/admin/clients/${r.client_id}`} style={{ color: 'var(--admin-accent)', textDecoration: 'none' }}>{r.client_name}</Link>
                                                        : r.client_name)
                                                    : '—'}
                                            </td>
                                            <td style={{ whiteSpace: 'nowrap', color: soon ? 'var(--admin-accent)' : undefined, fontWeight: soon ? 700 : undefined }}>{dateLabel(r.parsed)}</td>
                                            <td className="adm-cell-muted">{r.turning != null ? r.turning : '—'}</td>
                                            <td style={{ whiteSpace: 'nowrap', color: soon ? 'var(--admin-accent)' : undefined, fontWeight: soon ? 700 : undefined }}>
                                                {r.days === 0
                                                    ? <span className="adm-pill adm-tone-mid">{daysLabel(0)}</span>
                                                    : (r.days != null ? daysLabel(r.days as number) : '')}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}