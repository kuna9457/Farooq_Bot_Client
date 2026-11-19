import { useQuery } from '@tanstack/react-query'
import { Card, Empty } from '../components/ui'
import { api } from '../lib/api'
import type { LogItem } from '../lib/api'
import { dateTime } from '../lib/format'

export default function Logs() {
  const q = useQuery({ queryKey: ['logs-all'], queryFn: () => api<LogItem[]>('/logs?limit=500'), refetchInterval: 10000 })
  const st = useQuery({ queryKey: ['status'], queryFn: () => api('/status') })
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Logs & System</h1>
      <Card title="Scheduled jobs (IST)">
        <div className="flex flex-wrap gap-4 text-sm">
          {st.data?.jobs?.map((j: any) => <span key={j.id}><b>{j.id}</b> <span className="text-muted">{dateTime(j.next_run)}</span></span>)}
        </div>
      </Card>
      <Card title="Event log">
        {q.data?.length ? (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Time</th><th>Level</th><th>Source</th><th>Message</th></tr></thead>
            <tbody>{q.data.map((l) => (
              <tr key={l._id}><td className="text-xs text-muted">{dateTime(l.ts)}</td>
                <td className={`text-xs font-semibold ${l.level === 'error' ? 'text-down' : l.level === 'warning' ? 'text-warn' : 'text-muted'}`}>{l.level}</td>
                <td className="text-xs">{l.source}</td><td className="whitespace-normal">{l.message}</td></tr>))}
            </tbody></table></div>
        ) : <Empty>No events</Empty>}
      </Card>
    </div>
  )
}
