'use client'

import { useState, useMemo } from 'react'
import { useT } from '@/lib/i18n-client'

export type ProfitRow = {
    profit: number
    currency: string
    client: string
    agent: string
    region: string
    month: string
    hotel: string
    service_type: string
}

type GroupKey = 'client' | 'agent' | 'hotel' | 'region' | 'month' | 'service_type'

function money(n: number): string {
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const thSt: React.CSSProperties = {
    textAlign: 'left', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--admin-text-muted)', fontWeight: 500, padding: '10px 12px', whiteSpace: 'nowrap',
}
const tdSt: React.CSSProperties = {
    fontSize: '13px', color: 'var(--admin-text)', padding: '10px 12px', borderTop: '1px solid var(--admin-border-card)',
}

export default function AnalyticsClient({ rows }: { rows: ProfitRow[] }) {
    const t = useT()
    const [groupBy, setGroupBy] = useState<GroupKey>('client')
    const [search, setSearch] = useState('')

    const GROUPS: [GroupKey, string][] = [
        ['client', t('Client', 'Клиент')],
        ['agent', t('Agent', 'Агент')],
        ['hotel', t('Hotel', 'Отель')],
        ['region', t('Region', 'Регион')],
        ['month', t('Month', 'Месяц')],
        ['service_type', t('Service type', 'Тип услуги')],
    ]

    const currencies = useMemo(() => {
        const s = new Set<string>()
        rows.forEach((r) => s.add(r.currency))
        return Array.from(s).sort()
    }, [rows])

    const agg = useMemo(() => {
        const m = new Map<string, { label: string; byCur: Record<string, number>; total: number }>()
        for (const r of rows) {
            const label = String(r[groupBy] || '—')
            const row = m.get(label) ?? { label, byCur: {}, total: 0 }
            row.byCur[r.currency] = (row.byCur[r.currency] ?? 0) + r.profit
            row.total += r.profit
            m.set(label, row)
        }
        return Array.from(m.values()).sort((a, b) => b.total - a.total)
    }, [rows, groupBy])

    const filteredAgg = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return agg
        return agg.filter((row) => row.label.toLowerCase().includes(q))
    }, [agg, search])

    const filteredTotals = useMemo(() => {
        const byCur: Record<string, number> = {}
        for (const row of filteredAgg) {
            for (const c of Object.keys(row.byCur)) byCur[c] = (byCur[c] ?? 0) + row.byCur[c]
        }
        return byCur
    }, [filteredAgg])

    const inputStyle: React.CSSProperties = {
        padding: '10px 14px', fontSize: '14px', color: 'var(--admin-text)',
        background: 'var(--admin-input)', border: '1px solid var(--admin-border)',
        borderRadius: '8px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
    }

    return (
        <div className="page-pad-40" style={{ padding: '40px', fontFamily: 'system-ui', maxWidth: '1000px', margin: '0 auto' }}>
            <a href="/admin/accounting" style={{ fontSize: '13px', color: 'var(--admin-accent)', textDecoration: 'none' }}>← {t('Back to accounting', 'Назад в бухгалтерию')}</a>
            <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '10px 0 4px', letterSpacing: '-0.01em' }}>{t('Analytics', 'Аналитика')}</h1>
            <p style={{ fontSize: '13px', color: 'var(--admin-text-muted)', margin: '0 0 20px' }}>
                {t('Profit (Gross − Net) by dimension. Currencies are counted separately.',
                    'Прибыль (Брутто − Нетто) в разрезе. Валюты считаются раздельно.')}
            </p>

            <div style={{ marginBottom: '18px' }}>
                <label style={{ ...thSt, padding: '0 0 6px', display: 'block' }}>{t('Group by', 'Группировать по')}</label>
                <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupKey)} style={{ ...inputStyle, width: '240px' }}>
                    {GROUPS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
            </div>

            <div style={{ marginBottom: '18px' }}>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('Search…', 'Поиск…')}
                    style={{ ...inputStyle, width: '100%' }}
                />
            </div>

            {filteredAgg.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--admin-text-muted)', border: '1px dashed var(--admin-text-faint)', borderRadius: '8px', fontSize: '14px' }}>
                    {agg.length === 0
                        ? t('No profit data yet. Fill Gross/Net in booking services.',
                            'Пока нет данных о прибыли. Заполните Брутто/Нетто в услугах броней.')
                        : t('Nothing matches your search.', 'Ничего не найдено по запросу.')}
                </div>
            ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--admin-border-card)', borderRadius: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={thSt}>{GROUPS.find(([v]) => v === groupBy)?.[1]}</th>
                                {currencies.map((c) => <th key={c} style={{ ...thSt, textAlign: 'right' }}>{t('Profit', 'Прибыль')} {c}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                                {filteredAgg.map((row) => (
                                <tr key={row.label}>
                                    <td style={tdSt}>{row.label}</td>
                                    {currencies.map((c) => (
                                        <td key={c} style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: (row.byCur[c] ?? 0) >= 0 ? 'var(--admin-success)' : 'var(--admin-danger)' }}>
                                            {row.byCur[c] != null ? money(row.byCur[c]) : '—'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td style={{ ...tdSt, fontWeight: 700, borderTop: '2px solid var(--admin-border)' }}>{t('Total', 'Итого')}</td>
                                {currencies.map((c) => (
                                    <td key={c} style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, borderTop: '2px solid var(--admin-border)', color: (filteredTotals[c] ?? 0) >= 0 ? 'var(--admin-success)' : 'var(--admin-danger)' }}>
                                        {money(filteredTotals[c] ?? 0)}
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    )
}