import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Card, ErrorBox } from '../components/ui'
import { api } from '../lib/api'

type P = any

const MA_KINDS: [string, string][] = [['SMA', 'SMA'], ['EMA', 'EMA'], ['SMMA', 'SMMA (RMA)'], ['WMA', 'WMA'], ['VWMA', 'VWMA']]
const MA_SOURCES: [string, string][] = [['open', 'Open'], ['high', 'High'], ['low', 'Low'], ['close', 'Close'], ['volume', 'Volume'],
  ['hl2', '(H + L)/2'], ['hlc3', '(H + L + C)/3'], ['ohlc4', '(O + H + L + C)/4'], ['hlcc4', '(H + L + C + C)/4']]

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

      <Card title="Stock selection">
        <div className="grid gap-4 sm:grid-cols-3 items-start">
          <Field label="How are stocks chosen?" hint="Manual watchlist: you pick the stocks and their side on the Watchlist page — no 08:30 scan and no Nifty-points rule. Screener: the original month-high / month-low scan + Nifty regime.">
            <select className="input" value={p.selection_mode} onChange={(e) => set('selection_mode', e.target.value)}>
              <option value="watchlist">Manual watchlist</option>
              <option value="screener">Screener (08:30 scan + Nifty regime)</option>
            </select>
          </Field>
          {p.selection_mode === 'watchlist'
            ? <Field label="Bot start time (HH:MM)" hint="Filters run and entries are allowed from this time. Default 09:30."><input className="input" value={p.start_time} onChange={(e) => set('start_time', e.target.value)} /></Field>
            : <div />}
          <div className="flex flex-col gap-2 pt-1">
            <label className="label">Sides the bot may trade</label>
            <div className="flex gap-4">
              {(['BUY', 'SELL'] as const).map((sd) => (
                <label key={sd} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.sides_enabled.includes(sd)}
                  onChange={(e) => set('sides_enabled', e.target.checked ? [...p.sides_enabled, sd] : p.sides_enabled.filter((x: string) => x !== sd))} />Trade {sd} side</label>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card title="When filters are checked">
        <div className="grid gap-4 sm:grid-cols-3 items-start">
          <Field label="Evaluation mode" hint="Tick: every live WebSocket tick (forming 5-min candle). Candle close: only when a 5-min candle completes.">
            <select className="input" value={p.eval_mode} onChange={(e) => set('eval_mode', e.target.value)}>
              <option value="tick">Every tick (Angel WebSocket)</option>
              <option value="bar_close">5-minute candle close</option>
            </select>
          </Field>
          <Field label="Min seconds between checks per stock" hint="Throttle so a busy stock doesn't recompute on every single tick">{numIn('tick_interval_sec', 0.2)}</Field>
          <p className="text-xs text-muted">Tick mode needs the Angel One WebSocket (Broker page). Without it the bot falls back to 5-minute candle closes automatically. Signals on a still-forming candle can appear and disappear (repaint) before the candle closes.</p>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {p.selection_mode === 'screener' && <Card title="Pre-market scan (08:30)">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Month lookback (sessions)" hint="New month high = prev day ≥ highest of last N">{numIn('scan.month_lookback_days')}</Field>
            <Field label="Basis">{sel('scan.month_basis', ['high_low', 'close'])}</Field>
            <Field label="Top N per side">{numIn('scan.top_n')}</Field>
          </div>
        </Card>}
        {p.selection_mode === 'screener' && <Card title="Market regime (Nifty)">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Threshold (points)">{numIn('regime.threshold_points')}</Field>
            <Field label="Rule" hint="literal: >+T BUY else SELL · symmetric: ±T with no-trade zone">{sel('regime.rule', ['literal', 'symmetric'])}</Field>
            <Field label="Decision time (HH:MM)"><input className="input" value={p.regime.decision_time} onChange={(e) => set('regime.decision_time', e.target.value)} /></Field>
          </div>
        </Card>}
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
            <div className="sm:col-span-3">
              <label className="label">MA ribbon (same inputs as TradingView)</label>
              <div className="space-y-2">
                {p.filter2.ribbon.mas.map((m: any, i: number) => (
                  <div key={i} className="grid grid-cols-[6rem_1fr_1.4fr_5rem] items-center gap-2">
                    <label className="flex items-center gap-2 text-sm whitespace-nowrap"><input type="checkbox" checked={m.enabled} onChange={(e) => set(`filter2.ribbon.mas.${i}.enabled`, e.target.checked)} />MA #{i + 1}</label>
                    <select className="input" value={m.kind} onChange={(e) => set(`filter2.ribbon.mas.${i}.kind`, e.target.value)}>
                      {MA_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select className="input" value={m.source} onChange={(e) => set(`filter2.ribbon.mas.${i}.source`, e.target.value)}>
                      {MA_SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input type="number" min={1} className="input" value={m.length} onChange={(e) => set(`filter2.ribbon.mas.${i}.length`, e.target.value === '' ? '' : Number(e.target.value))} />
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted">Per MA: on/off · type · price source · length. Timeframe is the daily chart and only completed daily candles are used (like “wait for timeframe closes”).</p>
            </div>
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
            <Field label="Last entry time"><input className="input" value={p.risk.last_entry_time} onChange={(e) => set('risk.last_entry_time', e.target.value)} /></Field>
            <Field label="Square-off time"><input className="input" value={p.risk.square_off_time} onChange={(e) => set('risk.square_off_time', e.target.value)} /></Field>
            <Field label="Daily loss limit ₹ (0 = off)">{numIn('risk.daily_loss_limit', 500)}</Field>
            <Field label="Slippage % (paper/backtest)">{numIn('risk.slippage_pct', 0.01)}</Field>
          </div>
          <p className="mt-3 text-xs text-muted">Exit: the opposite Chandelier signal on the 5-minute chart (no stop-loss / target). Anything still open is squared off at the square-off time.</p>
        </Card>
      </div>
    </div>
  )
}
