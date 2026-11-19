import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken } from '../lib/api'
import { connectLive } from '../lib/live'

export default function Login() {
  const nav = useNavigate()
  const [u, setU] = useState('admin')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const r = await api<{ token: string }>('/auth/login', { method: 'POST', body: { username: u, password: p } })
      setToken(r.token)
      connectLive()
      nav('/')
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-4">
        <div>
          <h1 className="text-lg font-bold">Farooq Trading Bot</h1>
          <p className="text-sm text-muted">Sign in to the dashboard</p>
        </div>
        <div><label className="label">Username</label><input className="input" value={u} onChange={(e) => setU(e.target.value)} /></div>
        <div><label className="label">Password</label><input className="input" type="password" value={p} onChange={(e) => setP(e.target.value)} autoFocus /></div>
        {err && <div className="text-sm text-down">{err}</div>}
        <button className="btn btn-primary w-full justify-center" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  )
}
