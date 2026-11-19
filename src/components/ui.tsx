import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { FilterRes, Status } from '../lib/api'

export function Card({ title, right, children, className }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('card', className)}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-line">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          <div className="flex items-center gap-2">{right}</div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={clsx('num text-xl font-semibold mt-1', tone)}>{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  )
}

const STATUS_STYLE: Record<Status, string> = {
  PASS: 'bg-up/15 text-up border-up/40',
  FAIL: 'bg-down/15 text-down border-down/40',
  PENDING: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
  ERROR: 'bg-warn/15 text-warn border-warn/40',
  DISABLED: 'bg-slate-700/30 text-slate-400 border-slate-600/40',
}
const DOT: Record<Status, string> = { PASS: 'bg-up', FAIL: 'bg-down', PENDING: 'bg-slate-400', ERROR: 'bg-warn', DISABLED: 'bg-slate-500' }

export function FilterChip({ f, label }: { f?: FilterRes; label: string }) {
  const st: Status = f?.status ?? 'PENDING'
  return (
    <span className="group relative inline-flex">
      <span className={clsx('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold', STATUS_STYLE[st])}>
        <span className={clsx('h-2 w-2 rounded-full', DOT[st])} />
        {label}
      </span>
      {f?.reason && (
        <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-80 -translate-x-1/2 rounded-lg border border-line bg-panel2 p-3 text-xs text-text shadow-xl group-hover:block whitespace-normal">
          <b className="block mb-1">{label}: {st}</b>
          {f.reason}
        </span>
      )}
    </span>
  )
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'up' | 'down' | 'warn' | 'slate' | 'accent' }) {
  const m = {
    up: 'bg-up/15 text-up border-up/40', down: 'bg-down/15 text-down border-down/40',
    warn: 'bg-warn/15 text-warn border-warn/40', slate: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    accent: 'bg-accent/15 text-accent border-accent/40',
  }[tone]
  return <span className={clsx('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold', m)}>{children}</span>
}

export function SideBadge({ side }: { side?: string }) {
  if (!side) return <Badge>—</Badge>
  if (side === 'NO_TRADE') return <Badge tone="warn">NO TRADE</Badge>
  return <Badge tone={side === 'BUY' ? 'up' : 'down'}>{side}</Badge>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-8 text-center text-sm text-muted">{children}</div>
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null
  return <div className="rounded-lg border border-down/40 bg-down/10 px-3 py-2 text-sm text-red-300">{String((error as Error).message ?? error)}</div>
}
