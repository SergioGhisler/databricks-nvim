import { useEffect, useMemo, useState } from 'react'
import './App.css'

const WS_URL = 'ws://localhost:8787/ws'
const API_URL = 'http://localhost:8787/api/state'

const statusColor = {
  idle: '#22c55e',
  busy: '#f59e0b',
  thinking: '#3b82f6',
  running_tool: '#a855f7',
  blocked: '#ef4444',
  done: '#14b8a6',
}

function App() {
  const [agents, setAgents] = useState({})
  const [events, setEvents] = useState([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    fetch(API_URL)
      .then((r) => r.json())
      .then((data) => {
        setAgents(data.agents || {})
        setEvents(data.events || [])
      })
      .catch(() => {})

    const ws = new WebSocket(WS_URL)
    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.type === 'state.snapshot') {
        setAgents(msg.data.agents || {})
        setEvents(msg.data.events || [])
      }
      if (msg.type === 'agent.updated') {
        const payload = msg.data
        setAgents((prev) => ({ ...prev, [payload.name]: payload }))
        setEvents((prev) => [msg.data, ...prev].slice(0, 100))
      }
    }

    return () => ws.close()
  }, [])

  const agentList = useMemo(() => Object.entries(agents), [agents])

  return (
    <div className="page">
      <header className="header">
        <h1>OpenClaw Mission Control</h1>
        <span className={connected ? 'pill ok' : 'pill err'}>
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </header>

      <main className="grid">
        <section className="panel">
          <h2>Agents</h2>
          <div className="agents">
            {agentList.map(([name, a]) => (
              <article key={name} className="agent-card">
                <div className="row">
                  <strong>{name}</strong>
                  <span className="dot" style={{ background: statusColor[a.status] || '#94a3b8' }} />
                </div>
                <div className="meta">{a.status}</div>
                <div className="task">{a.task}</div>
                <div className="meta">{new Date(a.updatedAt).toLocaleTimeString()}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Activity</h2>
          <ul className="events">
            {events.slice(0, 20).map((e) => (
              <li key={e.id || `${e.name}-${e.updatedAt}`}>
                <b>{e.data?.name || e.name}</b> → {e.data?.status || e.status} <small>{new Date(e.at || e.updatedAt).toLocaleTimeString()}</small>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}

export default App
