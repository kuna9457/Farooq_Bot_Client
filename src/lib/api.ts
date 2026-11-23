export const TOKEN_KEY = 'fb_token'

// Backend base URL. Empty in local dev (Vite proxies /api and /ws). On Vercel set VITE_API_URL to the Render URL,
// e.g. https://welthwest-algo-api.onrender.com
export const API_BASE: string = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim().replace(/\/+$/, '')
export function wsUrl(token: string): string {
  const base = API_BASE || location.origin
  return `${base.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token)}`
}

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setToken(t: string | null) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, msg: string) { super(msg); this.status = status }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  if (res.status === 401) {
    setToken(null)
    if (!location.pathname.startsWith('/login')) location.href = '/login'
    throw new ApiError(401, 'Not authenticated')
  }
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const d = data?.detail
    throw new ApiError(res.status, typeof d === 'string' ? d : JSON.stringify(d ?? data))
  }
  return data as T
}

// ---------------------------------------------------------------- types
export type Status = 'PASS' | 'FAIL' | 'PENDING' | 'ERROR' | 'DISABLED'
export interface FilterRes { filter_id: string; status: Status; passed: boolean; reason: string; values: Record<string, any> }
export interface Candidate {
  symbol: string; name?: string; industry?: string; market_cap_cr?: number; rank?: number; side: 'BUY' | 'SELL'
  source?: 'watchlist'
  month_high?: boolean; month_low?: boolean; month_high_level?: number; month_low_level?: number; last_close?: number
}
export interface WatchItem { symbol: string; side: 'BUY' | 'SELL'; name?: string | null; added_at?: string }
export interface Session {
  date: string; regime?: 'BUY' | 'SELL' | 'NO_TRADE' | 'WATCHLIST'; mode?: 'watchlist'; started_at?: string
  nifty_change?: number; nifty_price?: number; nifty_prev_close?: number
  nifty_price_source?: string; regime_rule?: string; regime_threshold?: number
  buy_candidates: Candidate[]; sell_candidates: Candidate[]; scanned_at?: string; regime_at?: string
  month_high_count?: number; month_low_count?: number; scan_universe_size?: number
}
export interface FilterState {
  symbol: string; side: 'BUY' | 'SELL'; active: boolean; F1: FilterRes; F2: FilterRes; F3: FilterRes
  all_passed: boolean; price?: number; candle_time?: string; evaluated_at: string
  setup?: Record<string, any>; poc?: Record<string, any>
}
export interface Position {
  _id: string; symbol: string; side: 'BUY' | 'SELL'; qty: number; entry_price: number; entry_time: string
  ltp?: number; unrealized?: number; mode: string; broker: string; status: string
  exit_price?: number; exit_reason?: string
}
export interface Trade {
  _id?: string; date: string; symbol: string; side: string; qty: number; entry_price: number; entry_time: string
  exit_price: number; exit_time: string; gross_pnl: number; charges: number; net_pnl: number; exit_reason: string
  mode?: string; broker?: string; return_pct?: number
}
export interface DayPnl { realized: number; unrealized: number; total: number; trades: number; wins: number; mode: string }
export interface LogItem { _id?: string; ts: string; level: string; source: string; message: string }
