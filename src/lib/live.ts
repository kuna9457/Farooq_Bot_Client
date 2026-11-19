/** Live WebSocket store (ticks, P&L, filter updates, logs). */
import { create } from 'zustand'
import { getToken, wsUrl } from './api'
import type { DayPnl, FilterState, LogItem, Position, Session } from './api'

interface LiveState {
  connected: boolean
  ltp: Record<string, number>
  pnl: DayPnl | null
  positions: Position[] | null
  filters: Record<string, FilterState>
  session: Session | null
  logs: LogItem[]
  lastMsgAt: number
  version: number            // bumps on any trade/position/backtest event -> pages refetch
  backtest: Record<string, { progress?: number; message?: string; status?: string }>
}

export const useLive = create<LiveState>(() => ({
  connected: false, ltp: {}, pnl: null, positions: null, filters: {}, session: null, logs: [], lastMsgAt: 0,
  version: 0, backtest: {},
}))

let ws: WebSocket | null = null
let timer: number | undefined

export function connectLive() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
  const token = getToken()
  if (!token) return
  ws = new WebSocket(wsUrl(token))
  ws.onopen = () => {
    useLive.setState({ connected: true })
    window.clearInterval(timer)
    timer = window.setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send('ping'), 20000)
  }
  ws.onclose = () => {
    useLive.setState({ connected: false })
    window.clearInterval(timer)
    setTimeout(connectLive, 3000)
  }
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    const s = useLive.getState()
    const patch: Partial<LiveState> = { lastMsgAt: Date.now() }
    switch (msg.type) {
      case 'tick':
        patch.ltp = { ...s.ltp, ...msg.data.ltp }
        patch.pnl = msg.data.pnl
        patch.positions = msg.data.positions
        break
      case 'filter_update':
        patch.filters = { ...s.filters, [msg.data.symbol]: msg.data }
        break
      case 'session':
        patch.session = msg.data
        patch.version = s.version + 1
        break
      case 'log':
        patch.logs = [msg.data, ...s.logs].slice(0, 200)
        break
      case 'position_update':
      case 'trade':
      case 'regime_decided':
        patch.version = s.version + 1
        break
      case 'backtest_progress':
        patch.backtest = { ...s.backtest, [msg.data.run_id]: msg.data }
        if (msg.data.status) patch.version = s.version + 1
        break
    }
    useLive.setState(patch)
  }
}

export function disconnectLive() {
  ws?.close()
  ws = null
}
