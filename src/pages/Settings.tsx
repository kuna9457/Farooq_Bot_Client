import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Card, ErrorBox } from '../components/ui'
import { api } from '../lib/api'

type P = any

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <div><label className="label">{label}</label>{children}{hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}</div>
}

export default function Settings() {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['strategy'], queryFn: () => api<P>('/settings/strategy') })
  const rt = useQuery({ queryKey: ['runtime'], queryFn: () => api('/settings/runtime') })
  const [p, setP] = useState<P | null>(null)
  const [cap, setCap] = useState<number | ''>('')
  useEffect(() => { if (q.data) setP(structuredClone(q.data)) }, [q.data])
  useEffect(() => { if (rt.data) setCap(rt.data.paper_capital) }, [rt.data])
  const save = useMutation({ mutationFn: () => api('/settings/strategy', { method: 'PUT', body: p }), onSuccess: () => qc.invalidateQueries() })
  const reset = useMutation({ mutationFn: () => api('/settings/strategy/reset', { method: 'POST' }), onSuccess: () => qc.invalidateQueries() })
  const saveRt = useMutation({ mutationFn: (b: any) => api('/settings/runtime', { method: 'PUT', body: b }), onSuccess: () => qc.invalidateQueries() })
  if (!p) return <div className="text-muted">Loading…</div>

  const set = (path: string, v: any) => {
    const n = structuredClone(p)
    const ks = path.split('.')
    let o = n
    ks.slice(0, -1).forEach((k) => (o = o[k]))
    o[ks.at(-1)!] = v
    setP(n)
  }
  const numIn = (path: string, step = 1) => {
    const v = path.split('.').reduce((o: any, k) => o?.[k], p)
    return <input type="number" step={step} className="input" value={v ?? ''} onChange={(e) => set(path, e.target.value === '' ? '' : Number(e.target.value))} />
  }
  const sel = (path: string, opts: string[]) => {
    const v = path.split('.').reduce((o: any, k) => o?.[k], p)
    return <select className="input" value={v} onChange={(e) => set(path, e.target.value)}>{opts.map((o) => <option key={o}>{o}</option>)}</select>
  }
  const chk = (path: string, label: string) => {
    const v = path.split('.').reduce((o: any, k) => o?.[k], p)
    return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!v} onChange={(e) => set(path, e.target.checked)} />{label}</label>
  }
  const ce = (f: string) => (<>
    <Field label="Chandelier ATR period">{numIn(`${f}.ce.length`)}</Field>
    <Field label="Chandelier multiplier">{numIn(`${f}.ce.mult`, 0.1)}</Field>
    <div className="flex items-end pb-2">{chk(`${f}.ce.use_close`, 'Use close for extremums')}</div>
  </>)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold">Settings</h1><p className="text-sm text-muted">Strategy parameters are versioned; changes apply to the next evaluation.</p></div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => confirm('Reset all strategy params to defaults?') && reset.mutate()}>Reset defaults</button>
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save settings'}</button>
        </div>
      </div>
      <ErrorBox error={save.error || saveRt.error} />
      {save.isSuccess && <div className="text-sm text-up">Saved.</div>}

      <Card title="Engine">
        <div className="grid gap-4 sm:grid-cols-3 items-end">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!rt.data?.engine_enabled} onChange={(e) => saveRt.mutate({ engine_enabled: e.target.checked })} />Auto-trading enabled</label>
          <Field label="Paper capital (₹)"><input type="number" className="input" value={cap} onChange={(e) => setCap(e.target.value === '' ? '' : Number(e.target.value))} /></Field>
          <button className="btn w-fit" onClick={() => saveRt.mutate({ paper_capital: Number(cap) })}>Save capital</button>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Pre-market scan (08:30)">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Month lookback (sessions)" hint="New month high = prev day ≥ highest of last N">{numIn('scan.month_lookback_days')}</Field>
            <Field label="Basis">{sel('scan.month_basis', ['high_low', 'close'])}</Field>
            <Field label="Top N per side">{numIn('scan.top_n')}</Field>
          </div>
        </Card>
        <Card title="Market regime (Nifty)">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Threshold (points)">{numIn('regime.threshold_points')}</Field>
            <Field label="Rule" hint="literal: >+T BUY else SELL · symmetric: ±T with no-trade zone">{sel('regime.rule', ['literal', 'symmetric'])}</Field>
            <Field label="Decision time (HH:MM)"><input className="input" value={p.regime.decision_time} onChange={(e) => set('regime.decision_time', e.target.value)} /></Field>
          </div>
          <div className="mt-3 flex gap-4">
            {(['BUY', 'SELL'] as const).map((s) => (
              <label key={s} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.sides_enabled.includes(s)}
                onChange={(e) => set('sides_enabled', e.target.checked ? [...p.sides_enabled, s] : p.sides_enabled.filter((x: string) => x !== s))} />Trade {s} side</label>
            ))}
          </div>
        </Card>
        <Card title="Filter 1 · 5-year chart · anchored volume profile">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3 flex gap-4">{chk('filter1.enabled', 'Enabled')}{chk('filter1.use_heikin_ashi', 'Heikin-Ashi')}</div>
            <Field label="Timeframe">{sel('filter1.timeframe', ['1W', '1D', '1M'])}</Field>
            <Field label="Years">{numIn('filter1.years')}</Field>
            <div />
            {ce('filter1')}
            <Field label="VP rows">{numIn('filter1.vp.rows')}</Field>
            <Field label="Value area %">{numIn('filter1.vp.value_area_pct')}</Field>
          </div>
        </Card>
        <Card title="Filter 2 · Daily · Chandelier + MA ribbon breakout">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3 flex flex-wrap gap-4">{chk('filter2.enabled', 'Enabled')}{chk('filter2.use_heikin_ashi', 'Heikin-Ashi')}{chk('filter2.setup_requires_fresh_signal', 'Setup must be a fresh CE signal candle')}</div>
            {ce('filter2')}
            <Field label="Ribbon MA type">{sel('filter2.ribbon.kind', ['SMA', 'EMA', 'WMA', 'RMA'])}</Field>
            <Field label="Ribbon source" hint="Price the moving averages are calculated on">{sel('filter2.ribbon.source', ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'])}</Field>
            <div className="sm:col-span-3">
              <label className="label">Candle must be beyond the ribbon on</label>
              <div className="flex flex-wrap gap-4">
                {(['open', 'high', 'low', 'close'] as const).map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm capitalize">
                    <input type="checkbox" checked={p.filter2.candle_fields.includes(f)}
                      onChange={(e) => set('filter2.candle_fields', e.target.checked ? [...p.filter2.candle_fields, f] : p.filter2.candle_fields.filter((x: string) => x !== f))} />{f}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted">All ticked values must be above the upper ribbon (BUY) or below the lower ribbon (SELL). Default: open + close.</p>
            </div>
            <Field label="Ribbon lengths (comma)"><input className="input" value={p.filter2.ribbon.lengths.join(',')}
              onChange={(e) => set('filter2.ribbon.lengths', e.target.value.split(',').map((x) => Number(x.trim())).filter(Boolean))} /></Field>
            <Field label="Setup lookback (days)">{numIn('filter2.setup_lookback_days')}</Field>
          </div>
        </Card>
        <Card title="Filter 3 · 5 min · Chandelier + previous-day POC">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3 flex gap-4">{chk('filter3.enabled', 'Enabled')}{chk('filter3.use_heikin_ashi', 'Heikin-Ashi')}</div>
            {ce('filter3')}
            <Field label="VP rows">{numIn('filter3.vp.rows')}</Field>
            <Field label="Value area %">{numIn('filter3.vp.value_area_pct')}</Field>
            <Field label="Above POC rule">{sel('filter3.above_poc_rule', ['close', 'open_close'])}</Field>
          </div>
        </Card>
        <Card title="Risk & exits">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Capital per trade (₹)">{numIn('risk.capital_per_trade', 1000)}</Field>
            <Field label="Max open positions">{numIn('risk.max_open_positions')}</Field>
            <div className="flex items-end pb-2">{chk('risk.one_trade_per_stock_per_day', 'One trade / stock / day')}</div>
            <Field label="Stop-loss type">{sel('risk.stop_loss_type', ['none', 'percent', 'ce_stop'])}</Field>
            <Field label="Stop-loss %">{numIn('risk.stop_loss_pct', 0.1)}</Field>
            <Field label="Target % (0 = none)">{numIn('risk.target_pct', 0.1)}</Field>
            <Field label="Last entry time"><input className="input" value={p.risk.last_entry_time} onChange={(e) => set('risk.last_entry_time', e.target.value)} /></Field>
            <Field label="Square-off time"><input className="input" value={p.risk.square_off_time} onChange={(e) => set('risk.square_off_time', e.target.value)} /></Field>
            <Field label="Daily loss limit ₹ (0 = off)">{numIn('risk.daily_loss_limit', 500)}</Field>
            <Field label="Slippage % (paper/backtest)">{numIn('risk.slippage_pct', 0.01)}</Field>
          </div>
          <p className="mt-3 text-xs text-muted">Primary exit: opposite Chandelier signal on the 5-minute chart. Stop-loss/target are monitored on live prices.</p>
        </Card>
      </div>
    </div>
  )
}
