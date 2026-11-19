import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, Empty, SideBadge, Stat } from '../components/ui'
import { api } from '../lib/api'
import type { Trade } from '../lib/api'
import { dateTime, inr, num, pnlColor, signed } from '../lib/format'

export default function Trades() {
  const [f, setF] = useState({ from: '', to: '', mode: '', symbol: '' })
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString()
  const q = useQuery({ queryKey: ['trades', qs], queryFn: () => api<Trade[]>(`/trades?${qs}`) })
  const daily = useQuery({ queryKey: ['pnl-daily', f.mode], queryFn: () => api<any[]>(`/pnl/daily${f.mode ? `?mode=${f.mode}` : ''}`) })
  const t = q.data ?? []
  const net = t.reduce((a, x) => a + x.net_pnl, 0)
  const wins = t.filter((x) => x.net_pnl > 0).length

  const csv = () => {
    const cols = ['date', 'symbol', 'side', 'qty', 'entry_price', 'entry_time', 'exit_price', 'exit_time', 'gross_pnl', 'charges', 'net_pnl', 'exit_reason', 'mode', 'broker'] as const
    const body = [cols.join(','), ...t.map((r) => cols.map((c) => JSON.stringify((r as any)[c] ?? '')).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' }))
    a.download = 'trades.csv'
    a.click()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="text-xl font-bold mr-auto">Trade History</h1>
        <div><label className="label">From</label><input type="date" className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
        <div><label className="label">To</label><input type="date" className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
        <div><label className="label">Mode</label><select className="input" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option value="">All</option><option value="paper">Paper</option><option value="live">Live</option></select></div>
        <div><label className="label">Symbol</label><input className="input w-28 uppercase" value={f.symbol} onChange={(e) => setF({ ...f, symbol: e.target.value })} /></div>
        <button className="btn" onClick={csv} disabled={!t.length}>Export CSV</button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Trades" value={t.length} />
        <Stat label="Net P&L" value={inr(net)} tone={pnlColor(net)} />
        <Stat label="Win rate" value={t.length ? `${((100 * wins) / t.length).toFixed(1)}%` : '—'} />
        <Stat label="Charges paid" value={inr(t.reduce((a, x) => a + x.charges, 0))} />
      </div>
      <Card title="Daily P&L">
        {daily.data?.length ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={daily.data}>
              <XAxis dataKey="date" tick={{ fill: '#8a96ad', fontSize: 11 }} stroke="#243049" />
              <YAxis tick={{ fill: '#8a96ad', fontSize: 11 }} stroke="#243049" width={60} />
              <Tooltip contentStyle={{ background: '#182033', border: '1px solid #243049', borderRadius: 8 }} cursor={{ fill: '#ffffff08' }} />
              <Bar dataKey="net_pnl" name="Net P&L">{daily.data.map((d, i) => <Cell key={i} fill={d.net_pnl >= 0 ? '#16a34a' : '#dc2626'} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <Empty>No closed trades yet</Empty>}
      </Card>
      <Card title="Trades">
        {t.length ? (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Date</th><th>Stock</th><th>Side</th><th>Qty</th><th className="text-right">Entry</th><th className="text-right">Exit</th><th className="text-right">Gross</th><th className="text-right">Charges</th><th className="text-right">Net</th><th>Exit reason</th><th>Entry → Exit</th><th>Mode</th></tr></thead>
            <tbody>{t.map((x, i) => (
              <tr key={x._id ?? i}><td className="text-xs">{x.date}</td><td className="font-semibold">{x.symbol}</td><td><SideBadge side={x.side} /></td><td className="num">{x.qty}</td>
                <td className="num text-right">{num(x.entry_price)}</td><td className="num text-right">{num(x.exit_price)}</td>
                <td className={`num text-right ${pnlColor(x.gross_pnl)}`}>{signed(x.gross_pnl)}</td><td className="num text-right text-muted">{num(x.charges)}</td>
                <td className={`num text-right font-semibold ${pnlColor(x.net_pnl)}`}>{signed(x.net_pnl)}</td><td className="text-xs">{x.exit_reason}</td>
                <td className="text-xs text-muted">{dateTime(x.entry_time)} → {dateTime(x.exit_time).split(', ').pop()}</td><td className="text-xs">{x.mode}</td></tr>))}
            </tbody></table></div>
        ) : <Empty>No trades match the filter</Empty>}
      </Card>
    </div>
  )
}
