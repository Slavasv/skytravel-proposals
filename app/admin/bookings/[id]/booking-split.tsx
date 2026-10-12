'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useT } from '@/lib/i18n-client'
import { getSplit, addPayer, updatePayer, deletePayer, type SplitView, type PayerBalance } from '../split-actions'

const CURRENCIES = ['EUR', 'USD', 'AED', 'CHF', 'GBP', 'UAH']

function money(n: number | null | undefined, cur: string): string {
  if (n == null) return '—'
  const s = Math.round(Number(n)).toLocaleString('ru-RU').replace(/ /g, ' ')
  return `${s} ${cur}`
}

const field: React.CSSProperties = {
  padding: '8px 10px', fontSize: '13px', color: 'var(--admin-text)', background: 'var(--admin-input)',
  border: '1px solid var(--admin-border)', borderRadius: '6px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}
const label: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--admin-text-muted)', display: 'block', marginBottom: '3px',
}

export default function BookingSplit({ bookingId }: { bookingId: string }) {
  const t = useT()
  const [data, setData] = useState<SplitView | null>(null)
  const [busy, setBusy] = useState(false)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const load = useCallback(async () => { setData(await getSplit(bookingId)) }, [bookingId])
  useEffect(() => { load() }, [load])

  async function handleAddFirst() {
    setBusy(true)
    await addPayer(bookingId, data?.bookingClient?.id ?? null, data?.bookingTotals[0]?.currency || 'EUR')
    await load(); setBusy(false)
  }
  async function handleAdd() {
    setBusy(true)
    await addPayer(bookingId, null, data?.bookingTotals[0]?.currency || 'EUR')
    await load(); setBusy(false)
  }
  async function handleDelete(id: string) {
    setBusy(true); await deletePayer(id); await load(); setBusy(false)
  }

  // локально меняем поле; суммовые/заметку — автосейв с дебаунсом; клиент/валюта — сохранить и перечитать (меняет «оплачено»)
  function patchLocal(id: string, patch: Partial<PayerBalance>) {
    setData((d) => d ? { ...d, payers: d.payers.map((p) => p.id === id ? { ...p, ...patch, remaining: (patch.share_amount ?? p.share_amount) == null ? null : Number(patch.share_amount ?? p.share_amount) - p.paid } : p) } : d)
  }
  function debouncedSave(id: string, patch: Parameters<typeof updatePayer>[1]) {
    if (timers.current[id]) clearTimeout(timers.current[id])
    timers.current[id] = setTimeout(() => { updatePayer(id, patch) }, 700)
  }
  async function saveAndReload(id: string, patch: Parameters<typeof updatePayer>[1]) {
    await updatePayer(id, patch); await load()
  }

  if (!data) {
    return <div style={{ marginTop: '24px', fontSize: '13px', color: 'var(--admin-text-muted)' }}>{t('Loading…', 'Загрузка…')}</div>
  }

  const payers = data.payers
  const multi = payers.length >= 2

  // сверка сумм долей со стоимостью брони — по валютам
  const shareByCur: Record<string, number> = {}
  for (const p of payers) if (p.share_amount != null) shareByCur[p.share_currency] = (shareByCur[p.share_currency] ?? 0) + Number(p.share_amount)
  const mismatches: string[] = []
  for (const bt of data.bookingTotals) {
    const planned = shareByCur[bt.currency] ?? 0
    if (Math.round(planned) !== Math.round(bt.amount)) {
      mismatches.push(`${bt.currency}: ${t('plan', 'план')} ${money(planned, bt.currency)} ${t('vs booking', 'против брони')} ${money(bt.amount, bt.currency)}`)
    }
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{t('Payment split', 'Разбивка оплаты')}</h3>
        <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)' }}>
          {t('Booking cost', 'Стоимость брони')}: {data.bookingTotals.length ? data.bookingTotals.map((b) => money(b.amount, b.currency)).join(' · ') : '—'}
        </div>
      </div>

      {payers.length === 0 ? (
        <div style={{ padding: '18px', border: '1px dashed var(--admin-text-faint)', borderRadius: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: 'var(--admin-text-muted)', marginBottom: '10px' }}>
            {t('Set up a split if several clients pay separately.', 'Настройте разбивку, если платят несколько клиентов раздельно.')}
          </div>
          <button type="button" onClick={handleAddFirst} disabled={busy}
            style={{ ...field, cursor: 'pointer', color: 'var(--admin-accent)', width: 'auto' }}>
            {t('Set up split', 'Настроить разбивку')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {payers.map((p, i) => (
            <div key={p.id} style={{ border: '1px solid var(--admin-border-card)', borderRadius: '10px', padding: '12px', background: 'var(--admin-card)' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 200px' }}>
                  <label style={label}>{t('Payer', 'Плательщик')} {i + 1}</label>
                  <select value={p.client_id || ''} onChange={(e) => { patchLocal(p.id, { client_id: e.target.value || null }); saveAndReload(p.id, { client_id: e.target.value || null }) }} style={{ ...field, width: '100%' }}>
                    <option value="">{t('— choose client —', '— выбрать клиента —')}</option>
                    {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ width: '120px' }}>
                  <label style={label}>{t('Share', 'Доля')}</label>
                  <input type="number" step="0.01" defaultValue={p.share_amount ?? ''} style={{ ...field, width: '100%' }}
                    onChange={(e) => { const v = e.target.value === '' ? null : Number(e.target.value); patchLocal(p.id, { share_amount: v }); debouncedSave(p.id, { share_amount: v }) }} />
                </div>
                <div style={{ width: '84px' }}>
                  <label style={label}>{t('Cur.', 'Валюта')}</label>
                  <select value={p.share_currency} onChange={(e) => { patchLocal(p.id, { share_currency: e.target.value }); saveAndReload(p.id, { share_currency: e.target.value }) }} style={{ ...field, width: '100%' }}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label style={label}>{t('Expected account', 'Ожидаемый счёт')}</label>
                  <select value={p.account_id || ''} onChange={(e) => { patchLocal(p.id, { account_id: e.target.value || null }); updatePayer(p.id, { account_id: e.target.value || null }) }} style={{ ...field, width: '100%' }}>
                    <option value="">—</option>
                    {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                  </select>
                </div>
                <button type="button" onClick={() => handleDelete(p.id)} disabled={busy}
                  style={{ ...field, cursor: 'pointer', color: 'var(--admin-danger)', width: 'auto', padding: '8px 10px' }}>✕</button>
              </div>

              <div style={{ marginTop: '8px' }}>
                <input type="text" defaultValue={p.note ?? ''} placeholder={t('Note (e.g. by card)', 'Заметка (напр. картой)')} style={{ ...field, width: '100%' }}
                  onChange={(e) => { const v = e.target.value || null; debouncedSave(p.id, { note: v }) }} />
              </div>

              {/* баланс */}
              <div style={{ display: 'flex', gap: '18px', marginTop: '10px', fontSize: '12.5px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--admin-text-muted)' }}>{t('Share', 'Доля')}: <b style={{ color: 'var(--admin-text)' }}>{money(p.share_amount, p.share_currency)}</b></span>
                <span style={{ color: 'var(--admin-text-muted)' }}>{t('Paid', 'Оплачено')}: <b style={{ color: 'var(--admin-success)' }}>{money(p.paid, p.share_currency)}</b></span>
                <span style={{ color: 'var(--admin-text-muted)' }}>{t('Remaining', 'Остаток')}: <b style={{ color: (p.remaining ?? 0) > 0 ? 'var(--admin-warn, #b8860b)' : 'var(--admin-success)' }}>
                  {p.remaining == null ? '—' : (p.remaining <= 0 ? `✓ ${t('paid', 'оплачено')}` : money(p.remaining, p.share_currency))}
                </b></span>
              </div>
            </div>
          ))}

          <button type="button" onClick={handleAdd} disabled={busy}
            style={{ ...field, cursor: 'pointer', color: 'var(--admin-accent)', width: 'auto', border: '1px dashed var(--admin-border-card)' }}>
            + {t('Add payer', 'Добавить плательщика')}
          </button>

          {/* мягкая сверка */}
          {multi && mismatches.length > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--admin-warn, #b8860b)' }}>
              ⚠ {t('Shares don’t match booking cost', 'Сумма долей не сходится со стоимостью брони')}: {mismatches.join('; ')}
            </div>
          )}

          {/* прочие поступления */}
          {data.other.length > 0 && (
            <div style={{ marginTop: '6px', paddingTop: '10px', borderTop: '1px solid var(--admin-border-card)' }}>
              <div style={{ ...label, marginBottom: '6px' }}>{t('Other receipts (not applied to a share)', 'Прочие поступления (не зачтены в долю)')}</div>
              {data.other.map((o, idx) => (
                <div key={idx} style={{ fontSize: '12.5px', color: 'var(--admin-text-muted)' }}>
                  {o.client_name || t('Unknown client', 'Неизвестный клиент')} — {money(o.amount, o.currency)}
                </div>
              ))}
              <div style={{ fontSize: '11px', color: 'var(--admin-text-faint)', marginTop: '4px' }}>
                {t('These are payments on this booking whose client or currency does not match any payer’s share.',
                  'Это платежи по брони, чей клиент или валюта не совпали с долей ни одного плательщика.')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
