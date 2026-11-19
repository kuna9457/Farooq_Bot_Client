import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Power, RefreshCw, ShieldAlert, Zap } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import FilterMatrix from '../components/FilterMatrix'
import { Card, Empty, ErrorBox, SideBadge, Stat } from '../components/ui'
import { api } from '../lib/api'
import type { FilterState, LogItem, Position, Session } from '../lib/api'
import { inr, num, pnlColor, signed, time } from '../lib/format'
import { useLive } from '../lib/live'

export default function Dashboard() {
  const qc = useQueryClient()
  const version = useLive((s) => s.version)
  const live = useLive()
  const sessQ = useQuery({ queryKey: ['session'], queryFn: () => api<{ session: Session; filters: FilterState[] }>('/session'), refetchInterval: 30000 })
  const accQ = useQuery({ queryKey: ['account'], queryFn: () => api('/account/summary'), refetchInterval: 30000 })
  const posQ = useQuery({ queryKey: ['positions'], queryFn: () => api<Position[]>('/positions?status=OPEN'), refetchInterval: 15000 })
  const pnlQ = useQuery({ queryKey: ['pnl-intraday'], queryFn: () => api<any[]>('/pnl/intraday'), refetchInterval: 60000 })
  const logsQ = useQuery({ queryKey: ['logs'], queryFn: () => api<LogItem[]>('/logs?limit=30') })
  const rtQ = useQuery({ queryKey: ['runtime'], queryFn: () => api('/settings/runtime') })

  useEffect(() => { qc.invalidateQueries() }, [version, qc])

  const s = live.session ?? sessQ.data?.session
  const filters = useMemo(() => {
    const m: Record<string, FilterState> = {}
    sessQ.data?.filters?.forEach((f) => (m[f.symbol] = f))
    return { ...m, ...live.filters }
  }, [sessQ.data, live.filters])
  const candidates = [...(s?.buy_candidates ?? []), ...(s?.sell_candidates ?? [])]
  const ordered = s?.regime === 'SELL' ? [...(s?.sell_candidates ?? []), ...(s?.buy_candidates ?? [])] : candidates
  const positions = live.positions ?? posQ.data ?? []
  const pnl = live.pnl ?? accQ.data?.day_pnl
  const acc = accQ.data
  const broker = acc?.mode === 'live' ? acc?.brokers?.[acc.execution_broker] : acc?.paper
  const logs = [...live.logs, ...(logsQ.data ?? [])].filter((l, i, a) => a.findIndex((x) => x.ts === l.ts && x.message === l.message) === i).slice(0, 25)

  const act = useMutation({
    mutationFn: (path: string) => api(path, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries(),
  })
  const halted = rtQ.data?.halted_date === s?.date || rtQ.data?.engine_enabled === false

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted">{s?.date ?? '—'} · scanned {time(s?.scanned_at)} · regime {time(s?.regime_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={act.isPending} onClick={() => act.mutate('/engine/scan')}><RefreshCw size={14} />Run scan</button>
          <button className="btn" disabled={act.isPending} onClick={() => act.mutate('/engine/regime')}><Zap size={14} />Decide regime</button>
          <button className="btn" disabled={act.isPending} onClick={() => act.mutate('/engine/evaluate')}><Play size={14} />Evaluate filters</button>
          {halted
            ? <button className="btn btn-primary" onClick={() => act.mutate('/engine/resume')}><Power size={14} />Resume trading</button>
            : <button className="btn btn-danger" onClick={() => confirm('Square off ALL positions and stop auto-trading for today?') && act.mutate('/engine/kill-switch')}>
                <ShieldAlert size={14} />Kill switch</button>}
        </div>
      </div>
      <ErrorBox error={act.error} />

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label={`Balance (${acc?.mode === 'live' ? acc?.execution_broker : 'paper'})`} value={inr(broker?.total, 0)} sub={`Available ${inr(broker?.available, 0)}`} />
        <Stat label="Margin used" value={inr(broker?.used, 0)} />
        <Stat label="Today P&L" value={signed(pnl?.total)} tone={pnlColor(pnl?.total)} sub={`Realized ${signed(pnl?.realized)} · Open ${signed(pnl?.unrealized)}`} />
        <Stat label="Trades today" value={pnl?.trades ?? 0} sub={`${pnl?.wins ?? 0} winners`} />
        <Stat label="Nifty change" value={signed(s?.nifty_change)} tone={pnlColor(s?.nifty_change)} sub={s?.nifty_price_source ? `${s.nifty_price_source} · ±${s.regime_threshold} pts (${s.regime_rule})` : 'decided 09:30'} />
        <Stat label="Today's side" value={<SideBadge side={s?.regime} />} sub={`${s?.month_high_count ?? 0} month-highs · ${s?.month_low_count ?? 0} month-lows`} />
      </div>

      <Card title="Filter matrix — today's 6 candidates" right={<span className="text-xs text-muted">hover a chip for details</span>}>
        <FilterMatrix candidates={ordered} filters={filters} regime={s?.regime} positions={positions} />
      </Card>

      <div className="grid gap-5 xl:grid-cols-5">
        <Card title="Open positions (live P&L)" className="xl:col-span-3">
          {positions.length ? (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Stock</th><th>Side</th><th>Qty</th><th className="text-right">Entry</th><th className="text-right">LTP</th><th className="text-right">SL</th><th className="text-right">P&L</th><th>Since</th></tr></thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p._id}>
                      <td className="font-semibold">{p.symbol}</td><td><SideBadge side={p.side} /></td><td className="num">{p.qty}</td>
                      <td className="num text-right">{num(p.entry_price)}</td><td className="num text-right">{num(live.ltp[p.symbol] ?? p.ltp)}</td>
                      <td className="num text-right text-muted">{num(p.sl)}</td>
                      <td className={`num text-right font-semibold ${pnlColor(p.unrealized)}`}>{signed(p.unrealized)}</td>
                      <td className="text-xs text-muted">{time(p.entry_time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty>No open positions</Empty>}
        </Card>
        <Card title="Intraday P&L" className="xl:col-span-2">
          {pnlQ.data?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={pnlQ.data.map((x) => ({ t: time(x.ts).slice(0, 5), v: x.total }))}>
                <XAxis dataKey="t" tick={{ fill: '#8a96ad', fontSize: 11 }} stroke="#243049" />
                <YAxis tick={{ fill: '#8a96ad', fontSize: 11 }} stroke="#243049" width={60} />
                <Tooltip contentStyle={{ background: '#182033', border: '1px solid #243049', borderRadius: 8 }} />
                <Area dataKey="v" name="P&L" stroke="#3b82f6" fill="#3b82f633" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <Empty>P&L curve appears during market hours</Empty>}
        </Card>
      </div>

      <Card title="Live event log">
        {logs.length ? (
          <ul className="space-y-1.5 text-sm max-h-72 overflow-y-auto">
            {logs.map((l, i) => (
              <li key={i} className="flex gap-3">
                <span className="num text-xs text-muted w-16 shrink-0">{time(l.ts)}</span>
                <span className={`text-xs w-16 shrink-0 ${l.level === 'error' ? 'text-down' : l.level === 'warning' ? 'text-warn' : 'text-muted'}`}>{l.source}</span>
                <span>{l.message}</span>
              </li>
            ))}
          </ul>
        ) : <Empty>No events yet</Empty>}
      </Card>
    </div>
  )
}
