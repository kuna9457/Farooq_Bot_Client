import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, Empty, ErrorBox, SideBadge, Stat } from '../components/ui'
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
          <Card title="Daily log">
            <div className="overflow-x-auto max-h-96"><table className="tbl">
              <thead><tr><th>Date</th><th className="text-right">Nifty chg</th><th>Regime</th><th>BUY candidates</th><th>SELL candidates</th><th>Trades</th><th className="text-right">P&L</th></tr></thead>
              <tbody>{(d.days ?? []).map((x: any) => (
                <tr key={x.date}><td className="text-xs">{x.date}</td><td className={`num text-right ${pnlColor(x.nifty_change)}`}>{signed(x.nifty_change)}</td><td><SideBadge side={x.regime} /></td>
                  <td className="text-xs">{x.buy_candidates.join(', ') || '—'}</td><td className="text-xs">{x.sell_candidates.join(', ') || '—'}</td>
                  <td className="num">{x.trades}</td><td className={`num text-right ${pnlColor(x.net_pnl)}`}>{signed(x.net_pnl)}</td></tr>))}
              </tbody></table></div>
          </Card>
        </>
      )}
    </div>
  )
}
