import clsx from 'clsx'
import { Link } from 'react-router-dom'
import type { Candidate, FilterState, Position } from '../lib/api'
import { crore, num, time } from '../lib/format'
import { useLive } from '../lib/live'
import { Empty, FilterChip, SideBadge } from './ui'

export default function FilterMatrix({ candidates, filters, regime, positions }: {
  candidates: Candidate[]; filters: Record<string, FilterState>; regime?: string; positions: Position[]
}) {
  const ltp = useLive((s) => s.ltp)
  if (!candidates.length) return <Empty>No candidates yet — run the pre-market scan.</Empty>
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>Stock</th><th>Side</th><th>Rank</th><th>M.Cap</th>
            <th>F1 · 5Y</th><th>F2 · 1D</th><th>F3 · 5m</th><th>Status</th><th className="text-right">LTP</th><th>Checked</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => {
            const f = filters[c.symbol]
            const active = regime === c.side
            const inTrade = positions.find((p) => p.symbol === c.symbol && p.status === 'OPEN')
            const status = inTrade ? 'IN TRADE' : !regime ? 'Waiting 09:30 regime' : !active ? 'Inactive today'
              : !f ? 'Not evaluated' : f.all_passed ? 'ALL PASS' : waitingOn(f)
            return (
              <tr key={c.symbol + c.side} className={clsx(!active && regime && 'opacity-45')}>
                <td>
                  <Link className="font-semibold hover:text-accent" to={`/chart?symbol=${c.symbol}&side=${c.side}`}>{c.symbol}</Link>
                  <div className="text-[11px] text-muted truncate max-w-40">{c.name}</div>
                </td>
                <td><SideBadge side={c.side} /></td>
                <td className="num">#{c.rank}</td>
                <td className="num text-muted">{crore(c.market_cap_cr)}</td>
                <td><FilterChip label="F1" f={f?.F1} /></td>
                <td><FilterChip label="F2" f={f?.F2} /></td>
                <td><FilterChip label="F3" f={f?.F3} /></td>
                <td className={clsx('text-xs font-semibold', inTrade ? 'text-accent' : f?.all_passed ? 'text-up' : 'text-muted')}>{status}</td>
                <td className="num text-right">{num(ltp[c.symbol] ?? f?.price)}</td>
                <td className="text-xs text-muted">{time(f?.evaluated_at)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function waitingOn(f: FilterState) {
  const failed = (['F1', 'F2', 'F3'] as const).filter((k) => !f[k]?.passed)
  return `Waiting ${failed.join(', ')}`
}
