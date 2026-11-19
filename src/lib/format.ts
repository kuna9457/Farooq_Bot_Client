export const inr = (v?: number | null, dp = 2) =>
  v === undefined || v === null || Number.isNaN(v) ? '—'
    : '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp })

export const num = (v?: number | null, dp = 2) =>
  v === undefined || v === null || Number.isNaN(v) ? '—'
    : v.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp })

export const signed = (v?: number | null, dp = 2) =>
  v === undefined || v === null ? '—' : (v > 0 ? '+' : '') + num(v, dp)

export const pnlColor = (v?: number | null) =>
  !v ? 'text-muted' : v > 0 ? 'text-up' : 'text-down'

export const time = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' }) : '—'

export const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—'

export const crore = (v?: number | null) =>
  v === undefined || v === null ? '—' : `${(v / 100000).toLocaleString('en-IN', { maximumFractionDigits: 2 })}L Cr`
