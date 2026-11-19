import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Card, Empty, FilterChip, SideBadge } from '../components/ui'
import { api } from '../lib/api'
import type { Candidate, FilterState, Session } from '../lib/api'
import { crore, num, signed, time } from '../lib/format'
import { useLive } from '../lib/live'

export default function Scanner() {
  const [date, setDate] = useState('')
  const live = useLive()
  const q = useQuery({ queryKey: ['session', date], queryFn: () => api<{ session: Session; filters: FilterState[] }>(`/session${date ? `?date=${date}` : ''}`) })
  const days = useQuery({ queryKey: ['sessions'], queryFn: () => api<any[]>('/sessions') })
  const s = q.data?.session
  const filters = useMemo(() => {
    const m: Record<string, FilterState> = {}
    q.data?.filters?.forEach((f) => (m[f.symbol] = f))
    return date ? m : { ...m, ...live.filters }
  }, [q.data, live.filters, date])
  const [sel, setSel] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Scanner & Filters</h1>
          <p className="text-sm text-muted">08:30 scan → 09:30 regime → continuous F1 / F2 / F3 checks</p>
        </div>
        <div>
          <label className="label">Session</label>
          <select className="input" value={date} onChange={(e) => setDate(e.target.value)}>
            <option value="">Today</option>
            {days.data?.map((d) => <option key={d.date} value={d.date}>{d.date} · {d.regime ?? '—'}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><div className="text-xs text-muted">Universe scanned</div><div className="num text-lg font-semibold">{s?.scan_universe_size ?? '—'}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">Nifty at decision</div><div className="num text-lg font-semibold">{num(s?.nifty_price)} <span className="text-sm">({signed(s?.nifty_change)})</span></div></div>
        <div className="card p-4"><div className="text-xs text-muted">Regime</div><div className="mt-1"><SideBadge side={s?.regime} /> <span className="text-xs text-muted ml-2">{s?.regime_rule} ±{s?.regime_threshold}</span></div></div>
      </div>

      {(['BUY', 'SELL'] as const).map((side) => {
        const list: Candidate[] = side === 'BUY' ? s?.buy_candidates ?? [] : s?.sell_candidates ?? []
        return (
          <Card key={side} title={<span className="flex items-center gap-2"><SideBadge side={side} /> {side === 'BUY' ? 'New month HIGH' : 'New month LOW'} · top {list.length} by market cap
            {s?.regime && <span className="text-xs text-muted font-normal">{s.regime === side ? '(active today)' : '(inactive today)'}</span>}</span>}>
            {!list.length ? <Empty>No stocks qualified</Empty> : (
              <div className="space-y-3">
                {list.map((c) => {
                  const f = filters[c.symbol]
                  const open = sel === c.symbol
                  return (
                    <div key={c.symbol} className="rounded-lg border border-line bg-panel2/40">
                      <button className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left" onClick={() => setSel(open ? null : c.symbol)}>
                        <span className="w-28 font-semibold">#{c.rank} {c.symbol}</span>
                        <span className="text-xs text-muted w-28">{crore(c.market_cap_cr)}</span>
                        <span className="text-xs text-muted w-48">{side === 'BUY' ? `month high ${num(c.month_high_level)}` : `month low ${num(c.month_low_level)}`} · close {num(c.last_close)}</span>
                        <span className="flex gap-2"><FilterChip label="F1" f={f?.F1} /><FilterChip label="F2" f={f?.F2} /><FilterChip label="F3" f={f?.F3} /></span>
                        <span className={`text-xs font-semibold ${f?.all_passed ? 'text-up' : 'text-muted'}`}>{f ? (f.all_passed ? 'ALL PASS → entry' : 'not all passing') : 'not evaluated'}</span>
                        <span className="ml-auto text-xs text-muted">{time(f?.evaluated_at)}</span>
                      </button>
                      {open && f && <FilterDetail f={f} date={date} />}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function FilterDetail({ f, date }: { f: FilterState; date: string }) {
  const hist = useQuery({ queryKey: ['fh', f.symbol, date], queryFn: () => api<any[]>(`/filter-history?symbol=${f.symbol}${date ? `&date=${date}` : ''}`) })
  return (
    <div className="border-t border-line px-4 py-3 space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        {(['F1', 'F2', 'F3'] as const).map((k) => (
          <div key={k} className="rounded-lg border border-line p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">{k === 'F1' ? 'F1 · 5Y anchored VP' : k === 'F2' ? 'F2 · Daily CE + Ribbon breakout' : 'F3 · 5m CE + prev-day POC'}</span>
              <FilterChip label={f[k]?.status ?? 'PENDING'} f={f[k]} />
            </div>
            <p className="text-xs text-muted mb-2">{f[k]?.reason}</p>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {Object.entries(f[k]?.values ?? {}).map(([a, b]) => (
                <div key={a} className="contents"><dt className="text-muted">{a}</dt><dd className="num text-right">{String(b ?? '—')}</dd></div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <div>
        <div className="text-xs text-muted mb-2">Filter timeline today</div>
        <div className="flex flex-wrap gap-1">
          {hist.data?.map((h, i) => (
            <span key={i} title={`${time(h.ts)} F1 ${h.F1} · F2 ${h.F2} · F3 ${h.F3}`} className="flex flex-col gap-0.5">
              {(['F1', 'F2', 'F3'] as const).map((k) => (
                <span key={k} className={`h-2 w-3 rounded-sm ${h[k] === 'PASS' || h[k] === 'DISABLED' ? 'bg-up' : h[k] === 'FAIL' ? 'bg-down' : 'bg-slate-500'}`} />
              ))}
            </span>
          ))}
          {!hist.data?.length && <span className="text-xs text-muted">No history yet</span>}
        </div>
      </div>
    </div>
  )
}
