import { useEffect, useMemo, useState } from 'react'
import './App.css'

const host = window.location.hostname
const WS_URL = `ws://${host}:8787/ws`
const API_URL = `http://${host}:8787/api/state`

const statusColor = {
  idle: '#22c55e',
  busy: '#f59e0b',
  thinking: '#3b82f6',
  running_tool: '#a855f7',
  blocked: '#ef4444',
  done: '#14b8a6',
}

const officeSlots = {
  main: { left: '20%', top: '20%' },
  'dev-bot': { left: '70%', top: '25%' },
  'research-bot': { left: '30%', top: '68%' },
  'ops-bot': { left: '75%', top: '70%' },
  clyde: { left: '50%', top: '45%' },
}

function App() {
  const [agents, setAgents] = useState({})
  const [events, setEvents] = useState([])
  const [connected, setConnected] = useState(false)
  const [selected, setSelected] = useState('main')

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
  const selectedAgent = agents[selected]

  return (
    <div className="page">
      <header className="header">
        <h1>OpenClaw Mission Control</h1>
        <span className={connected ? 'pill ok' : 'pill err'}>{connected ? 'Live' : 'Disconnected'}</span>
      </header>

      <main className="layout">
        <section className="panel office-panel">
          <h2>Office</h2>
          <div className="office-room">
            {agentList.map(([name, agent]) => {
              const pos = officeSlots[name] || { left: '50%', top: '50%' }
              return (
                <button
                  key={name}
                  className={`office-agent ${selected === name ? 'selected' : ''}`}
                  style={{ left: pos.left, top: pos.top, borderColor: statusColor[agent.status] || '#64748b' }}
                  onClick={() => setSelected(name)}
                >
                  <span className="dot" style={{ background: statusColor[agent.status] || '#94a3b8' }} />
                  <strong>{name}</strong>
                  <small>{agent.status}</small>
                </button>
              )
            })}
          </div>
          <div className="legend">
            {Object.keys(statusColor).map((k) => (
              <span key={k}><i style={{ background: statusColor[k] }} />{k}</span>
            ))}
          </div>
        </section>

        <section className="panel side-panel">
          <h2>{selected} details</h2>
          {selectedAgent ? (
            <>
              <p><b>Status:</b> {selectedAgent.status}</p>
              <p><b>Task:</b> {selectedAgent.task}</p>
              <p><b>Updated:</b> {new Date(selectedAgent.updatedAt).toLocaleTimeString()}</p>
            </>
          ) : <p>No data yet.</p>}

          <h2>Activity</h2>
          <ul className="events">
            {events.slice(0, 12).map((e) => (
              <li key={e.id || `${e.name}-${e.updatedAt}`}>
                <b>{e.data?.name || e.name}</b> → {e.data?.status || e.status}
                <small>{new Date(e.at || e.updatedAt).toLocaleTimeString()}</small>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}

export default App
