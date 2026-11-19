import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Card, ErrorBox } from '../components/ui'
import { api } from '../lib/api'
import { dateTime, inr } from '../lib/format'

export default function Broker() {
  const qc = useQueryClient()
  const [sp] = useSearchParams()
  const st = useQuery({ queryKey: ['broker-status'], queryFn: () => api('/broker/status') })
  const acc = useQuery({ queryKey: ['account'], queryFn: () => api('/account/summary') })
  const rt = useQuery({ queryKey: ['runtime'], queryFn: () => api('/settings/runtime') })
  const [tok, setTok] = useState<Record<string, string>>({})

  const login = useMutation({ mutationFn: async (b: string) => { const r = await api<{ url: string }>(`/broker/${b}/login-url`); location.href = r.url } })
  const save = useMutation({ mutationFn: (b: string) => api(`/broker/${b}/token`, { method: 'POST', body: { access_token: tok[b] ?? '' } }), onSuccess: () => qc.invalidateQueries() })
  const autoLogin = useMutation({ mutationFn: () => api('/broker/angel/auto-login', { method: 'POST' }), onSuccess: () => qc.invalidateQueries() })
  const [ang, setAng] = useState({ client_code: '', pin: '', secret: '', code: '', remember: true })
  const angelLogin = useMutation({
    mutationFn: () => api('/broker/angel/login', { method: 'POST', body: {
      client_code: ang.client_code, pin: ang.pin, totp_secret: ang.secret, totp: ang.code, remember: ang.remember } }),
    onSuccess: () => { setAng({ ...ang, pin: '', secret: '', code: '' }); qc.invalidateQueries() },
  })
  const forget = useMutation({ mutationFn: () => api('/broker/angel/forget', { method: 'POST' }), onSuccess: () => qc.invalidateQueries() })
  const logout = useMutation({ mutationFn: (b: string) => api(`/broker/${b}/logout`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries() })
  const setRt = useMutation({ mutationFn: (body: any) => api('/settings/runtime', { method: 'PUT', body }), onSuccess: () => qc.invalidateQueries() })

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Broker</h1>
      {sp.get('connected') && <div className="rounded-lg border border-up/40 bg-up/10 px-3 py-2 text-sm text-up">{sp.get('connected')} connected successfully.</div>}
      {sp.get('error') && <ErrorBox error={sp.get('error')} />}
      <ErrorBox error={login.error || save.error || setRt.error || autoLogin.error || angelLogin.error || forget.error} />

      <Card title="Trading mode">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="label">Current</div>
            <Badge tone={rt.data?.mode === 'live' ? 'down' : 'warn'}>{rt.data?.mode?.toUpperCase()}</Badge>{' '}
            {rt.data?.mode === 'live' && <span className="text-sm">via <b>{rt.data?.broker}</b></span>}
          </div>
          <div>
            <label className="label">Execution broker (for LIVE)</label>
            <select className="input" value={rt.data?.broker ?? 'angel'} onChange={(e) => setRt.mutate({ broker: e.target.value })}>
              <option value="angel">Angel One</option><option value="upstox">Upstox</option><option value="kite">Zerodha Kite</option>
            </select>
          </div>
          {rt.data?.mode === 'live'
            ? <button className="btn" onClick={() => setRt.mutate({ mode: 'paper' })}>Switch to PAPER</button>
            : <button className="btn btn-danger" onClick={() => confirm(`Switch to LIVE trading with ${rt.data?.broker}? Real orders will be placed.`) && setRt.mutate({ mode: 'live', confirm_live: true })}>Switch to LIVE</button>}
        </div>
        <p className="mt-3 text-xs text-muted">Paper mode simulates fills at live prices with slippage. Live mode places real MIS market orders on the selected broker. Brokers need a fresh login every morning (tokens expire daily).</p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {(['angel', 'upstox', 'kite'] as const).map((b) => {
          const s = st.data?.[b]
          const f = acc.data?.brokers?.[b]
          return (
            <Card key={b} title={b === 'angel' ? 'Angel One (primary: data + WebSocket + orders)' : b === 'upstox' ? 'Upstox (data + orders)' : 'Zerodha Kite (orders)'} right={<Badge tone={s?.connected ? 'up' : 'slate'}>{s?.connected ? 'CONNECTED' : 'NOT CONNECTED'}</Badge>}>
              <div className="space-y-3 text-sm">
                {!s?.api_key_configured && <p className="text-warn text-xs">API key not configured — set {b.toUpperCase()}_API_KEY{b === 'angel' ? '' : ' / _API_SECRET'} in the backend environment and restart.</p>}
                {b === 'angel' && s?.connected && <p className="text-xs">Live WebSocket feed: <b className={s?.websocket ? 'text-up' : 'text-muted'}>{s?.websocket ? 'connected' : 'not connected (REST fallback)'}</b></p>}
                {s?.connected && (
                  <dl className="grid grid-cols-2 gap-1 text-xs">
                    <dt className="text-muted">User</dt><dd>{s.user_name ?? '—'}</dd>
                    <dt className="text-muted">Connected</dt><dd>{dateTime(s.connected_at)}</dd>
                    <dt className="text-muted">Token expires</dt><dd>{dateTime(s.token_expiry)}</dd>
                    <dt className="text-muted">Balance</dt><dd className="num">{f?.error ? <span className="text-down">{f.error}</span> : inr(f?.total)}</dd>
                    <dt className="text-muted">Available</dt><dd className="num">{inr(f?.available)}</dd>
                    <dt className="text-muted">Used margin</dt><dd className="num">{inr(f?.used)}</dd>
                  </dl>
                )}
                <div className="flex flex-wrap gap-2">
                  {b === 'angel' && s?.auto_login && <button className="btn btn-primary" disabled={autoLogin.isPending} onClick={() => autoLogin.mutate()}>{autoLogin.isPending ? 'Logging in…' : `Login as ${s.saved_client_code}`}</button>}
                  {b === 'angel' && s?.auto_login && s?.creds_source === 'user' && <button className="btn" onClick={() => confirm('Remove the saved PIN and TOTP secret? Automatic daily login will stop.') && forget.mutate()}>Forget saved credentials</button>}
                  {b !== 'angel' && <button className="btn btn-primary" disabled={!s?.api_key_configured} onClick={() => login.mutate(b)}>Login with {b === 'upstox' ? 'Upstox' : 'Kite'}</button>}
                  {s?.connected && <button className="btn" onClick={() => logout.mutate(b)}>Disconnect</button>}
                </div>
                {b === 'angel' && (
                  <form className="space-y-2 rounded-lg border border-line p-3" autoComplete="off"
                    onSubmit={(e) => { e.preventDefault(); angelLogin.mutate() }}>
                    <div className="label">{s?.connected ? 'Log in again' : 'Log in with your Angel One account'}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input className="input" placeholder="Client code (e.g. A123456)" value={ang.client_code} onChange={(e) => setAng({ ...ang, client_code: e.target.value })} />
                      <input className="input" type="password" placeholder="PIN" autoComplete="new-password" value={ang.pin} onChange={(e) => setAng({ ...ang, pin: e.target.value })} />
                      <input className="input" type="password" placeholder="TOTP secret (for automatic daily login)" autoComplete="new-password" value={ang.secret} onChange={(e) => setAng({ ...ang, secret: e.target.value })} />
                      <input className="input" placeholder="…or 6-digit TOTP code" inputMode="numeric" maxLength={6} disabled={!!ang.secret} value={ang.code} onChange={(e) => setAng({ ...ang, code: e.target.value })} />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={ang.remember} disabled={!ang.secret} onChange={(e) => setAng({ ...ang, remember: e.target.checked })} />Remember PIN + TOTP secret (encrypted) so the bot logs in by itself every day</label>
                    <button className="btn btn-primary" disabled={angelLogin.isPending || !ang.client_code || !ang.pin || !(ang.secret || ang.code)}>{angelLogin.isPending ? 'Logging in…' : 'Login to Angel One'}</button>
                    <p className="text-[11px] text-muted">The TOTP secret is the text shown next to the QR code when you enable TOTP on Angel One. With only a 6-digit code you will have to log in again each morning.</p>
                  </form>
                )}
                <div>
                  <label className="label">…or paste an access token</label>
                  <div className="flex gap-2">
                    <input className="input" value={tok[b] ?? ''} onChange={(e) => setTok({ ...tok, [b]: e.target.value })} placeholder="access_token" />
                    <button className="btn" onClick={() => save.mutate(b)} disabled={!tok[b]}>Save</button>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
