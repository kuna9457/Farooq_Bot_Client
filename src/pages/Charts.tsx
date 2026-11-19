import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useSearchParams } from 'react-router-dom'
import PriceChart from '../components/PriceChart'
import type { ChartData } from '../components/PriceChart'
import { Card, ErrorBox } from '../components/ui'
import { api } from '../lib/api'
import type { Session } from '../lib/api'

const TFS = [
  { tf: '1W', label: 'F1 · 5Y (weekly)', note: 'Heikin-Ashi + Chandelier Exit; dashed lines = anchored volume profile (from last CE signal) VAH / VAL / POC' },
  { tf: '1D', label: 'F2 · Daily', note: 'Heikin-Ashi + Chandelier Exit + MA ribbon; purple line = setup candle trigger (its high/low)' },
  { tf: '5m', label: 'F3 · 5 min', note: 'Heikin-Ashi + Chandelier Exit; dashed lines = previous-day fixed range volume profile POC / VAH / VAL' },
]

export default function Charts() {
  const [sp, setSp] = useSearchParams()
  const sess = useQuery({ queryKey: ['session'], queryFn: () => api<{ session: Session }>('/session') })
  const cands = [...(sess.data?.session?.buy_candidates ?? []), ...(sess.data?.session?.sell_candidates ?? [])]
  const symbol = sp.get('symbol') || cands[0]?.symbol || 'RELIANCE'
  const side = sp.get('side') || cands.find((c) => c.symbol === symbol)?.side || 'BUY'
  const tf = sp.get('tf') || '5m'
  const q = useQuery({ queryKey: ['chart', symbol, tf, side], queryFn: () => api<ChartData>(`/chart/${encodeURIComponent(symbol)}?tf=${tf}&side=${side}`) })
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); n.set(k, v); setSp(n) }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-bold">Charts</h1>
          <p className="text-sm text-muted">What each filter sees — Heikin-Ashi candles, as in TradingView</p>
        </div>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <div>
            <label className="label">Stock</label>
            <div className="flex gap-1">
              {cands.map((c) => (
                <button key={c.symbol} onClick={() => { const n = new URLSearchParams(sp); n.set('symbol', c.symbol); n.set('side', c.side); setSp(n) }}
                  className={clsx('btn !py-1 !px-2 text-xs', c.symbol === symbol && (c.side === 'BUY' ? '!border-up !text-up' : '!border-down !text-down'))}>{c.symbol}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Other symbol</label>
            <input className="input w-32 uppercase" defaultValue="" placeholder="e.g. INFY" onKeyDown={(e) => e.key === 'Enter' && set('symbol', (e.target as HTMLInputElement).value.toUpperCase())} />
          </div>
          <div>
            <label className="label">Side rules</label>
            <select className="input" value={side} onChange={(e) => set('side', e.target.value)}>
              <option>BUY</option><option>SELL</option>
            </select>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {TFS.map((t) => (
          <button key={t.tf} onClick={() => set('tf', t.tf)} className={clsx('btn', tf === t.tf && 'btn-primary')}>{t.label}</button>
        ))}
      </div>
      <Card title={`${symbol} · ${TFS.find((t) => t.tf === tf)?.label} · ${side} rules`} right={q.isFetching && <span className="text-xs text-muted">loading…</span>}>
        <p className="text-xs text-muted mb-3">{TFS.find((t) => t.tf === tf)?.note}</p>
        <ErrorBox error={q.error} />
        {q.data && <PriceChart data={q.data} height={500} />}
        {q.data?.levels?.length ? (
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            {q.data.levels.map((l) => <span key={l.title}><span className="inline-block h-0.5 w-4 align-middle mr-1" style={{ background: l.color }} />{l.title}: <b className="num">{l.price}</b></span>)}
          </div>
        ) : null}
      </Card>
    </div>
  )
}
