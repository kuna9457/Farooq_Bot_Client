import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Card, Empty, ErrorBox, SideBadge } from '../components/ui'
import { api } from '../lib/api'
import type { Position } from '../lib/api'
import { num, pnlColor, signed, time } from '../lib/format'
import { useLive } from '../lib/live'

export default function Positions() {
  const qc = useQueryClient()
  const version = useLive((s) => s.version)
  const ltp = useLive((s) => s.ltp)
  const open = useQuery({ queryKey: ['positions'], queryFn: () => api<Position[]>('/positions?status=OPEN'), refetchInterval: 10000 })
  const closed = useQuery({ queryKey: ['positions-closed'], queryFn: () => api<Position[]>('/positions?status=CLOSED') })
  const orders = useQuery({ queryKey: ['orders'], queryFn: () => api<any[]>('/orders') })
  const rt = useQuery({ queryKey: ['runtime'], queryFn: () => api('/settings/runtime') })
  const brokerPos = useQuery({
    queryKey: ['broker-positions', rt.data?.broker], enabled: rt.data?.mode === 'live',
    queryFn: () => api<any[]>(`/broker/${rt.data.broker}/positions`),
  })
  useEffect(() => { qc.invalidateQueries({ queryKey: ['positions'] }); qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['positions-closed'] }) }, [version, qc])

  const exit = useMutation({ mutationFn: (id: string) => api(`/positions/${id}/exit`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries() })
  const sq = useMutation({ mutationFn: () => api('/engine/square-off', { method: 'POST' }), onSuccess: () => qc.invalidateQueries() })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Positions & Orders</h1>
        <button className="btn btn-danger" disabled={!open.data?.length || sq.isPending} onClick={() => confirm('Square off all open positions?') && sq.mutate()}>Square off all</button>
      </div>
      <ErrorBox error={exit.error || sq.error} />
      <Card title="Open positions">
        {open.data?.length ? (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Stock</th><th>Side</th><th>Qty</th><th className="text-right">Entry</th><th className="text-right">LTP</th><th className="text-right">SL</th><th className="text-right">Target</th><th className="text-right">Unrealized</th><th>Mode</th><th>Entry time</th><th /></tr></thead>
            <tbody>{open.data.map((p) => (
              <tr key={p._id}>
                <td className="font-semibold">{p.symbol}</td><td><SideBadge side={p.side} /></td><td className="num">{p.qty}</td>
                <td className="num text-right">{num(p.entry_price)}</td><td className="num text-right">{num(ltp[p.symbol] ?? p.ltp)}</td>
                <td className="num text-right">{num(p.sl)}</td><td className="num text-right">{num(p.target)}</td>
                <td className={`num text-right font-semibold ${pnlColor(p.unrealized)}`}>{signed(p.unrealized)}</td>
                <td className="text-xs">{p.mode}/{p.broker}</td><td className="text-xs text-muted">{time(p.entry_time)}</td>
                <td><button className="btn !py-1 text-xs" disabled={exit.isPending} onClick={() => confirm(`Exit ${p.symbol} at market?`) && exit.mutate(p._id)}>Exit</button></td>
              </tr>))}
            </tbody></table></div>
        ) : <Empty>No open positions</Empty>}
      </Card>
      <Card title="Closed today">
        {closed.data?.length ? (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Stock</th><th>Side</th><th>Qty</th><th className="text-right">Entry</th><th className="text-right">Exit</th><th>Reason</th><th>Exit time</th></tr></thead>
            <tbody>{closed.data.map((p) => (
              <tr key={p._id}><td className="font-semibold">{p.symbol}</td><td><SideBadge side={p.side} /></td><td className="num">{p.qty}</td>
                <td className="num text-right">{num(p.entry_price)}</td><td className="num text-right">{num(p.exit_price)}</td>
                <td className="text-xs">{p.exit_reason}</td><td className="text-xs text-muted">{time((p as any).exit_time)}</td></tr>))}
            </tbody></table></div>
        ) : <Empty>Nothing closed today</Empty>}
      </Card>
      <Card title="Order book (today)">
        {orders.data?.length ? (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Time</th><th>Stock</th><th>Side</th><th>Purpose</th><th>Qty</th><th className="text-right">Avg price</th><th>Status</th><th>Order ID</th><th>Broker</th></tr></thead>
            <tbody>{orders.data.map((o) => (
              <tr key={o._id}><td className="text-xs text-muted">{time(o.ts)}</td><td className="font-semibold">{o.symbol}</td><td><SideBadge side={o.side} /></td>
                <td className="text-xs">{o.purpose}</td><td className="num">{o.qty}</td><td className="num text-right">{num(o.avg_price)}</td>
                <td className="text-xs">{o.status}</td><td className="text-xs text-muted">{o.order_id}</td><td className="text-xs">{o.mode}/{o.broker}</td></tr>))}
            </tbody></table></div>
        ) : <Empty>No orders today</Empty>}
      </Card>
      {rt.data?.mode === 'live' && (
        <Card title={`Broker positions (${rt.data.broker}, raw)`}>
          <ErrorBox error={brokerPos.error} />
          <pre className="text-xs overflow-x-auto max-h-80">{JSON.stringify(brokerPos.data ?? [], null, 2)}</pre>
        </Card>
      )}
    </div>
  )
}
