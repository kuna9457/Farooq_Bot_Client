import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Download, Trash2 } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, Empty, ErrorBox, FilterChip, SideBadge, Stat } from '../components/ui'
import { api } from '../lib/api'
import type { Trade } from '../lib/api'
import { dateTime, inr, num, pnlColor, signed } from '../lib/format'
import { useLive } from '../lib/live'

const iso = (d: Date) => d.toISOString().slice(0, 10)

export default function Backtest() {
  const qc = useQueryClient()
  const live = useLive((s) => s.backtest)
  const version = useLive((s) => s.version)
  const status = useQuery({ queryKey: ['status'], queryFn: () => api('/status') })
  const yf = status.data?.data_provider === 'yfinance'
  const [form, setForm] = useState({
    start: iso(new Date(Date.now() - 55 * 864e5)), end: iso(new Date(Date.now() - 864e5)), capital: 1000000, name: '',
    rule: '', threshold: '', sl: '',
  })
  const runs = useQuery({ queryKey: ['bt-runs'], queryFn: () => api<any[]>('/backtest'), refetchInterval: 5000 })
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => { if (!sel && runs.data?.length) setSel(runs.data[0]._id) }, [runs.data, sel])
  useEffect(() => { qc.invalidateQueries({ queryKey: ['bt-runs'] }); qc.invalidateQueries({ queryKey: ['bt'] }) }, [version, qc])

  const run = useMutation({
    mutationFn: async () => {
      const params = await api('/settings/strategy')
      if (form.rule) params.regime.rule = form.rule
      if (form.threshold) params.regime.threshold_points = Number(form.threshold)
      if (form.sl) { params.risk.stop_loss_type = form.sl === 'none' ? 'none' : 'percent'; if (form.sl !== 'none') params.risk.stop_loss_pct = Number(form.sl) }
      return api<{ run_id: string }>('/backtest/run', { method: 'POST', body: { start: form.start, end: form.end, capital: form.capital, name: form.name, params } })
    },
    onSuccess: (r) => { setSel(r.run_id); qc.invalidateQueries({ queryKey: ['bt-runs'] }) },
  })
  const del = useMutation({ mutationFn: (id: string) => api(`/backtest/${id}`, { method: 'DELETE' }), onSuccess: () => { setSel(null); qc.invalidateQueries({ queryKey: ['bt-runs'] }) } })

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Backtest</h1>
      <Card title="New backtest" right={<span className="text-xs text-muted">uses current Settings; overrides below are optional</span>}>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7 items-end">
          <div><label className="label">Start</label><input type="date" className="input" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></div>
          <div><label className="label">End</label><input type="date" className="input" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></div>
          <div><label className="label">Capital (₹)</label><input type="number" className="input" value={form.capital} onChange={(e) => setForm({ ...form, capital: Number(e.target.value) })} /></div>
          <div><label className="label">Regime rule</label><select className="input" value={form.rule} onChange={(e) => setForm({ ...form, rule: e.target.value })}><option value="">(settings)</option><option value="literal">literal (≤+50 → SELL)</option><option value="symmetric">symmetric (no-trade zone)</option></select></div>
          <div><label className="label">Threshold pts</label><input className="input" placeholder="(settings)" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} /></div>
          <div><label className="label">Stop-loss %</label><input className="input" placeholder="(settings) / none" value={form.sl} onChange={(e) => setForm({ ...form, sl: e.target.value })} /></div>
          <button className="btn btn-primary justify-center" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? 'Starting…' : 'Run backtest'}</button>
        </div>
        {yf && <p className="mt-3 text-xs text-warn">Data provider is yfinance: 5-minute history is limited to the last ~58 days. Connect Upstox and set DATA_PROVIDER=upstox for longer backtests.</p>}
        <ErrorBox error={run.error} />
      </Card>

      <div className="grid gap-5 xl:grid-cols-4">
        <Card title="Runs" className="xl:col-span-1">
          {runs.data?.length ? (
            <ul className="space-y-1">
              {runs.data.map((r) => {
                const lp = live[r._id]
                return (
                  <li key={r._id}>
                    <button onClick={() => setSel(r._id)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${sel === r._id ? 'bg-accent/15' : 'hover:bg-panel2'}`}>
                      <div className="flex justify-between gap-2"><span className="font-medium truncate">{r.name}</span>
                        <span className={`text-xs ${r.status === 'DONE' ? 'text-up' : r.status === 'FAILED' ? 'text-down' : 'text-warn'}`}>{r.status}</span></div>
                      <div className="text-xs text-muted">{r.status === 'DONE' ? `${r.metrics?.total_trades} trades · ${signed(r.metrics?.net_pnl)}` : `${lp?.progress ?? r.progress ?? 0}% ${lp?.message ?? r.message ?? ''}`}</div>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : <Empty>No runs yet</Empty>}
        </Card>
        <div className="xl:col-span-3">{sel ? <RunView id={sel} onDelete={() => del.mutate(sel)} /> : <Card><Empty>Select or start a run</Empty></Card>}</div>
      </div>
    </div>
  )
}

function RunView({ id, onDelete }: { id: string; onDelete: () => void }) {
  const r = useQuery({ queryKey: ['bt', id], queryFn: () => api(`/backtest/${id}`), refetchInterval: (q) => (q.state.data?.status === 'DONE' || q.state.data?.status === 'FAILED' ? false : 2000) })
  const trades = useQuery({ queryKey: ['bt-trades', id, r.data?.status], queryFn: () => api<Trade[]>(`/backtest/${id}/trades`), enabled: r.data?.status === 'DONE' })
  const d = r.data
  if (!d) return <Card><Empty>Loading…</Empty></Card>
  const m = d.metrics ?? {}
  return (
    <div className="space-y-4">
      <Card title={`${d.name} · ${d.start} → ${d.end} · ${d.data_provider ?? ''}`} right={<button className="btn !py-1 text-xs" onClick={() => confirm('Delete this run?') && onDelete()}><Trash2 size={13} />Delete</button>}>
        {d.status !== 'DONE' ? (
          d.status === 'FAILED' ? <ErrorBox error={d.message} /> : (
            <div><div className="h-2 rounded bg-panel2"><div className="h-2 rounded bg-accent transition-all" style={{ width: `${d.progress ?? 0}%` }} /></div>
              <p className="mt-2 text-sm text-muted">{d.progress ?? 0}% · {d.message}</p></div>)
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
              <Stat label="Net P&L" value={inr(m.net_pnl, 0)} tone={pnlColor(m.net_pnl)} sub={`${m.return_pct ?? 0}% on capital`} />
              <Stat label="Trades" value={m.total_trades} sub={`${m.days_with_trades ?? 0} of ${m.trading_days} days`} />
              <Stat label="Win rate" value={m.win_rate != null ? `${m.win_rate}%` : '—'} sub={`${m.wins ?? 0}W / ${m.losses ?? 0}L`} />
              <Stat label="Profit factor" value={m.profit_factor ?? '—'} sub={`Expectancy ${inr(m.expectancy, 0)}`} />
              <Stat label="Max drawdown" value={inr(m.max_drawdown, 0)} tone="text-down" sub={`${m.max_drawdown_pct ?? 0}%`} />
              <Stat label="Charges" value={inr(m.charges, 0)} sub={`Sharpe ${m.sharpe ?? '—'}`} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-line p-3 text-sm">
                <div className="text-xs text-muted mb-2">Regime days</div>
                BUY <b className="text-up">{m.buy_days}</b> · SELL <b className="text-down">{m.sell_days}</b> · NO-TRADE <b className="text-warn">{m.no_trade_days}</b>
              </div>
              <div className="rounded-lg border border-line p-3 text-sm">
                <div className="text-xs text-muted mb-2">Filter pass rate (per evaluation)</div>
                {Object.entries(m.filter_pass_rate ?? {}).map(([k, v]) => <span key={k} className="mr-4">{k} <b>{v == null ? '—' : `${v}%`}</b> <span className="text-xs text-muted">({m.filter_evaluations?.[k]})</span></span>)}
              </div>
            </div>
            {m.equity_curve?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={m.equity_curve}>
                  <XAxis dataKey="date" tick={{ fill: '#8a96ad', fontSize: 11 }} stroke="#243049" />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: '#8a96ad', fontSize: 11 }} stroke="#243049" width={80} />
                  <Tooltip contentStyle={{ background: '#182033', border: '1px solid #243049', borderRadius: 8 }} />
                  <Area dataKey="equity" stroke="#3b82f6" fill="#3b82f633" strokeWidth={2} name="Equity" />
                </AreaChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        )}
      </Card>
      {d.status === 'DONE' && (
        <>
          <Card title="Trades">
            {trades.data?.length ? (
              <div className="overflow-x-auto"><table className="tbl">
                <thead><tr><th>Date</th><th>Stock</th><th>Side</th><th>Qty</th><th className="text-right">Entry</th><th className="text-right">Exit</th><th className="text-right">Ret %</th><th className="text-right">Net</th><th>Exit reason</th><th>Time</th></tr></thead>
                <tbody>{trades.data.map((t, i) => (
                  <tr key={i}><td className="text-xs">{t.date}</td><td className="font-semibold">{t.symbol}</td><td><SideBadge side={t.side} /></td><td className="num">{t.qty}</td>
                    <td className="num text-right">{num(t.entry_price)}</td><td className="num text-right">{num(t.exit_price)}</td>
                    <td className={`num text-right ${pnlColor(t.return_pct)}`}>{signed(t.return_pct, 2)}</td>
                    <td className={`num text-right font-semibold ${pnlColor(t.net_pnl)}`}>{signed(t.net_pnl)}</td><td className="text-xs">{t.exit_reason}</td>
                    <td className="text-xs text-muted">{dateTime(t.entry_time).split(', ').pop()} → {dateTime(t.exit_time).split(', ').pop()}</td></tr>))}
                </tbody></table></div>
            ) : <Empty>No trades in this period — all three filters rarely align. Try a longer range or different settings.</Empty>}
          </Card>
          <DayLog days={d.days ?? []} name={d.name} />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------- day-by-day scan + filters
type FRec = { status: string; reason: string; passes: number; evaluations: number; first_pass?: string | null }
const FKEYS = ['F1', 'F2', 'F3'] as const
const ever = (r: any, k: string) => !!r[k] && r[k].passes > 0
const asRes = (k: string, f?: FRec) => f ? ({ filter_id: k, status: f.status, passed: f.status === 'PASS', values: {},
  reason: `${f.reason}  —  passed ${f.passes} of ${f.evaluations} checks${f.first_pass ? `, first at ${f.first_pass}` : ''}` } as any) : undefined

function DayLog({ days, name }: { days: any[]; name: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [q, setQ] = useState('')
  const [onlyTrades, setOnlyTrades] = useState(false)
  const [onlyActive, setOnlyActive] = useState(false)

  const shown = useMemo(() => days.filter((d) =>
    (!onlyTrades || d.trades > 0) &&
    (!onlyActive || d.regime !== 'NO_TRADE') &&
    (!q || (d.stocks ?? []).some((x: any) => x.symbol.toLowerCase().includes(q.toLowerCase())))), [days, q, onlyTrades, onlyActive])

  const byStock = useMemo(() => {
    const m: Record<string, any> = {}
    for (const d of days) for (const x of d.stocks ?? []) {
      const r = (m[x.symbol] ??= { symbol: x.symbol, scanned: 0, active: 0, F1: 0, F2: 0, F3: 0, signals: 0, trades: 0, pnl: 0 })
      r.scanned++
      if (x.active) { r.active++; FKEYS.forEach((k) => { if (ever(x, k)) r[k]++ }); if (x.signal_time) r.signals++ }
      for (const t of x.trades ?? []) { r.trades++; r.pnl += t.net_pnl }
    }
    return Object.values(m).sort((a: any, b: any) => b.scanned - a.scanned)
  }, [days])

  const csv = () => {
    const rows: any[][] = [['date', 'regime', 'nifty_change', 'symbol', 'side', 'rank', 'market_cap_cr', 'traded_side', 'note',
      'F1', 'F1_reason', 'F2', 'F2_reason', 'F3', 'F3_reason', 'signal_time', 'trades', 'net_pnl']]
    for (const d of days) for (const x of d.stocks ?? []) {
      rows.push([d.date, d.regime, d.nifty_change, x.symbol, x.side, x.rank, x.market_cap_cr, x.active, x.note,
        x.F1?.status ?? '', x.F1?.reason ?? '', x.F2?.status ?? '', x.F2?.reason ?? '', x.F3?.status ?? '', x.F3?.reason ?? '',
        x.signal_time ?? '', (x.trades ?? []).length, (x.trades ?? []).reduce((a: number, t: any) => a + t.net_pnl, 0)])
    }
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `${name || 'backtest'}-day-by-day.csv`; a.click()
  }

  return (
    <>
      <Card title={`Day-by-day: scan & filters (${shown.length} of ${days.length} days)`}
        right={<button className="btn !py-1 text-xs" onClick={csv}><Download size={13} />CSV</button>}>
        <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
          <input className="input !w-44" placeholder="Filter by stock…" value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={onlyTrades} onChange={(e) => setOnlyTrades(e.target.checked)} />Only days with trades</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />Hide NO-TRADE days</label>
          <button className="btn !py-1 text-xs" onClick={() => setOpen(Object.fromEntries(shown.map((d) => [d.date, true])))}>Expand all</button>
          <button className="btn !py-1 text-xs" onClick={() => setOpen({})}>Collapse all</button>
        </div>
        <div className="overflow-x-auto max-h-[36rem]"><table className="tbl">
          <thead><tr><th /><th>Date</th><th className="text-right">Nifty chg</th><th>Regime</th><th>Scan (new high / low)</th>
            <th>BUY candidates</th><th>SELL candidates</th><th>Filters passed (traded side)</th><th>Trades</th><th className="text-right">P&L</th></tr></thead>
          <tbody>{shown.map((x: any) => {
            const act = (x.stocks ?? []).filter((s: any) => s.active)
            const isOpen = open[x.date]
            return (
              <Fragment key={x.date}>
                <tr className="cursor-pointer hover:bg-panel2" onClick={() => setOpen({ ...open, [x.date]: !isOpen })}>
                  <td>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                  <td className="text-xs">{x.date}</td><td className={`num text-right ${pnlColor(x.nifty_change)}`}>{signed(x.nifty_change)}</td><td><SideBadge side={x.regime} /></td>
                  <td className="text-xs">{x.scan ? <><b className="text-up">{x.scan.high_count}</b> / <b className="text-down">{x.scan.low_count}</b> of {x.scan.scanned}</> : '—'}</td>
                  <td className="text-xs">{x.buy_candidates.join(', ') || '—'}</td><td className="text-xs">{x.sell_candidates.join(', ') || '—'}</td>
                  <td className="text-xs whitespace-nowrap">{act.length ? FKEYS.map((k) => <span key={k} className="mr-3">{k} <b>{act.filter((s: any) => ever(s, k)).length}/{act.length}</b></span>) : '—'}</td>
                  <td className="num">{x.trades}</td><td className={`num text-right ${pnlColor(x.net_pnl)}`}>{signed(x.net_pnl)}</td></tr>
                {isOpen && (
                  <tr><td /><td colSpan={9} className="!bg-panel2/40">
                    <div className="py-2 space-y-2">
                      {x.scan && <div className="text-xs text-muted">
                        Scanned {x.scan.scanned} stocks · new month highs ({x.scan.high_count}): {x.scan.high_symbols.join(', ') || '—'} · new month lows ({x.scan.low_count}): {x.scan.low_symbols.join(', ') || '—'}
                      </div>}
                      <table className="tbl"><thead><tr><th>Stock</th><th>Side</th><th>Rank</th><th className="text-right">M.Cap (Cr)</th><th className="text-right">Prev close</th>
                        <th>F1 · 5Y</th><th>F2 · 1D</th><th>F3 · 5m</th><th>Signal</th><th>Result</th></tr></thead>
                        <tbody>{(x.stocks ?? []).map((s: any) => (
                          <tr key={s.side + s.symbol} className={s.active ? '' : 'opacity-50'}>
                            <td className="font-semibold">{s.symbol}</td><td><SideBadge side={s.side} /></td><td className="num">{s.rank}</td>
                            <td className="num text-right">{num(s.market_cap_cr, 0)}</td><td className="num text-right">{num(s.last_close)}</td>
                            {FKEYS.map((k) => (
                              <td key={k}>{s[k] ? <div className="flex flex-col gap-0.5"><FilterChip label={k} f={asRes(k, s[k])} />
                                <span className="text-[10px] text-muted">{s[k].passes}/{s[k].evaluations} checks{s[k].first_pass ? ` · from ${s[k].first_pass}` : ''}</span></div>
                                : <span className="text-xs text-muted">{s.active ? 'not evaluated' : '—'}</span>}</td>))}
                            <td className="text-xs">{s.signal_time ?? '—'}</td>
                            <td className="text-xs">{s.trades?.length
                              ? s.trades.map((t: any, i: number) => <div key={i}>{t.entry_time}→{t.exit_time} <b className={pnlColor(t.net_pnl)}>{signed(t.net_pnl)}</b> <span className="text-muted">{t.exit_reason}</span></div>)
                              : (s.note || (s.active ? 'No entry' : '—'))}</td>
                          </tr>))}</tbody></table>
                    </div>
                  </td></tr>)}
              </Fragment>)
          })}</tbody></table></div>
      </Card>
      <Card title="Filter summary by stock (whole period)">
        <div className="overflow-x-auto max-h-96"><table className="tbl">
          <thead><tr><th>Stock</th><th className="text-right">Days scanned</th><th className="text-right">Days traded side</th>
            <th className="text-right">F1 passed days</th><th className="text-right">F2 passed days</th><th className="text-right">F3 passed days</th>
            <th className="text-right">All-3 signals</th><th className="text-right">Trades</th><th className="text-right">Net P&L</th></tr></thead>
          <tbody>{byStock.map((r: any) => (
            <tr key={r.symbol}><td className="font-semibold">{r.symbol}</td><td className="num text-right">{r.scanned}</td><td className="num text-right">{r.active}</td>
              <td className="num text-right">{r.F1}</td><td className="num text-right">{r.F2}</td><td className="num text-right">{r.F3}</td>
              <td className="num text-right">{r.signals}</td><td className="num text-right">{r.trades}</td><td className={`num text-right ${pnlColor(r.pnl)}`}>{signed(r.pnl)}</td></tr>))}</tbody></table></div>
      </Card>
    </>
  )
}
