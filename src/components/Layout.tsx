import clsx from 'clsx'
import { Activity, BarChart3, FlaskConical, History, LayoutDashboard, LogOut, Menu, PlugZap, ScrollText, Settings, Wallet, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, setToken } from '../lib/api'
import { disconnectLive, useLive } from '../lib/live'
import { num, signed } from '../lib/format'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/scanner', label: 'Scanner & Filters', icon: Activity },
  { to: '/chart', label: 'Charts', icon: BarChart3 },
  { to: '/positions', label: 'Positions & Orders', icon: Wallet },
  { to: '/trades', label: 'Trade History', icon: History },
  { to: '/backtest', label: 'Backtest', icon: FlaskConical },
  { to: '/broker', label: 'Broker', icon: PlugZap },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/logs', label: 'Logs', icon: ScrollText },
]

export default function Layout() {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const connected = useLive((s) => s.connected)
  const ltp = useLive((s) => s.ltp)
  const { data: status } = useQuery({ queryKey: ['status'], queryFn: () => api('/status'), refetchInterval: 15000 })
  const { data: sess } = useQuery({ queryKey: ['session'], queryFn: () => api('/session'), refetchInterval: 30000 })
  const s = sess?.session
  const nifty = ltp['NIFTY50'] ?? s?.nifty_price
  const niftyChg = nifty && s?.nifty_prev_close ? nifty - s.nifty_prev_close : s?.nifty_change
  const mode = status?.runtime?.mode

  const logout = () => { setToken(null); disconnectLive(); nav('/login') }

  return (
    <div className="flex h-full">
      {/* sidebar */}
      <aside className={clsx('fixed inset-y-0 left-0 z-40 w-60 border-r border-line bg-panel transition-transform lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="WelthWest" className="h-9 w-9" />
            <div>
              <div className="font-bold tracking-tight leading-tight">WelthWest Algo</div>
              <div className="text-xs text-muted">Nifty 50 · HA 3-Filter</div>
            </div>
          </div>
          <button className="lg:hidden text-muted" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <nav className="p-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
              className={({ isActive }) => clsx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
                isActive ? 'bg-accent/15 text-white' : 'text-muted hover:bg-panel2 hover:text-text')}>
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 inset-x-0 p-3 border-t border-line">
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-panel2 hover:text-text">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur">
          <button className="lg:hidden text-muted" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <span className="flex items-center gap-2 text-xs">
            <span className={clsx('h-2 w-2 rounded-full', connected ? 'bg-up animate-pulse' : 'bg-down')} />
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
          <span className="text-xs text-muted">Market: <b className={status?.market_open ? 'text-up' : 'text-muted'}>{status?.market_open ? 'OPEN' : 'CLOSED'}</b></span>
          <span className="text-xs">Mode: <b className={mode === 'live' ? 'text-down' : 'text-warn'}>{mode?.toUpperCase() ?? '—'}</b></span>
          <span className="text-xs text-muted">Data: <b className="text-text">{status?.data_provider ?? '—'}</b></span>
          <span className="text-xs">NIFTY <b className="num">{num(nifty)}</b>{' '}
            <span className={clsx('num', (niftyChg ?? 0) >= 0 ? 'text-up' : 'text-down')}>({signed(niftyChg)})</span></span>
          <span className="text-xs">Regime:{' '}
            <b className={s?.regime === 'BUY' ? 'text-up' : s?.regime === 'SELL' ? 'text-down' : 'text-warn'}>{s?.regime ?? 'pending'}</b></span>
          {status?.mock_db && <span className="text-xs text-warn">⚠ in-memory DB (Mongo down)</span>}
          {status?.runtime?.halted_date && <span className="text-xs text-down font-semibold">HALTED TODAY</span>}
        </header>
        <main className="flex-1 overflow-x-hidden p-4 lg:p-6">
          <Outlet />
        </main>
        <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-line px-4 py-3 text-xs text-muted">
          <img src="/logo.png" alt="" className="h-5 w-5" />
          <span>© {new Date().getFullYear()} <b className="text-text">WelthWest</b> · WelthWest Algo. Trading involves risk.</span>
        </footer>
      </div>
    </div>
  )
}
