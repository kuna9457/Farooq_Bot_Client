import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { getToken } from './lib/api'
import { connectLive } from './lib/live'
import Backtest from './pages/Backtest'
import Broker from './pages/Broker'
import Charts from './pages/Charts'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Logs from './pages/Logs'
import Positions from './pages/Positions'
import Scanner from './pages/Scanner'
import Settings from './pages/Settings'
import Trades from './pages/Trades'

function Protected() {
  useEffect(() => { connectLive() }, [])
  return getToken() ? <Layout /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/chart" element={<Charts />} />
        <Route path="/positions" element={<Positions />} />
        <Route path="/trades" element={<Trades />} />
        <Route path="/backtest" element={<Backtest />} />
        <Route path="/broker" element={<Broker />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/logs" element={<Logs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
