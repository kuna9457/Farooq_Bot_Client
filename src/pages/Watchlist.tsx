import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Play, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Empty, ErrorBox, FilterChip, SideBadge } from '../components/ui'
import { api } from '../lib/api'
import type { FilterState, Position, Session, WatchItem } from '../lib/api'
import { num, time } from '../lib/format'
import { useLive } from '../lib/live'

export default function Watchlist() {
  const qc = useQueryClient()
  const live = useLive()
  const [text, setText] = useState('')
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [dq, setDq] = useState('')
  const [msg, setMsg] = useState<{ ok: string[]; bad: string[] } | null>(null)

  const listQ = useQuery({ queryKey: ['watchlist'], queryFn: () => api<WatchItem[]>('/watchlist') })
  const sessQ = useQuery({ queryKey: ['session'], queryFn: () => api<{ session: Session; filters: FilterState[] }>('/session'), refetchInterval: 30000 })
  const stQ = useQuery({ queryKey: ['status'], queryFn: () => api('/status'), refetchInterval: 15000 })
  const posQ = useQuery({ queryKey: ['positions'], queryFn: () => api<Position[]>('/positions?status=OPEN'), refetchInterval: 15000 })

  // symbol suggestions for the last word being typed
  const lastWord = text.split(/[\s,;]+/).pop() ?? ''
  useEffect(() => { const t = setTimeout(() => setDq(lastWord), 250); return () => clearTimeout(t) }, [lastWord])
  const sugQ = useQuery({
    queryKey: ['wl-search', dq], enabled: dq.length >= 2,
    queryFn: () => api<{ symbol: string }[]>(`/watchlist/search?q=${encodeURIComponent(dq)}`), staleTime: 60000,
  })

  const refresh = () => { qc.invalidateQueries({ queryKey: ['watchlist'] }); qc.invalidateQueries({ queryKey: ['session'] }) }
  const add = useMutation({
    mutationFn: async (v: { symbols: string[]; side: 'BUY' | 'SELL' }) => {
      const ok: string[] = [], bad: string[] = []
      for (const s of v.symbols) {
        try { await api('/watchlist', { method: 'POST', body: { symbol: s, side: v.side } }); ok.push(s) } catch (e) { bad.push(`${s}: ${(e as Error).message}`) }
      }
      return { ok, bad }
    },
    onSuccess: (r) => { setMsg(r); if (!r.bad.length) setText(''); refresh() },
  })
  const remove = useMutation({ mutationFn: (s: string) => api(`/watchlist/${encodeURIComponent(s)}`, { method: 'DELETE' }), onSuccess: refresh })
  const clear = useMutation({ mutationFn: () => api('/watchlist', { method: 'DELETE' }), onSuccess: refresh })
  const start = useMutation({ mutationFn: () => api('/engine/start', { method: 'POST' }), onSuccess: () => qc.invalidateQueries() })

  const items = listQ.data ?? []
  const s = live.session ?? sessQ.data?.session
  const filters = useMemo(() => {
    const m: Record<string, FilterState> = {}
    sessQ.data?.filters?.forEach((f) => (m[f.symbol] = f))
    return { ...m, ...live.filters }
  }, [sessQ.data, live.filters])
  const positions = live.positions ?? posQ.data ?? []
  const running = s?.regime === 'WATCHLIST'
  const screener = stQ.data && stQ.data.selection_mode !== 'watchlist'

  const submit = () => {
    const symbols = Array.from(new Set(text.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean)))
    if (symbols.length) { setMsg(null); add.mutate({ symbols, side }) }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Watchlist</h1>
          <p className="text-sm text-muted">
            Pick the stocks and the side to trade. The bot starts at 09:30 and runs the same F1 / F2 / F3 filters on this list — no screener, no Nifty-points rule.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            Bot: <b className={running ? 'text-up' : 'text-warn'}>{running ? `RUNNING since ${time(s?.started_at)}` : 'waiting for 09:30 start'}</b>
          </span>
          {!running && !screener && (
            <button className="btn" disabled={start.isPending} onClick={() => start.mutate()}><Play size={14} />Start now</button>
          )}
        </div>
      </div>
      <ErrorBox error={start.error || add.error || remove.error || clear.error} />
      {screener && (
        <div className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">
          Screener mode is active, so this watchlist is ignored. Switch to “Manual watchlist” under Settings → Stock selection.
        </div>
      )}

      <Card title="Add stocks">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label className="label">NSE symbol(s) — separate several with commas or spaces</label>
            <input className="input" list="wl-suggest" placeholder="e.g. RELIANCE, TCS, M&M" value={text} autoComplete="off"
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
            <datalist id="wl-suggest">
              {sugQ.data?.map((x) => <option key={x.symbol} value={text.slice(0, text.length - lastWord.length) + x.symbol} />)}
            </datalist>
          </div>
          <div>
            <label className="label">Trade as</label>
            <div className="flex overflow-hidden rounded-lg border border-line">
              {(['BUY', 'SELL'] as const).map((sd) => (
                <button key={sd} onClick={() => setSide(sd)}
                  className={`px-4 py-2 text-sm font-semibold ${side === sd ? (sd === 'BUY' ? 'bg-up/20 text-up' : 'bg-down/20 text-down') : 'text-muted hover:bg-panel2'}`}>{sd}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" disabled={add.isPending || !text.trim()} onClick={submit}><Plus size={14} />{add.isPending ? 'Adding…' : 'Add to watchlist'}</button>
        </div>
        {msg && (
          <div className="mt-3 space-y-1 text-sm">
            {msg.ok.length > 0 && <div className="text-up">Added: {msg.ok.join(', ')}</div>}
            {msg.bad.map((b) => <div key={b} className="text-down">{b}</div>)}
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Any NSE equity works. Adding a stock that is already listed just changes its side. Stocks added during the day start being checked immediately
          (entries only after the 09:30 start).
        </p>
      </Card>

      <Card title={`Today's watchlist · ${items.length} stock${items.length === 1 ? '' : 's'}`}
        right={items.length > 0 && <button className="btn btn-danger !py-1 text-xs" disabled={clear.isPending}
          onClick={() => confirm('Remove ALL stocks from the watchlist?') && clear.mutate()}><Trash2 size={12} />Clear all</button>}>
        {!items.length ? <Empty>No stocks yet. Add some above — the bot trades nothing until you do.</Empty> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Stock</th><th>Side</th><th>F1 · 5Y</th><th>F2 · 1D</th><th>F3 · 5m</th><th>Status</th><th className="text-right">LTP</th><th>Checked</th><th /></tr></thead>
              <tbody>
                {items.map((it) => {
                  const f = filters[it.symbol]
                  const inTrade = positions.find((p) => p.symbol === it.symbol && p.status === 'OPEN')
                  const status = inTrade ? 'IN TRADE' : !running ? 'Waiting for start' : !f ? 'Not evaluated yet'
                    : f.all_passed ? 'ALL PASS' : `Waiting ${(['F1', 'F2', 'F3'] as const).filter((k) => !f[k]?.passed).join(', ')}`
                  return (
                    <tr key={it.symbol}>
                      <td>
                        <Link className="font-semibold hover:text-accent" to={`/chart?symbol=${encodeURIComponent(it.symbol)}&side=${it.side}`}>{it.symbol}</Link>
                        {it.name && <div className="text-[11px] text-muted truncate max-w-40">{it.name}</div>}
                      </td>
                      <td>
                        <button title="Click to switch side" disabled={add.isPending} onClick={() => add.mutate({ symbols: [it.symbol], side: it.side === 'BUY' ? 'SELL' : 'BUY' })}>
                          <SideBadge side={it.side} />
                        </button>
                      </td>
                      <td><FilterChip label="F1" f={f?.F1} /></td>
                      <td><FilterChip label="F2" f={f?.F2} /></td>
                      <td><FilterChip label="F3" f={f?.F3} /></td>
                      <td className={`text-xs font-semibold ${inTrade ? 'text-accent' : f?.all_passed ? 'text-up' : 'text-muted'}`}>{status}</td>
                      <td className="num text-right">{num(live.ltp[it.symbol] ?? f?.price)}</td>
                      <td className="text-xs text-muted">{time(f?.evaluated_at)}</td>
                      <td className="text-right">
                        <button className="text-muted hover:text-down" title="Remove" disabled={remove.isPending}
                          onClick={() => confirm(inTrade ? `${it.symbol} has an open position. Remove it from the watchlist anyway? (the position is still managed and exited by the bot)` : `Remove ${it.symbol}?`) && remove.mutate(it.symbol)}>
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
